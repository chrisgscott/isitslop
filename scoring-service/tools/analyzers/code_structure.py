import re
from tools.file_scanner import ScannedFile, NON_CODE_EXTENSIONS

GOD_FILE_THRESHOLD = 400
DEEP_NESTING_THRESHOLD = 5

# Framework convention filenames — duplicates of these are expected
FRAMEWORK_CONVENTIONS = {
    # Next.js
    "index", "page", "layout", "route", "loading", "error",
    "actions", "middleware", "template", "not-found", "globals",
    # Remix
    "loader", "action", "meta",
    # Common patterns
    "config", "utils", "helpers", "types", "constants",
    "mod", "lib", "main", "init", "__init__",
    "schema", "model", "models", "migration",
    "seed", "fixture", "fixtures",
    # Monorepo files that repeat per workspace
    "package", "tsconfig", "eslintrc", "prettierrc",
}

# Directories/paths suggesting data/content files, not logic
DATA_PATH_PATTERNS = {"i18n", "locales", "translations", "fixtures", "seeds", "data", "mocks", "schemas"}


def _is_data_file(file: ScannedFile) -> bool:
    """Detect data/content/schema files that are large by nature, not by poor structure."""
    path_parts = set(file.path.lower().split('/'))
    if path_parts & DATA_PATH_PATTERNS:
        return True
    # Schema/model definition files (ORM schemas, type definitions)
    basename = file.path.split('/')[-1].lower()
    if any(pattern in basename for pattern in ('schema.', 'models.', 'entities.', 'tables.')):
        return True
    # Large files that are mostly string literals or objects (i18n, seed data)
    if file.loc > 200:
        lines = file.content.splitlines()
        string_lines = sum(1 for l in lines if l.strip().startswith('"') or l.strip().startswith("'"))
        if string_lines / max(len(lines), 1) > 0.5:
            return True
    return False


def _is_analyzable_code(file: ScannedFile) -> bool:
    """Return True if this file should get code-quality heuristics."""
    if file.is_test or file.is_generated or file.is_vendored:
        return False
    if not file.language:
        return False
    if file.extension in NON_CODE_EXTENSIONS:
        return False
    return True


def analyze_code_structure(files: list[ScannedFile]) -> list[dict]:
    findings = []

    for file in files:
        if not _is_analyzable_code(file):
            continue

        if file.loc > GOD_FILE_THRESHOLD and not _is_data_file(file) and not file.is_barrel:
            findings.append({
                "dimension": "code_structure",
                "severity": "high",
                "file": file.path,
                "line": None,
                "issue": f"Large file ({file.loc} lines) — likely doing too much",
                "evidence": f"{file.loc} LOC, threshold is {GOD_FILE_THRESHOLD}",
                "fix_prompt": f"{file.path} is {file.loc} lines long. Break it into smaller, focused modules. Each file should have one clear responsibility.",
            })

        max_depth = _detect_max_nesting(file.content, file.language)
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

    # Duplicate-named files — require content similarity, not just name match
    name_groups: dict[str, list[ScannedFile]] = {}
    for file in files:
        if file.is_test or file.is_generated or file.is_vendored:
            continue
        if not file.language or file.extension in NON_CODE_EXTENSIONS:
            continue
        base = re.sub(r'\d+', '', file.path.split('/')[-1].rsplit('.', 1)[0]).lower()
        if base and base not in FRAMEWORK_CONVENTIONS:
            name_groups.setdefault(base, []).append(file)

    for base_name, group_files in name_groups.items():
        if len(group_files) > 2:
            # Check actual content similarity before flagging
            if _has_similar_content(group_files):
                paths = [f.path for f in group_files[:3]]
                findings.append({
                    "dimension": "code_structure",
                    "severity": "low",
                    "file": None,
                    "line": None,
                    "issue": f"Multiple files with similar names and content: {', '.join(paths)}",
                    "evidence": f"{len(group_files)} files with base name '{base_name}' share similar code",
                    "fix_prompt": f"There are {len(group_files)} files that look like copies of each other. Consolidate them or extract shared logic.",
                })

    return findings


def _has_similar_content(files: list[ScannedFile], threshold: float = 0.5) -> bool:
    """Check if any pair of files share significant content overlap."""
    for i in range(min(len(files), 5)):
        for j in range(i + 1, min(len(files), 5)):
            lines_a = set(files[i].content.splitlines())
            lines_b = set(files[j].content.splitlines())
            # Remove trivial lines (imports, blank lines, braces)
            lines_a = {l.strip() for l in lines_a if len(l.strip()) > 20}
            lines_b = {l.strip() for l in lines_b if len(l.strip()) > 20}
            if not lines_a or not lines_b:
                continue
            overlap = len(lines_a & lines_b)
            smaller = min(len(lines_a), len(lines_b))
            if smaller > 0 and overlap / smaller >= threshold:
                return True
    return False


# Patterns that indicate control flow nesting (brace-based languages)
CONTROL_FLOW_OPENERS = re.compile(
    r'^\s*(?:'
    r'if\s*\(|'
    r'else\s*(?:if\s*\()?\s*\{|'
    r'for\s*\(|'
    r'while\s*\(|'
    r'do\s*\{|'
    r'switch\s*\(|'
    r'try\s*\{|'
    r'catch\s*\(|'
    r'finally\s*\{'
    r')'
)

# Patterns for Python control flow (indentation-based)
PYTHON_CONTROL_FLOW = re.compile(
    r'^\s*(?:if |elif |else:|for |while |try:|except |finally:|with )'
)


def _detect_max_control_flow_nesting(content: str) -> int:
    """Detect max control flow nesting depth, ignoring structural nesting."""
    max_depth = 0
    current_depth = 0

    for line in content.splitlines():
        stripped = line.strip()

        # Skip empty lines and comments
        if not stripped or stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            continue

        # Check if this line opens a control flow block
        if CONTROL_FLOW_OPENERS.match(stripped):
            current_depth += 1
            max_depth = max(max_depth, current_depth)

        # A line that is just "}" or "} else {" etc. closes a level
        if stripped == '}' or stripped.startswith('} else') or stripped.startswith('} catch') or stripped.startswith('} finally'):
            current_depth = max(0, current_depth - 1)

    return max_depth


def _detect_max_control_flow_nesting_python(content: str) -> int:
    """Detect max control flow nesting for Python (indentation-based)."""
    max_depth = 0

    for line in content.splitlines():
        if not line.strip() or line.strip().startswith('#'):
            continue

        indent = len(line) - len(line.lstrip())

        if PYTHON_CONTROL_FLOW.match(line):
            # Count nesting level based on indent relative to control flow blocks
            current_depth = indent // 4 + 1  # rough approximation
            max_depth = max(max_depth, current_depth)

    return max_depth


def _detect_max_nesting(content: str, language: str | None = None) -> int:
    if language == "python":
        return _detect_max_control_flow_nesting_python(content)
    return _detect_max_control_flow_nesting(content)
