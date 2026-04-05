import pytest
from unittest.mock import patch, MagicMock
from tools.verdict_writer import build_verdict_prompt, parse_verdict_response

def test_build_prompt_includes_scores():
    scores = {
        "error_handling": {"score": 45, "grade": "F", "findings_count": 5},
        "test_coverage": {"score": 0, "grade": "F", "findings_count": 1},
        "documentation": {"score": 72, "grade": "C", "findings_count": 2},
        "security": {"score": 85, "grade": "B", "findings_count": 1},
        "code_structure": {"score": 38, "grade": "F", "findings_count": 8},
        "dependencies": {"score": 65, "grade": "D", "findings_count": 3},
    }
    findings = [{"dimension": "test_coverage", "severity": "critical", "issue": "No tests", "file": None}]
    prompt = build_verdict_prompt(
        repo_name="vercel/next.js",
        slop_score=72,
        scores=scores,
        findings=findings,
        metadata={"total_files": 50, "total_loc": 3000},
    )
    assert "72" in prompt
    assert "vercel/next.js" in prompt
    assert "No tests" in prompt

def test_parse_verdict_extracts_text():
    mock_response = "This repo is sloppy. Your AI phoned it in."
    result = parse_verdict_response(mock_response)
    assert isinstance(result, str)
    assert len(result) > 0

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
