# LLM Finding Reviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an LLM review pass that annotates borderline findings with false-positive judgments, slotted between analyzers and scoring in the pipeline.

**Architecture:** New module `tools/finding_reviewer.py` with three layers: borderline filter, structural summary extractor (regex-based), and a single GPT-4.1-mini call that returns JSON dispositions. Pipeline calls it after analyzers, before scoring. Verdict writer surfaces annotations. Graceful degradation on any failure.

**Tech Stack:** Python 3.12, OpenAI SDK (already in requirements.txt), pytest

**Spec:** `docs/superpowers/specs/2026-04-03-llm-finding-reviewer-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `tools/finding_reviewer.py` | Borderline filter, structural summary extractor, LLM prompt builder, response parser, `review_borderline_findings()` |
| Modify | `tools/pipeline.py:44-46` | Insert `review_borderline_findings()` call between analyzers and scoring |
| Modify | `tools/verdict_writer.py:74-81` | Append `llm_review` annotations to finding lines in verdict prompt |
| Create | `tests/test_finding_reviewer.py` | All tests for the new module |

---

### Task 1: Borderline Filter

**Files:**
- Create: `scoring-service/tests/test_finding_reviewer.py`
- Create: `scoring-service/tools/finding_reviewer.py`

- [ ] **Step 1: Write failing tests for borderline filter**

```python
# tests/test_finding_reviewer.py
from tools.finding_reviewer import _is_borderline


class TestBorderlineFilter:
    def test_low_severity_any_dimension_is_borderline(self):
        finding = {"dimension": "error_handling", "severity": "low", "file": "app.ts"}
        assert _is_borderline(finding) is True

    def test_medium_code_structure_is_borderline(self):
        finding = {"dimension": "code_structure", "severity": "medium", "file": "big.ts"}
        assert _is_borderline(finding) is True

    def test_medium_non_code_structure_is_not_borderline(self):
        finding = {"dimension": "security", "severity": "medium", "file": "config.ts"}
        assert _is_borderline(finding) is False

    def test_high_severity_is_not_borderline(self):
        finding = {"dimension": "code_structure", "severity": "high", "file": "huge.ts"}
        assert _is_borderline(finding) is False

    def test_critical_severity_is_not_borderline(self):
        finding = {"dimension": "test_coverage", "severity": "critical", "file": None}
        assert _is_borderline(finding) is False

    def test_finding_with_no_file_is_not_borderline(self):
        finding = {"dimension": "code_structure", "severity": "low", "file": None}
        assert _is_borderline(finding) is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && source .venv/bin/activate && python -m pytest tests/test_finding_reviewer.py -v`
Expected: FAIL with ImportError (module doesn't exist yet)

- [ ] **Step 3: Implement borderline filter**

```python
# tools/finding_reviewer.py
from tools.file_scanner import ScannedFile


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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestBorderlineFilter -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/chrisgscott/projects/isitslop
git add scoring-service/tools/finding_reviewer.py scoring-service/tests/test_finding_reviewer.py
git commit -m "feat(reviewer): add borderline finding filter"
```

---

### Task 2: Structural Summary Extractor

**Files:**
- Modify: `scoring-service/tests/test_finding_reviewer.py`
- Modify: `scoring-service/tools/finding_reviewer.py`

- [ ] **Step 1: Write failing tests for JS/TS import and export extraction**

Add to `tests/test_finding_reviewer.py`:

```python
from tools.finding_reviewer import _extract_structural_summary
from tools.file_scanner import ScannedFile


def _make_file(path: str, content: str, lang: str = "typescript", ext: str = ".ts") -> ScannedFile:
    return ScannedFile(
        path=path, extension=ext, language=lang,
        loc=len(content.splitlines()), content=content, is_test=False,
    )


class TestStructuralSummaryImports:
    def test_extracts_es_imports(self):
        content = """import { foo } from '@/lib/db'
import bar from 'express'
import * as baz from './utils/auth'"""
        summary = _extract_structural_summary(_make_file("app.ts", content))
        assert "@/lib/db" in summary["imports"]
        assert "express" in summary["imports"]
        assert "./utils/auth" in summary["imports"]
        assert summary["import_count"] == 3

    def test_extracts_require_imports(self):
        content = """const db = require('prisma')
const fs = require('fs')"""
        summary = _extract_structural_summary(_make_file("app.js", content, lang="javascript", ext=".js"))
        assert "prisma" in summary["imports"]
        assert "fs" in summary["imports"]
        assert summary["import_count"] == 2

    def test_extracts_python_imports(self):
        content = """import os
from flask import Flask
from app.auth.middleware import require_login"""
        summary = _extract_structural_summary(_make_file("app.py", content, lang="python", ext=".py"))
        assert "os" in summary["imports"]
        assert "flask" in summary["imports"]
        assert "app.auth.middleware" in summary["imports"]
        assert summary["import_count"] == 3

    def test_extracts_go_imports(self):
        content = '''import (
    "fmt"
    "net/http"
    "github.com/gorilla/mux"
)'''
        summary = _extract_structural_summary(_make_file("main.go", content, lang="go", ext=".go"))
        assert "fmt" in summary["imports"]
        assert "net/http" in summary["imports"]
        assert "github.com/gorilla/mux" in summary["imports"]
        assert summary["import_count"] == 3


class TestStructuralSummaryExports:
    def test_extracts_ts_exports(self):
        content = """export function calculateTotal() {}
export const TAX_RATE = 0.1
export class Invoice {}
export default app"""
        summary = _extract_structural_summary(_make_file("pricing.ts", content))
        assert "calculateTotal" in summary["exports"]
        assert "TAX_RATE" in summary["exports"]
        assert "Invoice" in summary["exports"]
        assert "default" in summary["exports"]
        assert summary["export_count"] == 4

    def test_extracts_python_top_level_defs(self):
        content = """class UserService:
    pass

def create_user():
    pass

    def _helper():
        pass

def delete_user():
    pass"""
        summary = _extract_structural_summary(_make_file("users.py", content, lang="python", ext=".py"))
        assert "UserService" in summary["exports"]
        assert "create_user" in summary["exports"]
        assert "delete_user" in summary["exports"]
        assert "_helper" not in summary["exports"]
        assert summary["export_count"] == 3

    def test_extracts_go_public_symbols(self):
        content = """func HandleRequest() {}
func internalHelper() {}
type UserService struct {}
type config struct {}"""
        summary = _extract_structural_summary(_make_file("handler.go", content, lang="go", ext=".go"))
        assert "HandleRequest" in summary["exports"]
        assert "UserService" in summary["exports"]
        assert "internalHelper" not in summary["exports"]
        assert "config" not in summary["exports"]
        assert summary["export_count"] == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestStructuralSummaryImports tests/test_finding_reviewer.py::TestStructuralSummaryExports -v`
Expected: FAIL with ImportError (function doesn't exist yet)

- [ ] **Step 3: Implement structural summary extractor**

Add to `tools/finding_reviewer.py`:

```python
import re

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
        return [m[1] for m in _PY_DEF.finditer(content) if m.start() == 0 or content[m.start() - 1] == "\n"]
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestStructuralSummaryImports tests/test_finding_reviewer.py::TestStructuralSummaryExports -v`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/chrisgscott/projects/isitslop
git add scoring-service/tools/finding_reviewer.py scoring-service/tests/test_finding_reviewer.py
git commit -m "feat(reviewer): add structural summary extractor with import/export/domain parsing"
```

---

### Task 3: Domain Bucket Classification

**Files:**
- Modify: `scoring-service/tests/test_finding_reviewer.py`

- [ ] **Step 1: Write failing tests for domain bucket classification**

Add to `tests/test_finding_reviewer.py`:

```python
from tools.finding_reviewer import _classify_domain_buckets


class TestDomainBuckets:
    def test_single_domain(self):
        imports = ["@/lib/db", "@/utils/money", "@/types/pricing"]
        buckets = _classify_domain_buckets(imports)
        assert "data" in buckets
        assert len(buckets) == 1

    def test_multiple_domains(self):
        imports = ["express", "@/lib/db", "@/auth/middleware", "@/services/email"]
        buckets = _classify_domain_buckets(imports)
        assert "http" in buckets
        assert "data" in buckets
        assert "auth" in buckets
        assert "messaging" in buckets

    def test_no_matching_domains(self):
        imports = ["lodash", "dayjs", "./constants"]
        buckets = _classify_domain_buckets(imports)
        assert len(buckets) == 0

    def test_payment_domain(self):
        imports = ["stripe", "@/utils/billing"]
        buckets = _classify_domain_buckets(imports)
        assert "payment" in buckets
```

- [ ] **Step 2: Run tests to verify they pass** (implementation already exists from Task 2)

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestDomainBuckets -v`
Expected: All 4 tests PASS (the function is already implemented)

- [ ] **Step 3: Commit**

```bash
cd /Users/chrisgscott/projects/isitslop
git add scoring-service/tests/test_finding_reviewer.py
git commit -m "test(reviewer): add domain bucket classification tests"
```

---

### Task 4: LLM Prompt Builder

**Files:**
- Modify: `scoring-service/tests/test_finding_reviewer.py`
- Modify: `scoring-service/tools/finding_reviewer.py`

- [ ] **Step 1: Write failing tests for prompt building**

Add to `tests/test_finding_reviewer.py`:

```python
from tools.finding_reviewer import _build_review_prompt


class TestPromptBuilder:
    def test_builds_numbered_finding_list(self):
        findings_with_summaries = [
            {
                "finding": {
                    "dimension": "code_structure",
                    "severity": "low",
                    "file": "src/pricing/calc.ts",
                    "issue": "Large file (420 code lines) -- barely over threshold",
                    "evidence": "420 code lines, threshold is 400",
                },
                "summary": {
                    "imports": ["@/lib/db", "@/utils/money"],
                    "exports": ["calculateTotal", "applyDiscount"],
                    "import_count": 2,
                    "export_count": 2,
                    "domain_buckets": {"data", "payment"},
                    "domain_bucket_count": 2,
                },
            },
        ]
        system, user = _build_review_prompt(findings_with_summaries)
        assert "false positive" in system.lower()
        assert "JSON array" in system
        assert "[1]" in user
        assert "src/pricing/calc.ts" in user
        assert "420 code lines" in user
        assert "Imports (2)" in user
        assert "Exports (2)" in user
        assert "data" in user
        assert "payment" in user

    def test_multiple_findings_numbered_sequentially(self):
        findings_with_summaries = [
            {
                "finding": {"dimension": "code_structure", "severity": "low", "file": "a.ts", "issue": "issue a", "evidence": "ev a"},
                "summary": {"imports": [], "exports": [], "import_count": 0, "export_count": 0, "domain_buckets": set(), "domain_bucket_count": 0},
            },
            {
                "finding": {"dimension": "error_handling", "severity": "low", "file": "b.ts", "issue": "issue b", "evidence": "ev b"},
                "summary": {"imports": [], "exports": [], "import_count": 0, "export_count": 0, "domain_buckets": set(), "domain_bucket_count": 0},
            },
        ]
        system, user = _build_review_prompt(findings_with_summaries)
        assert "[1]" in user
        assert "[2]" in user
        assert "a.ts" in user
        assert "b.ts" in user
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestPromptBuilder -v`
Expected: FAIL with ImportError

- [ ] **Step 3: Implement prompt builder**

Add to `tools/finding_reviewer.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestPromptBuilder -v`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/chrisgscott/projects/isitslop
git add scoring-service/tools/finding_reviewer.py scoring-service/tests/test_finding_reviewer.py
git commit -m "feat(reviewer): add LLM review prompt builder"
```

---

### Task 5: Response Parser

**Files:**
- Modify: `scoring-service/tests/test_finding_reviewer.py`
- Modify: `scoring-service/tools/finding_reviewer.py`

- [ ] **Step 1: Write failing tests for response parsing**

Add to `tests/test_finding_reviewer.py`:

```python
from tools.finding_reviewer import _parse_review_response


class TestResponseParser:
    def test_parses_valid_json_array(self):
        raw = '[{"finding_index": 1, "disposition": "confirm", "reason": "legit"}, {"finding_index": 2, "disposition": "likely_false_positive", "reason": "cohesive file"}]'
        result = _parse_review_response(raw)
        assert len(result) == 2
        assert result[0]["disposition"] == "confirm"
        assert result[1]["disposition"] == "likely_false_positive"

    def test_extracts_json_from_markdown_fences(self):
        raw = '```json\n[{"finding_index": 1, "disposition": "confirm", "reason": "real"}]\n```'
        result = _parse_review_response(raw)
        assert len(result) == 1
        assert result[0]["disposition"] == "confirm"

    def test_returns_empty_list_on_malformed_json(self):
        raw = "this is not json at all"
        result = _parse_review_response(raw)
        assert result == []

    def test_returns_empty_list_on_none(self):
        result = _parse_review_response(None)
        assert result == []

    def test_returns_empty_list_on_empty_string(self):
        result = _parse_review_response("")
        assert result == []

    def test_skips_entries_with_invalid_disposition(self):
        raw = '[{"finding_index": 1, "disposition": "maybe", "reason": "unsure"}, {"finding_index": 2, "disposition": "confirm", "reason": "real"}]'
        result = _parse_review_response(raw)
        assert len(result) == 1
        assert result[0]["finding_index"] == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestResponseParser -v`
Expected: FAIL with ImportError

- [ ] **Step 3: Implement response parser**

Add to `tools/finding_reviewer.py`:

```python
import json
import logging

logger = logging.getLogger(__name__)

VALID_DISPOSITIONS = {"confirm", "likely_false_positive"}


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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestResponseParser -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/chrisgscott/projects/isitslop
git add scoring-service/tools/finding_reviewer.py scoring-service/tests/test_finding_reviewer.py
git commit -m "feat(reviewer): add LLM response parser with graceful degradation"
```

---

### Task 6: Main `review_borderline_findings()` Function

**Files:**
- Modify: `scoring-service/tests/test_finding_reviewer.py`
- Modify: `scoring-service/tools/finding_reviewer.py`

- [ ] **Step 1: Write failing tests for the main function**

Add to `tests/test_finding_reviewer.py`:

```python
from unittest.mock import patch, MagicMock
from tools.finding_reviewer import review_borderline_findings
from tools.file_scanner import ScannedFile


class TestReviewBorderlineFindings:
    def _make_scanned_file(self, path, content="export function foo() {}", lang="typescript"):
        return ScannedFile(
            path=path, extension=".ts", language=lang,
            loc=len(content.splitlines()), content=content, is_test=False,
        )

    def test_annotates_borderline_findings(self):
        files = [self._make_scanned_file("src/big.ts", "import { db } from '@/lib/db'\nexport function query() {}\n" * 200)]
        findings = [
            {"dimension": "code_structure", "severity": "low", "file": "src/big.ts", "issue": "Large file", "evidence": "420 lines"},
            {"dimension": "security", "severity": "high", "file": "config.ts", "issue": "Hardcoded secret", "evidence": "found key"},
        ]
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '[{"finding_index": 1, "disposition": "likely_false_positive", "reason": "cohesive"}]'

        with patch("tools.finding_reviewer.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = mock_response
            result = review_borderline_findings(findings, files)

        assert "llm_review" in result[0]
        assert result[0]["llm_review"]["disposition"] == "likely_false_positive"
        assert "llm_review" not in result[1]  # high severity, not reviewed

    def test_skips_llm_call_when_no_borderline_findings(self):
        files = []
        findings = [
            {"dimension": "security", "severity": "high", "file": "config.ts", "issue": "Secret", "evidence": "key"},
        ]
        with patch("tools.finding_reviewer.OpenAI") as MockOpenAI:
            result = review_borderline_findings(findings, files)
            MockOpenAI.assert_not_called()
        assert "llm_review" not in result[0]

    def test_returns_findings_unchanged_on_missing_api_key(self):
        files = [self._make_scanned_file("src/big.ts")]
        findings = [
            {"dimension": "code_structure", "severity": "low", "file": "src/big.ts", "issue": "Large file", "evidence": "420 lines"},
        ]
        with patch("tools.finding_reviewer.OpenAI", side_effect=Exception("No API key")):
            result = review_borderline_findings(findings, files)
        assert "llm_review" not in result[0]

    def test_returns_findings_unchanged_on_api_error(self):
        files = [self._make_scanned_file("src/big.ts")]
        findings = [
            {"dimension": "code_structure", "severity": "low", "file": "src/big.ts", "issue": "Large file", "evidence": "420 lines"},
        ]
        with patch("tools.finding_reviewer.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.side_effect = Exception("API down")
            result = review_borderline_findings(findings, files)
        assert "llm_review" not in result[0]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestReviewBorderlineFindings -v`
Expected: FAIL with ImportError

- [ ] **Step 3: Implement main function**

Add to `tools/finding_reviewer.py`:

```python
import os
from openai import OpenAI

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestReviewBorderlineFindings -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/chrisgscott/projects/isitslop
git add scoring-service/tools/finding_reviewer.py scoring-service/tests/test_finding_reviewer.py
git commit -m "feat(reviewer): implement review_borderline_findings with LLM call and annotation"
```

---

### Task 7: Pipeline Integration

**Files:**
- Modify: `scoring-service/tools/pipeline.py`
- Modify: `scoring-service/tests/test_pipeline.py`

- [ ] **Step 1: Read the current pipeline test file for context**

Run: `cat /Users/chrisgscott/projects/isitslop/scoring-service/tests/test_pipeline.py`

Understand existing test patterns before adding the new test.

- [ ] **Step 2: Write failing test for pipeline integration**

Add to `tests/test_pipeline.py` (follow existing patterns):

```python
from unittest.mock import patch


def test_pipeline_calls_finding_reviewer():
    """The pipeline should call review_borderline_findings between analyzers and scoring."""
    with patch("tools.pipeline.review_borderline_findings") as mock_review, \
         patch("tools.pipeline.download_and_extract") as mock_download, \
         patch("tools.pipeline.scan_repo") as mock_scan, \
         patch("tools.pipeline.analyze_error_handling", return_value=[]), \
         patch("tools.pipeline.analyze_test_coverage", return_value=[]), \
         patch("tools.pipeline.analyze_documentation", return_value=[]), \
         patch("tools.pipeline.analyze_security", return_value=[]), \
         patch("tools.pipeline.analyze_code_structure", return_value=[]), \
         patch("tools.pipeline.analyze_dependencies", return_value=[]), \
         patch("tools.pipeline.calculate_scores") as mock_scores, \
         patch("tools.pipeline.calculate_composite_score", return_value=25), \
         patch("tools.pipeline.generate_verdict", return_value="Verdict text"):

        from pathlib import Path
        from tools.file_scanner import ScanResult, ScannedFile
        mock_download.return_value = Path("/tmp/fake-repo")
        mock_scan.return_value = ScanResult(
            files=[], total_files=1, total_loc=100,
            languages={"typescript": 100.0}, primary_language="typescript",
        )
        mock_review.return_value = []

        from tools.pipeline import analyze_repo
        with patch("shutil.rmtree"):
            analyze_repo("test-owner", "test-repo")

        mock_review.assert_called_once()
        # Verify review was called before scoring
        review_call_order = mock_review.call_args
        scores_call_order = mock_scores.call_args
        assert review_call_order is not None
        assert scores_call_order is not None
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_pipeline.py::test_pipeline_calls_finding_reviewer -v`
Expected: FAIL (review_borderline_findings not imported in pipeline)

- [ ] **Step 4: Add the review step to pipeline.py**

In `scoring-service/tools/pipeline.py`, add the import at the top:

```python
from tools.finding_reviewer import review_borderline_findings
```

Then insert the review call after the analyzer block (after line 43, before the `# Score` comment):

```python
        # Review borderline findings with LLM
        findings = review_borderline_findings(findings, scan.files)
```

The full block should read:

```python
        findings.extend(analyze_dependencies(scan.package_json, scan.total_loc, scan.has_lock_file))

        # Review borderline findings with LLM
        findings = review_borderline_findings(findings, scan.files)

        # Score
        scores = calculate_scores(findings, scan.total_files, scan.total_loc)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_pipeline.py::test_pipeline_calls_finding_reviewer -v`
Expected: PASS

- [ ] **Step 6: Run the full test suite**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/chrisgscott/projects/isitslop
git add scoring-service/tools/pipeline.py scoring-service/tests/test_pipeline.py
git commit -m "feat(reviewer): integrate finding review step into analysis pipeline"
```

---

### Task 8: Verdict Writer Integration

**Files:**
- Modify: `scoring-service/tools/verdict_writer.py:74-81`
- Modify: `scoring-service/tests/test_verdict_writer.py`

- [ ] **Step 1: Write failing test for verdict prompt with annotations**

Add to `tests/test_verdict_writer.py`:

```python
def test_build_prompt_includes_llm_review_annotations():
    scores = {
        "error_handling": {"score": 90, "grade": "A", "findings_count": 0},
        "test_coverage": {"score": 90, "grade": "A", "findings_count": 0},
        "documentation": {"score": 90, "grade": "A", "findings_count": 0},
        "security": {"score": 90, "grade": "A", "findings_count": 0},
        "code_structure": {"score": 80, "grade": "B", "findings_count": 1},
        "dependencies": {"score": 90, "grade": "A", "findings_count": 0},
    }
    findings = [
        {
            "dimension": "code_structure",
            "severity": "low",
            "issue": "Large file (420 code lines)",
            "file": "src/pricing/calc.ts",
            "llm_review": {
                "disposition": "likely_false_positive",
                "reason": "File imports only from pricing domain",
            },
        },
    ]
    prompt = build_verdict_prompt(
        repo_name="test/repo",
        slop_score=10,
        scores=scores,
        findings=findings,
        metadata={"total_files": 50, "total_loc": 3000},
    )
    assert "REVIEWER NOTE" in prompt
    assert "likely false positive" in prompt.lower()
    assert "pricing domain" in prompt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_verdict_writer.py::test_build_prompt_includes_llm_review_annotations -v`
Expected: FAIL (assertion error, no REVIEWER NOTE in prompt)

- [ ] **Step 3: Update verdict prompt builder**

In `scoring-service/tools/verdict_writer.py`, modify the `build_verdict_prompt` function's finding formatting block (around line 78-81). Replace:

```python
    top_findings = "\n".join([
        f"- [{f.get('severity', 'medium').upper()}] {_sanitize_for_prompt(f['issue'])}"
        + (f" ({_sanitize_for_prompt(f['file'])})" if f.get('file') else "")
        for f in top
    ])
```

With:

```python
    finding_lines = []
    for f in top:
        line = f"- [{f.get('severity', 'medium').upper()}] {_sanitize_for_prompt(f['issue'])}"
        if f.get('file'):
            line += f" ({_sanitize_for_prompt(f['file'])})"
        review = f.get("llm_review")
        if review and review.get("disposition") == "likely_false_positive":
            line += f"\n  [REVIEWER NOTE: likely false positive -- {_sanitize_for_prompt(review.get('reason', ''))}]"
        finding_lines.append(line)
    top_findings = "\n".join(finding_lines)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_verdict_writer.py -v`
Expected: All verdict writer tests PASS

- [ ] **Step 5: Run the full test suite**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/chrisgscott/projects/isitslop
git add scoring-service/tools/verdict_writer.py scoring-service/tests/test_verdict_writer.py
git commit -m "feat(reviewer): surface LLM review annotations in verdict prompt"
```

---

### Task 9: Full Integration Test

**Files:**
- Modify: `scoring-service/tests/test_finding_reviewer.py`

- [ ] **Step 1: Write end-to-end integration test**

Add to `tests/test_finding_reviewer.py`:

```python
class TestIntegration:
    def test_full_review_flow_with_mixed_findings(self):
        """End-to-end: mixed findings go through review, only borderline ones get annotated."""
        cohesive_content = "\n".join([
            "import { db } from '@/lib/db'",
            "import { Money } from '@/utils/money'",
            "export function calculateTotal() { return db.query() }",
            "export function applyDiscount() { return Money.subtract() }",
        ] + ["// padding line"] * 400)

        messy_content = "\n".join([
            "import express from 'express'",
            "import { db } from '@/lib/db'",
            "import { sendEmail } from '@/services/email'",
            "import { auth } from '@/auth'",
            "import stripe from 'stripe'",
            "import { S3 } from 'aws-sdk'",
            "export function handleRoute() {}",
            "export function queryDB() {}",
            "export function sendNotification() {}",
            "export function processPayment() {}",
            "export function uploadFile() {}",
        ] + ["// padding line"] * 400)

        files = [
            ScannedFile(path="src/pricing/calc.ts", extension=".ts", language="typescript",
                       loc=404, content=cohesive_content, is_test=False),
            ScannedFile(path="src/api/kitchen-sink.ts", extension=".ts", language="typescript",
                       loc=411, content=messy_content, is_test=False),
        ]

        findings = [
            {"dimension": "code_structure", "severity": "low", "file": "src/pricing/calc.ts",
             "issue": "Large file (404 code lines)", "evidence": "404 code lines"},
            {"dimension": "code_structure", "severity": "low", "file": "src/api/kitchen-sink.ts",
             "issue": "Large file (411 code lines)", "evidence": "411 code lines"},
            {"dimension": "security", "severity": "critical", "file": "config.ts",
             "issue": "Hardcoded secret", "evidence": "found key"},
        ]

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps([
            {"finding_index": 1, "disposition": "likely_false_positive", "reason": "single domain, cohesive exports"},
            {"finding_index": 2, "disposition": "confirm", "reason": "6 domain buckets, low cohesion"},
        ])

        with patch("tools.finding_reviewer.OpenAI") as MockOpenAI:
            client = MockOpenAI.return_value
            client.chat.completions.create.return_value = mock_response
            result = review_borderline_findings(findings, files)

        # Cohesive file: marked as likely false positive
        assert result[0]["llm_review"]["disposition"] == "likely_false_positive"
        # Kitchen sink file: confirmed as real problem
        assert result[1]["llm_review"]["disposition"] == "confirm"
        # Critical security finding: no review at all
        assert "llm_review" not in result[2]
```

- [ ] **Step 2: Run integration test**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/test_finding_reviewer.py::TestIntegration -v`
Expected: PASS

- [ ] **Step 3: Run full test suite one final time**

Run: `cd /Users/chrisgscott/projects/isitslop/scoring-service && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/chrisgscott/projects/isitslop
git add scoring-service/tests/test_finding_reviewer.py
git commit -m "test(reviewer): add full integration test with mixed finding types"
```
