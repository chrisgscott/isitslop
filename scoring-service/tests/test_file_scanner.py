import pytest
from pathlib import Path
from tools.file_scanner import scan_repo, ScannedFile, ScanResult


@pytest.fixture
def sample_repo(tmp_path):
    """Create a minimal repo structure for testing."""
    src = tmp_path / "src"
    src.mkdir()
    (src / "index.ts").write_text("console.log('hello');\nconsole.log('world');\n")
    (src / "utils.ts").write_text("export function add(a: number, b: number) { return a + b; }\n")

    tests = tmp_path / "tests"
    tests.mkdir()
    (tests / "index.test.ts").write_text("test('it works', () => { expect(true).toBe(true); });\n")

    (tmp_path / "package.json").write_text('{"name":"test","scripts":{"test":"vitest"},"dependencies":{"react":"^18.0.0"},"devDependencies":{"vitest":"^1.0.0"}}')
    (tmp_path / "README.md").write_text("# Test Project\nA test project.\n")

    nm = tmp_path / "node_modules" / "react"
    nm.mkdir(parents=True)
    (nm / "index.js").write_text("module.exports = {};")

    return tmp_path


def test_scan_counts_files(sample_repo):
    result = scan_repo(sample_repo)
    assert result.total_files == 5  # index.ts, utils.ts, index.test.ts, package.json, README.md


def test_scan_counts_loc(sample_repo):
    result = scan_repo(sample_repo)
    assert result.total_loc > 0


def test_scan_detects_languages(sample_repo):
    result = scan_repo(sample_repo)
    assert "typescript" in result.languages


def test_scan_detects_test_files(sample_repo):
    result = scan_repo(sample_repo)
    test_files = [f for f in result.files if f.is_test]
    assert len(test_files) == 1


def test_scan_skips_node_modules(sample_repo):
    result = scan_repo(sample_repo)
    paths = [str(f.path) for f in result.files]
    assert not any("node_modules" in p for p in paths)


def test_scan_reads_package_json(sample_repo):
    result = scan_repo(sample_repo)
    assert result.package_json is not None
    assert result.package_json["name"] == "test"
