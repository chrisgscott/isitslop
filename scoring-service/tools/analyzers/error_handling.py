import re
from tools.file_scanner import ScannedFile, NON_CODE_EXTENSIONS

EMPTY_CATCH = re.compile(r'catch\s*\([^)]*\)\s*\{\s*\}', re.MULTILINE)
CATCH_ONLY_CONSOLE = re.compile(r'catch\s*\([^)]*\)\s*\{\s*console\.(log|warn)\([^)]*\)\s*;?\s*\}', re.MULTILINE)
CONSOLE_LOG = re.compile(r'\bconsole\.log\b')

CONSOLE_LOG_THRESHOLD = 5

# Directories where console.log is the expected output mechanism (CLI scripts, build tools)
SCRIPT_DIR_PATTERN = re.compile(r'(?:^|/)scripts?/', re.IGNORECASE)

# Build tool config files where console.log is used for dev-server/middleware logging
BUILD_CONFIG_PATTERN = re.compile(
    r'(?:^|/)(?:vite|webpack|rollup|esbuild|rspack|turbopack|next|postcss|tailwind|jest|vitest)'
    r'\.config\.',
    re.IGNORECASE,
)

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
            # console.warn in a catch block is often intentional graceful degradation
            # (e.g. localStorage fallback, clipboard API fallback) — lower severity
            method = match.group(1)  # "log" or "warn"
            if method == "warn":
                severity = "low"
                issue = "Catch block logs warning without re-throwing — may be intentional graceful degradation"
            else:
                severity = "medium"
                issue = "Catch block only logs error without handling it"
            findings.append({
                "dimension": "error_handling",
                "severity": severity,
                "file": file.path,
                "line": line_num,
                "issue": issue,
                "evidence": match.group().strip()[:100],
                "fix_prompt": f"In {file.path} at line {line_num}, the catch block only console.logs the error. Add proper error handling — return an error response, show a user-facing message, or re-throw.",
            })

        # console.log is a JS/TS concept — skip non-JS files
        if file.language not in ("javascript", "typescript", "jsx", "tsx"):
            continue

        console_count = len(CONSOLE_LOG.findall(file.content))
        if (
            console_count >= CONSOLE_LOG_THRESHOLD
            and not SCRIPT_DIR_PATTERN.search(file.path)
            and not BUILD_CONFIG_PATTERN.search(file.path)
        ):
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
