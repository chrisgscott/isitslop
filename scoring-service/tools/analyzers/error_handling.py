import re
from tools.file_scanner import ScannedFile, NON_CODE_EXTENSIONS

EMPTY_CATCH = re.compile(r'catch\s*\([^)]*\)\s*\{\s*\}', re.MULTILINE)
CATCH_ONLY_CONSOLE = re.compile(r'catch\s*\([^)]*\)\s*\{\s*console\.(log|warn)\([^)]*\)\s*;?\s*\}', re.MULTILINE)
CONSOLE_LOG = re.compile(r'\bconsole\.log\b')

CONSOLE_LOG_THRESHOLD = 5

# Pattern to check if a match position is inside a string literal
STRING_CONTEXT = re.compile(r'''["'`].*catch\s*\(''')


def _match_is_in_string(content: str, match_start: int) -> bool:
    """Check if a regex match is inside a string literal on its line."""
    line_start = content.rfind('\n', 0, match_start) + 1
    line_prefix = content[line_start:match_start]
    # If there's an odd number of quotes before the match on this line, it's inside a string
    for quote in ('"', "'", '`'):
        if line_prefix.count(quote) % 2 == 1:
            return True
    return False


def analyze_error_handling(files: list[ScannedFile]) -> list[dict]:
    findings = []

    for file in files:
        if file.is_test or file.is_generated or file.is_vendored or not file.language:
            continue
        if file.extension in NON_CODE_EXTENSIONS:
            continue

        for match in EMPTY_CATCH.finditer(file.content):
            if _match_is_in_string(file.content, match.start()):
                continue
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
            if _match_is_in_string(file.content, match.start()):
                continue
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
