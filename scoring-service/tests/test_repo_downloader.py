import pytest
from tools.repo_downloader import download_and_extract, RepoNotFoundError

def test_download_small_public_repo():
    """Test downloading a known small public repo."""
    path = download_and_extract("octocat", "Hello-World", branch=None)
    assert path.exists()
    assert any(path.iterdir())

def test_download_nonexistent_repo():
    """Test error handling for nonexistent repo."""
    with pytest.raises(Exception):
        download_and_extract("nonexistent-user-xyz-99999", "nonexistent-repo-xyz-99999", branch=None)
