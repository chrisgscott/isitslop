from tools.file_scanner import ScanResult


def analyze_documentation(scan: ScanResult) -> list[dict]:
    findings = []

    if not scan.has_readme:
        findings.append({
            "dimension": "documentation",
            "severity": "high",
            "file": None,
            "line": None,
            "issue": "No README file found",
            "evidence": "Missing README.md",
            "fix_prompt": "Add a README.md with at least: project description, setup instructions, and usage examples.",
        })
    elif len(scan.readme_content.strip().splitlines()) < 5:
        findings.append({
            "dimension": "documentation",
            "severity": "medium",
            "file": "README.md",
            "line": None,
            "issue": "README is very short/thin — likely auto-generated or placeholder",
            "evidence": f"{len(scan.readme_content.strip().splitlines())} lines",
            "fix_prompt": "Your README is basically empty. Add: what this project does, how to install it, how to run it, and how to use it.",
        })

    source_files = [f for f in scan.files if not f.is_test and f.language and f.language not in {"json", "yaml", "markdown", "css", "html"}]

    if source_files:
        total_loc = sum(f.loc for f in source_files)
        comment_lines = 0
        for f in source_files:
            for line in f.content.splitlines():
                stripped = line.strip()
                if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("/*") or stripped.startswith("*") or stripped.startswith("'''") or stripped.startswith('"""'):
                    comment_lines += 1

        comment_ratio = comment_lines / total_loc if total_loc > 0 else 0
        if comment_ratio < 0.02 and total_loc > 200:
            findings.append({
                "dimension": "documentation",
                "severity": "low",
                "file": None,
                "line": None,
                "issue": f"Very few inline comments ({comment_ratio:.1%} of code)",
                "evidence": f"{comment_lines} comment lines in {total_loc} LOC",
                "fix_prompt": "Add comments to explain non-obvious logic, especially in complex functions and business rules.",
            })

    return findings
