import re
from tools.file_scanner import ScannedFile

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
