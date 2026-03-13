import re
from tools.file_scanner import ScannedFile

EMPTY_CATCH = re.compile(r'catch\s*\([^)]*\)\s*\{\s*\}', re.MULTILINE)
CATCH_ONLY_CONSOLE = re.compile(r'catch\s*\([^)]*\)\s*\{\s*console\.(log|warn)\([^)]*\)\s*;?\s*\}', re.MULTILINE)
CONSOLE_LOG = re.compile(r'\bconsole\.log\b')

CONSOLE_LOG_THRESHOLD = 5


def analyze_error_handling(files: list[ScannedFile]) -> list[dict]:
    findings = []

    for file in files:
        if file.is_test or not file.language:
            continue

        for match in EMPTY_CATCH.finditer(file.content):
            line_num = file.content[:match.start()].count('\n') + 1
            findings.append({
                "dimension": "error_handling",
                "severity": "high",
                "file": file.path,
                "line": line_num,
                "issue": "Empty catch block swallows errors silently",
                "evidence": match.group().strip()[:100],
                "fix_prompt": f"In {file.path} at line {line_num}, there's an empty catch block. Add proper error handling — log the error and either re-throw or return an appropriate error response.",
            })

        for match in CATCH_ONLY_CONSOLE.finditer(file.content):
            line_num = file.content[:match.start()].count('\n') + 1
            findings.append({
                "dimension": "error_handling",
                "severity": "medium",
                "file": file.path,
                "line": line_num,
                "issue": "Catch block only logs error without handling it",
                "evidence": match.group().strip()[:100],
                "fix_prompt": f"In {file.path} at line {line_num}, the catch block only console.logs the error. Add proper error handling — return an error response, show a user-facing message, or re-throw.",
            })

        console_count = len(CONSOLE_LOG.findall(file.content))
        if console_count >= CONSOLE_LOG_THRESHOLD:
            findings.append({
                "dimension": "error_handling",
                "severity": "medium",
                "file": file.path,
                "line": None,
                "issue": f"High console.log density ({console_count} instances) — likely debug code left in production",
                "evidence": f"{console_count} console.log calls in {file.loc} lines",
                "fix_prompt": f"In {file.path}, there are {console_count} console.log statements. Replace with a proper logging library or remove debug logs before shipping.",
            })

    return findings
