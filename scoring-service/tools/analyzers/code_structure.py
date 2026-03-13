import re
from tools.file_scanner import ScannedFile

GOD_FILE_THRESHOLD = 400
DEEP_NESTING_THRESHOLD = 4


def analyze_code_structure(files: list[ScannedFile]) -> list[dict]:
    findings = []

    for file in files:
        if file.is_test or not file.language:
            continue

        if file.loc > GOD_FILE_THRESHOLD:
            findings.append({
                "dimension": "code_structure",
                "severity": "high",
                "file": file.path,
                "line": None,
                "issue": f"Large file ({file.loc} lines) — likely doing too much",
                "evidence": f"{file.loc} LOC, threshold is {GOD_FILE_THRESHOLD}",
                "fix_prompt": f"{file.path} is {file.loc} lines long. Break it into smaller, focused modules. Each file should have one clear responsibility.",
            })

        max_depth = _detect_max_nesting(file.content)
        if max_depth >= DEEP_NESTING_THRESHOLD:
            findings.append({
                "dimension": "code_structure",
                "severity": "medium",
                "file": file.path,
                "line": None,
                "issue": f"Deep nesting detected ({max_depth} levels) — hard to read and maintain",
                "evidence": f"Max nesting depth: {max_depth}",
                "fix_prompt": f"{file.path} has {max_depth} levels of nesting. Use early returns, extract helper functions, or restructure conditionals to flatten the code.",
            })

    # Duplicate-named files
    name_counts: dict[str, list[str]] = {}
    for file in files:
        if file.is_test:
            continue
        base = re.sub(r'\d+', '', file.path.split('/')[-1].rsplit('.', 1)[0]).lower()
        if base:
            name_counts.setdefault(base, []).append(file.path)

    for base_name, paths in name_counts.items():
        if len(paths) > 2 and base_name not in {"index", "page", "layout", "route", "loading", "error"}:
            findings.append({
                "dimension": "code_structure",
                "severity": "low",
                "file": None,
                "line": None,
                "issue": f"Multiple files with similar names suggesting copy-paste: {', '.join(paths[:3])}",
                "evidence": f"{len(paths)} files with base name '{base_name}'",
                "fix_prompt": f"There are {len(paths)} files that look like copies of each other. Consolidate them or give them meaningful, distinct names.",
            })

    return findings


def _detect_max_nesting(content: str) -> int:
    max_depth = 0
    current_depth = 0
    for char in content:
        if char == '{':
            current_depth += 1
            max_depth = max(max_depth, current_depth)
        elif char == '}':
            current_depth = max(0, current_depth - 1)
    return max_depth
