import httpx
import tarfile
import tempfile
from pathlib import Path

MAX_TARBALL_SIZE_MB = 100
MAX_TARBALL_SIZE_BYTES = MAX_TARBALL_SIZE_MB * 1024 * 1024


class RepoTooLargeError(Exception):
    pass

class RepoNotFoundError(Exception):
    pass

class RepoPrivateError(Exception):
    pass


def download_and_extract(
    owner: str,
    repo: str,
    branch: str | None = None,
    github_token: str | None = None,
) -> Path:
    """Download a GitHub repo tarball and extract to a temp directory."""
    ref = branch or ""
    url = f"https://api.github.com/repos/{owner}/{repo}/tarball/{ref}"

    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "IsItSlop/1.0",
    }
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    with httpx.stream("GET", url, headers=headers, follow_redirects=True, timeout=60.0) as response:
        if response.status_code == 404:
            raise RepoNotFoundError(f"Repository {owner}/{repo} not found")
        if response.status_code == 403:
            raise RepoPrivateError(f"Repository {owner}/{repo} is private or rate limited")
        response.raise_for_status()

        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > MAX_TARBALL_SIZE_BYTES:
            raise RepoTooLargeError(
                f"Repository is too large ({int(content_length) / 1024 / 1024:.0f}MB). Max: {MAX_TARBALL_SIZE_MB}MB."
            )

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".tar.gz")
        downloaded = 0
        for chunk in response.iter_bytes(chunk_size=8192):
            downloaded += len(chunk)
            if downloaded > MAX_TARBALL_SIZE_BYTES:
                tmp.close()
                Path(tmp.name).unlink()
                raise RepoTooLargeError(f"Repository exceeds {MAX_TARBALL_SIZE_MB}MB limit.")
            tmp.write(chunk)
        tmp.close()

    extract_dir = Path(tempfile.mkdtemp(prefix="isitslop-"))
    with tarfile.open(tmp.name, "r:gz") as tar:
        tar.extractall(path=extract_dir, filter="data")

    Path(tmp.name).unlink()

    subdirs = list(extract_dir.iterdir())
    if len(subdirs) == 1 and subdirs[0].is_dir():
        return subdirs[0]
    return extract_dir
