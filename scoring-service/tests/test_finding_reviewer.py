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
        finding = {"dimension": "test_coverage", "severity": "critical", "file": "some_file.ts"}
        assert _is_borderline(finding) is False

    def test_finding_with_no_file_is_not_borderline(self):
        finding = {"dimension": "code_structure", "severity": "low", "file": None}
        assert _is_borderline(finding) is False
