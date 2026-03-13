import re
from tools.file_scanner import ScannedFile, NON_CODE_EXTENSIONS

SECRET_PATTERNS = [
    (re.compile(r'''(?:api[_-]?key|apikey|secret[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*["\']([a-zA-Z0-9_\-/+=]{20,})["\']''', re.IGNORECASE), "Hardcoded API key or secret"),
    (re.compile(r'''["\']sk-[a-zA-Z0-9]{20,}["\']'''), "OpenAI API key"),
    (re.compile(r'''["\']ghp_[a-zA-Z0-9]{36,}["\']'''), "GitHub personal access token"),
    (re.compile(r'''["\']AKIA[A-Z0-9]{16}["\']'''), "AWS access key"),
    (re.compile(r'''password\s*[:=]\s*["\'](?!.*\{\{)(?!.*process\.env)(?!.*os\.environ)([^"\']{8,})["\']''', re.IGNORECASE), "Hardcoded password"),
]

# Files/paths where "secrets" are expected and not real security issues
# e.g. e2e setup scripts that generate test credentials, docusaurus search configs
SETUP_SCRIPT_PATTERNS = re.compile(
    r'(?:setup[_-]?e2e|seed|fixtures?|mock|fake|dummy)', re.IGNORECASE
)

# Public/client-side API keys that are not secrets
# Algolia search keys in docusaurus configs, etc.
PUBLIC_KEY_CONTEXTS = re.compile(
    r'(?:docusaurus|algolia|search)', re.IGNORECASE
)

# Shell variable interpolation — not a hardcoded value
SHELL_VARIABLE = re.compile(r'\$\{?\w+')


def _is_setup_or_test_script(path: str) -> bool:
    """Scripts that generate ephemeral test credentials."""
    return bool(SETUP_SCRIPT_PATTERNS.search(path))


def _is_public_key_context(path: str, content: str, match_start: int) -> bool:
    """Check if the match is in a context where the key is public by design."""
    if PUBLIC_KEY_CONTEXTS.search(path):
        return True
    # Check surrounding lines for context clues
    line_start = content.rfind('\n', 0, match_start) + 1
    line_end = content.find('\n', match_start)
    if line_end == -1:
        line_end = len(content)
    line = content[line_start:line_end]
    if re.search(r'algolia|search[_-]?(?:api|key)', line, re.IGNORECASE):
        return True
    return False


def _is_shell_variable_value(match_text: str) -> bool:
    """Values containing shell variable interpolation aren't hardcoded secrets."""
    return bool(SHELL_VARIABLE.search(match_text))


def analyze_security(files: list[ScannedFile]) -> list[dict]:
    findings = []

    for file in files:
        if file.is_test or file.is_generated or file.is_vendored:
            continue

        if file.path == ".env" or file.path.endswith("/.env"):
            findings.append({
                "dimension": "security",
                "severity": "critical",
                "file": file.path,
                "line": None,
                "issue": ".env file committed to repository — may contain secrets",
                "evidence": ".env file found in repo",
                "fix_prompt": f"Remove {file.path} from the repository and add .env to .gitignore. Rotate any secrets that were exposed.",
            })
            continue

        # Don't scan non-code files (markdown, yaml, etc.) for secret patterns
        # They often contain example code snippets with placeholder keys
        if file.extension in NON_CODE_EXTENSIONS:
            continue

        # Skip e2e/test setup scripts that generate ephemeral credentials
        if _is_setup_or_test_script(file.path):
            continue

        for pattern, description in SECRET_PATTERNS:
            for match in pattern.finditer(file.content):
                matched_text = match.group()

                # Skip shell variable interpolation (not a hardcoded value)
                if _is_shell_variable_value(matched_text):
                    continue

                # Skip public/client-side keys (Algolia, Docusaurus search, etc.)
                if _is_public_key_context(file.path, file.content, match.start()):
                    continue

                line_num = file.content[:match.start()].count('\n') + 1
                evidence = matched_text[:30] + "..." if len(matched_text) > 30 else matched_text
                findings.append({
                    "dimension": "security",
                    "severity": "critical",
                    "file": file.path,
                    "line": line_num,
                    "issue": f"{description} found in source code",
                    "evidence": evidence,
                    "fix_prompt": f"In {file.path} at line {line_num}, there's a hardcoded secret. Move it to an environment variable and add the file to .gitignore if needed.",
                })

    return findings
