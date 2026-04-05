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
