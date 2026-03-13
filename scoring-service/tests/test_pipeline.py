import pytest
from unittest.mock import patch, MagicMock
from tools.pipeline import analyze_repo

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
