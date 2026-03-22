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

# Directories containing example/tutorial code with intentional placeholder secrets
EXAMPLE_DIR_PATTERNS = re.compile(
    r'(?:^|/)(?:docs_src|examples?|samples?|tutorials?)/', re.IGNORECASE
)

# Public/client-side API keys that are not secrets
# Algolia search keys in docusaurus configs, etc.
PUBLIC_KEY_CONTEXTS = re.compile(
    r'(?:docusaurus|algolia|search)', re.IGNORECASE
)

# Example env files — these contain placeholder secrets, not real ones
ENV_EXAMPLE_SUFFIXES = ('.env.example', '.env.sample', '.env.template', '.env.local.example')

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


# Placeholder password patterns — clearly not real credentials
PLACEHOLDER_PASSWORD = re.compile(
    r'^(?:your[_-]|example[_-]|change[_-]?me|replace[_-]?me|todo|placeholder|xxx)',
    re.IGNORECASE,
)


PLACEHOLDER_VALUE = re.compile(
    r'(?:dummy|fake|test|placeholder|example|sample|mock|xxxx)',
    re.IGNORECASE,
)


def _is_placeholder_secret(matched_text: str) -> bool:
    """Detect placeholder/dummy values in any secret pattern, not just passwords."""
    # Extract the quoted value from the match
    val_match = re.search(r'["\']([^"\']+)["\']', matched_text)
    if not val_match:
        return False
    value = val_match.group(1)
    return bool(PLACEHOLDER_VALUE.search(value))


def _is_placeholder_password(match_text: str) -> bool:
    """Detect placeholder/example passwords that aren't real credentials."""
    # Extract the password value from the match
    pw_match = re.search(r'password\s*[:=]\s*["\']([^"\']+)["\']', match_text, re.IGNORECASE)
    if not pw_match:
        return False
    value = pw_match.group(1)
    if PLACEHOLDER_PASSWORD.match(value):
        return True
    # All-caps constants like INCORRECT_PASSWORD are error codes, not secrets
    if re.match(r'^[A-Z][A-Z0-9_]+$', value):
        return True
    return False


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

        # Skip .env.example/.env.sample files — they contain placeholder secrets
        if any(file.path.endswith(suffix) for suffix in ENV_EXAMPLE_SUFFIXES):
            continue

        # Don't scan non-code files (markdown, yaml, etc.) for secret patterns
        # They often contain example code snippets with placeholder keys
        # Include .mdx (MDX docs) which isn't in NON_CODE_EXTENSIONS but is documentation
        if file.extension in NON_CODE_EXTENSIONS or file.extension == '.mdx':
            continue

        # Skip e2e/test setup scripts that generate ephemeral credentials
        if _is_setup_or_test_script(file.path):
            continue

        # Skip example/tutorial directories — they use intentional placeholder secrets
        if EXAMPLE_DIR_PATTERNS.search(file.path):
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

                # Skip placeholder/dummy values in any secret type
                if _is_placeholder_secret(matched_text):
                    continue

                # Skip placeholder passwords and error code constants
                if 'password' in description.lower() and _is_placeholder_password(matched_text):
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
