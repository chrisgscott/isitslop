import json
import logging
import os
import re
from openai import OpenAI
from tools.file_scanner import ScannedFile

logger = logging.getLogger(__name__)

VALID_DISPOSITIONS = {"confirm", "likely_false_positive"}

# --- Import extraction regexes ---

# JS/TS: import ... from 'module' or import 'module'
_JS_IMPORT = re.compile(r"""(?:import\s+.*?\s+from\s+|import\s+)['"]([^'"]+)['"]""")
# JS/TS: require('module')
_JS_REQUIRE = re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)""")
# Python: import module / from module import ...
_PY_IMPORT = re.compile(r"""^(?:import\s+([\w.]+)|from\s+([\w.]+)\s+import)""", re.MULTILINE)
# Go: "module/path"
_GO_IMPORT = re.compile(r"""^\s*"([^"]+)"$""", re.MULTILINE)

# --- Export extraction regexes ---

# JS/TS: export function name, export const name, export class name
_JS_EXPORT = re.compile(r"""^export\s+(?:function|const|let|var|class)\s+(\w+)""", re.MULTILINE)
# JS/TS: export default
_JS_EXPORT_DEFAULT = re.compile(r"""^export\s+default\b""", re.MULTILINE)
# Python: top-level def and class (indent 0)
_PY_DEF = re.compile(r"""^(def|class)\s+(\w+)""", re.MULTILINE)
# Go: top-level public func and type (uppercase first letter)
_GO_PUBLIC = re.compile(r"""^(?:func|type)\s+([A-Z]\w*)""", re.MULTILINE)

# --- Domain bucket keywords ---

DOMAIN_KEYWORDS = {
    "data": ["db", "database", "prisma", "drizzle", "sql", "mongo", "redis", "orm"],
    "auth": ["auth", "session", "jwt", "oauth", "passport"],
    "messaging": ["email", "smtp", "sendgrid", "mailgun", "notification", "push"],
    "http": ["express", "fastify", "router", "middleware", "handler", "endpoint"],
    "ui": ["react", "vue", "svelte", "component", "render", "dom", "css"],
    "storage": ["s3", "blob", "upload", "file", "stream"],
    "payment": ["stripe", "billing", "payment", "subscription"],
}


def _extract_imports(content: str, language: str | None) -> list[str]:
    """Extract import module paths from file content."""
    if language in ("typescript", "javascript"):
        from_imports = _JS_IMPORT.findall(content)
        require_imports = _JS_REQUIRE.findall(content)
        return list(dict.fromkeys(from_imports + require_imports))  # dedupe, preserve order
    if language == "python":
        matches = _PY_IMPORT.findall(content)
        return list(dict.fromkeys(m[0] or m[1] for m in matches))
    if language == "go":
        return _GO_IMPORT.findall(content)
    return []


def _extract_exports(content: str, language: str | None) -> list[str]:
    """Extract top-level public symbol names."""
    if language in ("typescript", "javascript"):
        names = _JS_EXPORT.findall(content)
        if _JS_EXPORT_DEFAULT.search(content):
            names.append("default")
        return names
    if language == "python":
        return [m.group(2) for m in _PY_DEF.finditer(content) if m.start() == 0 or content[m.start() - 1] == "\n"]
    if language == "go":
        return _GO_PUBLIC.findall(content)
    return []


def _classify_domain_buckets(imports: list[str]) -> set[str]:
    """Classify imports into domain buckets by keyword matching."""
    buckets = set()
    joined = " ".join(imports).lower()
    for bucket, keywords in DOMAIN_KEYWORDS.items():
        if any(kw in joined for kw in keywords):
            buckets.add(bucket)
    return buckets


def _extract_structural_summary(file: ScannedFile) -> dict:
    """Build a structural summary for a single file."""
    imports = _extract_imports(file.content, file.language)
    exports = _extract_exports(file.content, file.language)
    domain_buckets = _classify_domain_buckets(imports)
    return {
        "imports": imports,
        "exports": exports,
        "import_count": len(imports),
        "export_count": len(exports),
        "domain_buckets": domain_buckets,
        "domain_bucket_count": len(domain_buckets),
    }


REVIEW_SYSTEM_PROMPT = """You review code analysis findings to identify likely false positives.
You receive borderline findings with structural metadata about each file.
Your job: determine if each finding reflects a real problem or if the analyzer was too aggressive.

Respond with a JSON array. Each element:
{"finding_index": 1, "disposition": "confirm" or "likely_false_positive", "reason": "one sentence"}

Do not invent new findings. Do not comment on findings not listed.
If unsure, confirm the finding -- err toward the analyzer being right."""


def _build_review_prompt(findings_with_summaries: list[dict]) -> tuple[str, str]:
    """Build the system and user prompts for the LLM review call."""
    lines = ["Review these borderline findings:", ""]
    for i, item in enumerate(findings_with_summaries, 1):
        f = item["finding"]
        s = item["summary"]
        lines.append(f"[{i}] {f['dimension']} / {f['severity']}: {f['issue']}")
        lines.append(f"    File: {f['file']}")
        lines.append(f"    Evidence: {f['evidence']}")
        imports_str = ", ".join(s["imports"][:10]) or "(none)"
        exports_str = ", ".join(s["exports"][:10]) or "(none)"
        buckets_str = ", ".join(sorted(s["domain_buckets"])) or "(none)"
        lines.append(f"    Structural summary:")
        lines.append(f"      Imports ({s['import_count']}): {imports_str}")
        lines.append(f"      Exports ({s['export_count']}): {exports_str}")
        lines.append(f"      Domain buckets ({s['domain_bucket_count']}): {buckets_str}")
        lines.append("")
    return REVIEW_SYSTEM_PROMPT, "\n".join(lines)


def _parse_review_response(raw: str | None) -> list[dict]:
    """Parse the LLM's JSON response into a list of review entries."""
    if not raw:
        return []
    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Finding reviewer: failed to parse LLM response as JSON")
        return []
    if not isinstance(parsed, list):
        return []
    return [
        entry for entry in parsed
        if isinstance(entry, dict) and entry.get("disposition") in VALID_DISPOSITIONS
    ]


def _is_borderline(finding: dict) -> bool:
    """A finding is borderline if the deterministic analyzer has low confidence."""
    if finding.get("file") is None:
        return False
    severity = finding.get("severity", "")
    dimension = finding.get("dimension", "")
    if severity == "low":
        return True
    if severity == "medium" and dimension == "code_structure":
        return True
    return False


DEFAULT_MODEL = "gpt-4.1-mini"


def review_borderline_findings(
    findings: list[dict],
    files: list[ScannedFile],
    model: str | None = None,
) -> list[dict]:
    """Review borderline findings with an LLM and annotate with dispositions.

    Returns the same findings list with `llm_review` annotations added
    to borderline findings. Non-borderline findings are untouched.
    On any failure, returns findings unchanged.
    """
    # Build file lookup for quick access
    file_map = {f.path: f for f in files}

    # Identify borderline findings and pair with structural summaries
    borderline_items = []
    borderline_indices = []
    for i, finding in enumerate(findings):
        if not _is_borderline(finding):
            continue
        scanned_file = file_map.get(finding["file"])
        if scanned_file is None:
            continue
        summary = _extract_structural_summary(scanned_file)
        borderline_items.append({"finding": finding, "summary": summary})
        borderline_indices.append(i)

    if not borderline_items:
        return findings

    # Call LLM
    try:
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        system_prompt, user_prompt = _build_review_prompt(borderline_items)
        response = client.chat.completions.create(
            model=model or DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0,
            max_tokens=1000,
        )
        raw_content = response.choices[0].message.content
    except Exception:
        logger.warning("Finding reviewer: LLM call failed, returning findings unchanged")
        return findings

    # Parse and annotate
    reviews = _parse_review_response(raw_content)
    review_map = {r["finding_index"]: r for r in reviews}

    for prompt_index, findings_index in enumerate(borderline_indices, 1):
        review = review_map.get(prompt_index)
        if review:
            findings[findings_index]["llm_review"] = {
                "disposition": review["disposition"],
                "reason": review.get("reason", ""),
            }

    return findings
