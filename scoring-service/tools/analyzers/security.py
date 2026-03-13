import re
from tools.file_scanner import ScannedFile

SECRET_PATTERNS = [
    (re.compile(r'''(?:api[_-]?key|apikey|secret[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*["\']([a-zA-Z0-9_\-/+=]{20,})["\']''', re.IGNORECASE), "Hardcoded API key or secret"),
    (re.compile(r'''["\']sk-[a-zA-Z0-9]{20,}["\']'''), "OpenAI API key"),
    (re.compile(r'''["\']ghp_[a-zA-Z0-9]{36,}["\']'''), "GitHub personal access token"),
    (re.compile(r'''["\']AKIA[A-Z0-9]{16}["\']'''), "AWS access key"),
    (re.compile(r'''password\s*[:=]\s*["\'](?!.*\{\{)(?!.*process\.env)(?!.*os\.environ)([^"\']{8,})["\']''', re.IGNORECASE), "Hardcoded password"),
]


def analyze_security(files: list[ScannedFile]) -> list[dict]:
    findings = []

    for file in files:
        if file.is_test or file.is_generated:
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

        for pattern, description in SECRET_PATTERNS:
            for match in pattern.finditer(file.content):
                line_num = file.content[:match.start()].count('\n') + 1
                evidence = match.group()[:30] + "..." if len(match.group()) > 30 else match.group()
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
