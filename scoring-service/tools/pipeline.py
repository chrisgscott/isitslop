import os
import time
import shutil
from pathlib import Path

from tools.repo_downloader import download_and_extract
from tools.file_scanner import scan_repo
from tools.analyzers.error_handling import analyze_error_handling
from tools.analyzers.test_coverage import analyze_test_coverage
from tools.analyzers.documentation import analyze_documentation
from tools.analyzers.security import analyze_security
from tools.analyzers.code_structure import analyze_code_structure
from tools.analyzers.dependencies import analyze_dependencies
from tools.scorer import calculate_scores, calculate_composite_score
from tools.verdict_writer import generate_verdict
from tools.db import update_analysis_status, save_analysis_results


def analyze_repo(
    repo_owner: str,
    repo_name: str,
    repo_branch: str | None = None,
) -> dict:
    """Run the full analysis pipeline. Returns results dict."""
    start_time = time.time()
    repo_path = None

    try:
        # Download
        github_token = os.environ.get("GITHUB_TOKEN")
        repo_path = download_and_extract(repo_owner, repo_name, repo_branch, github_token)

        # Scan
        scan = scan_repo(repo_path)

        # Run all analyzers
        findings = []
        findings.extend(analyze_error_handling(scan.files))
        findings.extend(analyze_test_coverage(scan))
        findings.extend(analyze_documentation(scan))
        findings.extend(analyze_security(scan.files))
        findings.extend(analyze_code_structure(scan.files))
        findings.extend(analyze_dependencies(scan.package_json, scan.total_loc, scan.has_lock_file))

        # Score
        scores = calculate_scores(findings, scan.total_files, scan.total_loc)
        slop_score = calculate_composite_score(scores)

        # Generate verdict
        metadata = {
            "total_files": scan.total_files,
            "total_loc": scan.total_loc,
            "languages": scan.languages,
            "primary_language": scan.primary_language,
            "has_package_json": scan.package_json is not None,
            "dep_count": len(scan.package_json.get("dependencies", {})) if scan.package_json else 0,
            "dev_dep_count": len(scan.package_json.get("devDependencies", {})) if scan.package_json else 0,
            "repo_size_mb": round(sum(f.loc for f in scan.files) * 50 / 1024 / 1024, 1),  # rough estimate
            "analysis_duration_ms": 0,  # filled in below
        }

        verdict = generate_verdict(
            repo_name=f"{repo_owner}/{repo_name}",
            slop_score=slop_score,
            scores=scores,
            findings=findings,
            metadata=metadata,
        )

        duration_ms = round((time.time() - start_time) * 1000)
        metadata["analysis_duration_ms"] = duration_ms

        return {
            "slop_score": slop_score,
            "scores": scores,
            "verdict": verdict,
            "receipts": findings,
            "metadata": metadata,
        }

    finally:
        # Clean up downloaded repo
        if repo_path and repo_path.exists():
            shutil.rmtree(repo_path.parent, ignore_errors=True)


def run_analysis(
    analysis_id: str,
    repo_owner: str,
    repo_name: str,
    repo_branch: str | None = None,
):
    """Run analysis and save results to Supabase."""
    update_analysis_status(analysis_id, "analyzing")

    results = analyze_repo(repo_owner, repo_name, repo_branch)
    save_analysis_results(analysis_id, results)
