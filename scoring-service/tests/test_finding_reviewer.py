from tools.finding_reviewer import _is_borderline, _extract_structural_summary
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
