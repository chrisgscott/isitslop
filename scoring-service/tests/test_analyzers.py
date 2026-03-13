import pytest
from tools.file_scanner import ScannedFile, ScanResult
from tools.analyzers.error_handling import analyze_error_handling
from tools.analyzers.test_coverage import analyze_test_coverage
from tools.analyzers.documentation import analyze_documentation
from tools.analyzers.security import analyze_security
from tools.analyzers.code_structure import analyze_code_structure
from tools.analyzers.dependencies import analyze_dependencies


def _make_file(path: str, content: str, ext: str = ".ts") -> ScannedFile:
    return ScannedFile(
        path=path, extension=ext, language="typescript",
        loc=len(content.splitlines()), content=content, is_test=False,
    )


class TestErrorHandling:
    def test_detects_empty_catch(self):
        file = _make_file("app.ts", "try { foo() } catch (e) { }")
        findings = analyze_error_handling([file])
        issues = [f["issue"] for f in findings]
        assert any("empty catch" in i.lower() for i in issues)

    def test_detects_console_log_density(self):
        content = "\n".join([f"console.log('line {i}')" for i in range(10)])
        file = _make_file("app.ts", content)
        findings = analyze_error_handling([file])
        issues = [f["issue"] for f in findings]
        assert any("console.log" in i.lower() for i in issues)

    def test_no_findings_for_clean_code(self):
        file = _make_file("app.ts", "export function add(a, b) { return a + b; }")
        findings = analyze_error_handling([file])
        assert len(findings) == 0

    def test_skips_test_files(self):
        file = ScannedFile(
            path="app.test.ts", extension=".ts", language="typescript",
            loc=1, content="try { foo() } catch (e) { }", is_test=True,
        )
        findings = analyze_error_handling([file])
        assert len(findings) == 0


class TestTestCoverage:
    def test_detects_no_tests(self):
        files = [_make_file("app.ts", "const x = 1;")]
        result = ScanResult(files=files, total_files=1, total_loc=1, package_json={"scripts": {}})
        findings = analyze_test_coverage(result)
        assert any("no test" in f["issue"].lower() for f in findings)

    def test_detects_no_test_script(self):
        files = [_make_file("app.ts", "const x = 1;")]
        result = ScanResult(files=files, total_files=1, total_loc=1, package_json={"scripts": {"start": "node app.js"}})
        findings = analyze_test_coverage(result)
        assert any("test script" in f["issue"].lower() for f in findings)

    def test_detects_low_test_ratio(self):
        source_files = [_make_file(f"src/file{i}.ts", "const x = 1;\n" * 50) for i in range(10)]
        test_files = [ScannedFile(path="test/one.test.ts", extension=".ts", language="typescript", loc=5, content="test('x', () => {})", is_test=True)]
        result = ScanResult(files=source_files + test_files, total_files=11, total_loc=505, package_json={"scripts": {"test": "vitest"}})
        findings = analyze_test_coverage(result)
        assert any("ratio" in f["issue"].lower() for f in findings)

    def test_clean_project_no_critical(self):
        source_files = [_make_file(f"src/file{i}.ts", "const x = 1;\n" * 10) for i in range(3)]
        test_files = [ScannedFile(path=f"test/file{i}.test.ts", extension=".ts", language="typescript", loc=10, content="test('x', () => {})", is_test=True) for i in range(3)]
        result = ScanResult(files=source_files + test_files, total_files=6, total_loc=60, package_json={"scripts": {"test": "vitest"}})
        findings = analyze_test_coverage(result)
        critical = [f for f in findings if f["severity"] == "critical"]
        assert len(critical) == 0


class TestDocumentation:
    def test_detects_no_readme(self):
        result = ScanResult(files=[], total_files=1, total_loc=100, has_readme=False, readme_content="")
        findings = analyze_documentation(result)
        assert any("readme" in f["issue"].lower() for f in findings)

    def test_detects_empty_readme(self):
        result = ScanResult(files=[], total_files=1, total_loc=100, has_readme=True, readme_content="# My Project\n")
        findings = analyze_documentation(result)
        assert any("thin" in f["issue"].lower() or "short" in f["issue"].lower() for f in findings)


class TestSecurity:
    def test_detects_hardcoded_secrets(self):
        file = _make_file("config.ts", 'const API_KEY = "sk-1234567890abcdef1234567890abcdef"')
        findings = analyze_security([file])
        assert any("secret" in f["issue"].lower() or "key" in f["issue"].lower() for f in findings)

    def test_detects_env_file(self):
        file = ScannedFile(path=".env", extension="", language=None, loc=1, content="API_KEY=secret123", is_test=False)
        findings = analyze_security([file])
        assert any(".env" in f["issue"].lower() for f in findings)

    def test_no_findings_for_clean_code(self):
        file = _make_file("app.ts", "const x = process.env.API_KEY;")
        findings = analyze_security([file])
        assert len(findings) == 0


class TestCodeStructure:
    def test_detects_god_file(self):
        content = "\n".join([f"const line{i} = {i};" for i in range(500)])
        file = _make_file("god.ts", content)
        findings = analyze_code_structure([file])
        assert any("large" in f["issue"].lower() or "god" in f["issue"].lower() for f in findings)

    def test_detects_deep_nesting(self):
        content = "if (a) {\n  if (b) {\n    if (c) {\n      if (d) {\n        if (e) {\n          x();\n        }\n      }\n    }\n  }\n}"
        file = _make_file("nested.ts", content)
        findings = analyze_code_structure([file])
        assert any("nest" in f["issue"].lower() for f in findings)


class TestDependencies:
    def test_detects_too_many_deps(self):
        deps = {f"dep-{i}": "^1.0.0" for i in range(65)}
        pkg = {"dependencies": deps, "devDependencies": {}}
        findings = analyze_dependencies(pkg, total_loc=500)
        assert any("dependencies" in f["issue"].lower() for f in findings)

    def test_detects_missing_lock_file(self):
        pkg = {"dependencies": {"react": "^18.0.0"}}
        findings = analyze_dependencies(pkg, total_loc=100, has_lock_file=False)
        assert any("lock" in f["issue"].lower() for f in findings)

    def test_detects_duplicate_purpose(self):
        pkg = {"dependencies": {"axios": "^1.0.0", "node-fetch": "^3.0.0"}, "devDependencies": {}}
        findings = analyze_dependencies(pkg, total_loc=100)
        assert any("duplicate" in f["issue"].lower() for f in findings)
