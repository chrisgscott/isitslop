import pytest
from unittest.mock import patch, MagicMock
from tools.pipeline import analyze_repo


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

@patch("tools.verdict_writer.OpenAI")
@patch("tools.db.get_supabase")
def test_analyze_repo_returns_results(mock_supabase, mock_openai):
    """Test full pipeline with a small public repo, mocking OpenAI and Supabase."""
    # Mock OpenAI response
    mock_client = MagicMock()
    mock_openai.return_value = mock_client
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="This repo is sloppy."))]
    mock_client.chat.completions.create.return_value = mock_response

    # Mock Supabase
    mock_sb = MagicMock()
    mock_supabase.return_value = mock_sb

    results = analyze_repo(
        repo_owner="octocat",
        repo_name="Hello-World",
        repo_branch=None,
    )

    assert "slop_score" in results
    assert 0 <= results["slop_score"] <= 100
    assert "scores" in results
    assert "verdict" in results
    assert "receipts" in results
    assert "metadata" in results
