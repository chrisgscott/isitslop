DIMENSION_WEIGHTS = {
    "error_handling": 0.20,
    "code_structure": 0.25,
    "test_coverage": 0.20,
    "security": 0.15,
    "dependencies": 0.10,
    "documentation": 0.10,
}

SEVERITY_PENALTIES = {
    "critical": 20,
    "high": 12,
    "medium": 6,
    "low": 2,
}

ALL_DIMENSIONS = list(DIMENSION_WEIGHTS.keys())


def score_to_grade(score: int) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 70: return "C"
    if score >= 60: return "D"
    return "F"


def calculate_scores(findings: list[dict], total_files: int, total_loc: int) -> dict:
    """Calculate per-dimension scores from findings."""
    scores = {}

    for dim in ALL_DIMENSIONS:
        dim_findings = [f for f in findings if f["dimension"] == dim]
        # Start at 100, subtract penalties
        score = 100
        for f in dim_findings:
            severity = f.get("severity", "medium")
            penalty = SEVERITY_PENALTIES.get(severity, 5)
            score -= penalty

        score = max(0, min(100, score))

        scores[dim] = {
            "score": score,
            "grade": score_to_grade(score),
            "findings_count": len(dim_findings),
        }

    return scores


def calculate_composite_score(scores: dict) -> int:
    """Weighted average of dimension scores. Higher = more slop."""
    weighted_sum = 0.0
    for dim, weight in DIMENSION_WEIGHTS.items():
        dim_score = scores.get(dim, {}).get("score", 100)
        # Invert: 100 quality = 0 slop
        slop_score = 100 - dim_score
        weighted_sum += slop_score * weight

    return round(weighted_sum)
