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
