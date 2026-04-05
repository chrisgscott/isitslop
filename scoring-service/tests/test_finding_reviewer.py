from tools.finding_reviewer import _is_borderline, _extract_structural_summary, _classify_domain_buckets, _build_review_prompt, _parse_review_response
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
        finding = {"dimension": "test_coverage", "severity": "critical", "file": "some_file.ts"}
        assert _is_borderline(finding) is False

    def test_finding_with_no_file_is_not_borderline(self):
        finding = {"dimension": "code_structure", "severity": "low", "file": None}
        assert _is_borderline(finding) is False


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
