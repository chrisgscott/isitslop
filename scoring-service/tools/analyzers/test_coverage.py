from tools.file_scanner import ScanResult


def analyze_test_coverage(scan: ScanResult) -> list[dict]:
    findings = []

    test_files = [f for f in scan.files if f.is_test]
    source_files = [f for f in scan.files if not f.is_test and f.language and f.language not in {"json", "yaml", "markdown", "css", "html"}]

    if len(test_files) == 0 and len(source_files) > 0:
        findings.append({
            "dimension": "test_coverage",
            "severity": "critical",
            "file": None,
            "line": None,
            "issue": "No test files found anywhere in the repository",
            "evidence": f"0 files matching *.test.*, *.spec.*, or test directory ({len(source_files)} source files)",
            "fix_prompt": f"This project has zero tests across {len(source_files)} source files. Add a test framework and write tests for the core business logic.",
        })

    pkg = scan.package_json
    if pkg:
        scripts = pkg.get("scripts", {})
        has_test_script = any(k in scripts for k in ["test", "test:unit", "test:e2e", "test:integration"])
        if not has_test_script:
            findings.append({
                "dimension": "test_coverage",
                "severity": "high",
                "file": "package.json",
                "line": None,
                "issue": "No test script defined in package.json",
                "evidence": f"scripts: {list(scripts.keys())}",
                "fix_prompt": "Add a test script to package.json. Example: \"test\": \"vitest\" or \"test\": \"jest\".",
            })

    if len(test_files) > 0 and len(source_files) > 0:
        test_loc = sum(f.loc for f in test_files)
        source_loc = sum(f.loc for f in source_files)
        ratio = test_loc / source_loc if source_loc > 0 else 0

        if ratio < 0.1:
            findings.append({
                "dimension": "test_coverage",
                "severity": "high",
                "file": None,
                "line": None,
                "issue": f"Very low test-to-source ratio ({ratio:.1%}) — tests are {test_loc} LOC vs {source_loc} LOC source",
                "evidence": f"{len(test_files)} test files, {len(source_files)} source files, ratio: {ratio:.1%}",
                "fix_prompt": f"Test coverage is very thin ({ratio:.1%} test-to-source ratio). Add tests for the most critical paths first.",
            })
        elif ratio < 0.3:
            findings.append({
                "dimension": "test_coverage",
                "severity": "medium",
                "file": None,
                "line": None,
                "issue": f"Low test-to-source ratio ({ratio:.1%})",
                "evidence": f"{len(test_files)} test files, {len(source_files)} source files",
                "fix_prompt": f"Test coverage is below average ({ratio:.1%}). Consider adding more test coverage, especially for edge cases.",
            })

    return findings
