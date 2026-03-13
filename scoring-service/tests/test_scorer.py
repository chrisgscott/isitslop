from tools.scorer import calculate_scores, calculate_composite_score, score_to_grade

def test_score_to_grade():
    assert score_to_grade(95) == "A"
    assert score_to_grade(85) == "B"
    assert score_to_grade(75) == "C"
    assert score_to_grade(65) == "D"
    assert score_to_grade(50) == "F"
    assert score_to_grade(0) == "F"
    assert score_to_grade(100) == "A"

def test_calculate_scores_from_findings():
    findings = [
        {"dimension": "error_handling", "severity": "high"},
        {"dimension": "error_handling", "severity": "medium"},
        {"dimension": "test_coverage", "severity": "critical"},
    ]
    scores = calculate_scores(findings, total_files=10, total_loc=500)
    assert "error_handling" in scores
    assert "test_coverage" in scores
    assert scores["error_handling"]["grade"] in ("A", "B", "C", "D", "F")

def test_composite_score():
    scores = {
        "error_handling": {"score": 50, "grade": "F", "findings_count": 5},
        "test_coverage": {"score": 80, "grade": "B", "findings_count": 1},
        "documentation": {"score": 90, "grade": "A", "findings_count": 0},
        "security": {"score": 100, "grade": "A", "findings_count": 0},
        "code_structure": {"score": 60, "grade": "D", "findings_count": 3},
        "dependencies": {"score": 70, "grade": "C", "findings_count": 2},
    }
    composite = calculate_composite_score(scores)
    assert 0 <= composite <= 100
    # Should be weighted toward structure (25%) and error_handling (20%)
