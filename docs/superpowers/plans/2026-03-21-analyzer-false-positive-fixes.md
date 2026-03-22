# Analyzer False Positive Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three categories of false positives discovered from real user flags: file size counting comments, Python nesting counting framework layout blocks, and nesting depth accuracy.

**Architecture:** All changes are in the scoring-service analyzers. No frontend or API changes needed. Each fix is isolated to one analyzer function with corresponding test updates.

**Tech Stack:** Python, pytest

---

### Task 1: File size analyzer — count code lines, not raw lines

The god file check uses `file.loc` which counts ALL lines including comments, docstrings, and blanks. A 759-line file with 386 lines of code and 261 lines of docstrings shouldn't be flagged the same as a 759-line file of pure logic.

**Files:**
- Modify: `scoring-service/tools/analyzers/code_structure.py` (god file check ~line 118)
- Modify: `scoring-service/tests/test_analyzers.py` (TestCodeStructure class)

- [ ] **Step 1: Write failing test — well-documented file under code-line threshold**

Add to `TestCodeStructure` in `scoring-service/tests/test_analyzers.py`:

```python
def test_skips_well_documented_file_under_code_threshold(self):
    """Files with lots of comments/docstrings shouldn't be flagged if code lines are under threshold."""
    code_lines = [f"const line{i} = {i};" for i in range(200)]
    comment_lines = [f"// This documents line {i}" for i in range(200)]
    blank_lines = [""] * 100
    # 500 total lines but only 200 are code
    content = "\n".join(code_lines + comment_lines + blank_lines)
    file = _make_file("well-documented.ts", content)
    findings = analyze_code_structure([file])
    god_findings = [f for f in findings if "large" in f["issue"].lower()]
    assert len(god_findings) == 0
```

- [ ] **Step 2: Write failing test — Python file with docstrings**

```python
def test_skips_python_file_heavy_on_docstrings(self):
    """Python files with extensive docstrings shouldn't be penalized."""
    methods = []
    for i in range(30):
        methods.append(f'    def method_{i}(self):\n        """\n        This is a detailed docstring\n        explaining what method_{i} does.\n        Args:\n            none\n        Returns:\n            int\n        """\n        return {i}')
    content = "class MyAPI:\n" + "\n\n".join(methods)
    file = ScannedFile(
        path="api.py", extension=".py", language="python",
        loc=len(content.splitlines()), content=content, is_test=False,
    )
    findings = analyze_code_structure([file])
    god_findings = [f for f in findings if "large" in f["issue"].lower()]
    assert len(god_findings) == 0
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py::TestCodeStructure::test_skips_well_documented_file_under_code_threshold tests/test_analyzers.py::TestCodeStructure::test_skips_python_file_heavy_on_docstrings -v`
Expected: FAIL — current code uses raw `file.loc`

- [ ] **Step 4: Add `_count_code_lines` helper to code_structure.py**

Add after the `_is_data_file` function:

```python
def _count_code_lines(content: str, language: str | None = None) -> int:
    """Count lines of actual code, excluding comments, docstrings, and blanks."""
    lines = content.splitlines()
    code_count = 0
    in_block_comment = False
    in_docstring = False
    docstring_delimiter = None

    for line in lines:
        stripped = line.strip()

        # Skip blank lines
        if not stripped:
            continue

        # Python docstrings (triple quotes)
        if language == "python":
            if not in_docstring:
                if stripped.startswith('"""') or stripped.startswith("'''"):
                    docstring_delimiter = stripped[:3]
                    # Single-line docstring: """text"""
                    if stripped.count(docstring_delimiter) >= 2 and stripped.endswith(docstring_delimiter) and len(stripped) > 3:
                        continue
                    in_docstring = True
                    continue
            else:
                if docstring_delimiter and docstring_delimiter in stripped:
                    in_docstring = False
                    docstring_delimiter = None
                continue

        if in_docstring:
            continue

        # Block comments (JS/TS/Java/C-style)
        if not in_block_comment:
            if stripped.startswith('/*'):
                if '*/' in stripped:
                    continue  # Single-line block comment
                in_block_comment = True
                continue
        else:
            if '*/' in stripped:
                in_block_comment = False
            continue

        # Single-line comments
        if stripped.startswith('//') or stripped.startswith('#'):
            continue

        code_count += 1

    return code_count
```

- [ ] **Step 5: Update god file check to use code lines**

In `analyze_code_structure`, change the god file check (~line 118) from:

```python
if file.loc > GOD_FILE_THRESHOLD and not _is_data_file(file) and not file.is_barrel:
    severity, context = _god_file_severity(file.loc)
```

to:

```python
if file.loc > GOD_FILE_THRESHOLD and not _is_data_file(file) and not file.is_barrel:
    code_lines = _count_code_lines(file.content, file.language)
    if code_lines <= GOD_FILE_THRESHOLD:
        continue
    severity, context = _god_file_severity(code_lines)
```

Also update the finding message and evidence to reference code lines:

```python
    findings.append({
        "dimension": "code_structure",
        "severity": severity,
        "file": file.path,
        "line": None,
        "issue": f"Large file ({code_lines} code lines, {file.loc} total) — {context}",
        "evidence": f"{code_lines} code lines (of {file.loc} total), threshold is {GOD_FILE_THRESHOLD}",
        "fix_prompt": f"{file.path} has {code_lines} lines of code ({file.loc} total). Break it into smaller, focused modules. Each file should have one clear responsibility.",
    })
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py::TestCodeStructure -v`
Expected: ALL PASS (new tests pass, existing tests still pass)

- [ ] **Step 7: Commit**

```bash
git add scoring-service/tools/analyzers/code_structure.py scoring-service/tests/test_analyzers.py
git commit -m "fix(code_structure): count code lines only for god file detection

Files heavy on comments/docstrings no longer flagged as god files when
actual code lines are under threshold. Reported line counts now show both
code lines and total lines for transparency."
```

---

### Task 2: Python nesting — exclude framework layout `with` blocks

Streamlit's `with st.sidebar:`, `with st.expander():`, `with st.container():` etc. are layout containers, not control flow. The Python nesting detector currently counts all `with` statements as control flow, inflating depth for UI framework code.

**Files:**
- Modify: `scoring-service/tools/analyzers/code_structure.py` (`PYTHON_CONTROL_FLOW` pattern and `_detect_max_control_flow_nesting_python`)
- Modify: `scoring-service/tests/test_analyzers.py` (TestCodeStructure class)

- [ ] **Step 1: Write failing test — Streamlit layout nesting**

Add to `TestCodeStructure`:

```python
def test_python_nesting_ignores_streamlit_layout(self):
    """Streamlit with-blocks (st.sidebar, st.expander, st.container) are layout, not control flow."""
    content = """import streamlit as st

def main():
    with st.sidebar:
        query = st.text_input("Search")
        if query:
            with st.spinner("Loading..."):
                results = search(query)
                if results:
                    with st.expander("Citations"):
                        for cite in results:
                            st.write(cite)
"""
    file = ScannedFile(
        path="app.py", extension=".py", language="python",
        loc=len(content.splitlines()), content=content, is_test=False,
    )
    findings = analyze_code_structure([file])
    nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
    # Only 3 real control flow levels: if > if > for
    # The 3 with-blocks are Streamlit layout, not control flow
    assert len(nesting_findings) == 0
```

- [ ] **Step 2: Write failing test — real `with` (file/resource) still counts**

```python
def test_python_nesting_counts_resource_with_blocks(self):
    """Resource management with-blocks (open(), lock, connection) ARE control flow."""
    content = """def process():
    with open("file.txt") as f:
        for line in f:
            if line.strip():
                with db.transaction():
                    if validate(line):
                        if save(line):
                            log(line)
"""
    file = ScannedFile(
        path="processor.py", extension=".py", language="python",
        loc=len(content.splitlines()), content=content, is_test=False,
    )
    findings = analyze_code_structure([file])
    nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
    # 6 levels: with > for > if > with > if > if
    assert len(nesting_findings) > 0
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py::TestCodeStructure::test_python_nesting_ignores_streamlit_layout tests/test_analyzers.py::TestCodeStructure::test_python_nesting_counts_resource_with_blocks -v`
Expected: First test FAILS (Streamlit `with` blocks counted as nesting). Second test should PASS already.

- [ ] **Step 4: Add UI framework layout detection**

Add after `PYTHON_CONTROL_FLOW` in `code_structure.py`:

```python
# UI framework layout with-blocks that impose indentation but aren't control flow
# Streamlit: st.sidebar, st.container, st.expander, st.columns, st.tabs, st.spinner, etc.
# Gradio: gr.Row, gr.Column, gr.Blocks, gr.Tab, etc.
PYTHON_LAYOUT_WITH = re.compile(
    r'^\s*with\s+(?:st\.|gr\.|col\d|tab\d)',
    re.IGNORECASE,
)
```

- [ ] **Step 5: Update `_detect_max_control_flow_nesting_python` to skip layout `with`**

Change the control flow detection block (~line 267) from:

```python
        if PYTHON_CONTROL_FLOW.match(line):
            cf_indent_stack.append(indent)
            max_depth = max(max_depth, len(cf_indent_stack))
```

to:

```python
        if PYTHON_CONTROL_FLOW.match(line):
            # Skip UI framework layout with-blocks (Streamlit, Gradio)
            if PYTHON_LAYOUT_WITH.match(line):
                continue
            cf_indent_stack.append(indent)
            max_depth = max(max_depth, len(cf_indent_stack))
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py::TestCodeStructure -v`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add scoring-service/tools/analyzers/code_structure.py scoring-service/tests/test_analyzers.py
git commit -m "fix(code_structure): exclude Streamlit/Gradio layout blocks from nesting depth

UI framework with-blocks (st.sidebar, st.expander, gr.Row, etc.) are
layout containers that impose indentation but aren't control flow.
No longer counted toward nesting depth."
```

---

### Task 3: Investigate and fix nesting depth accuracy

The piragi flags reported 6-7 levels but manual inspection found 8-9. Either the code changed between analysis and inspection, or the counter has a bug. Need to verify with a controlled test.

**Files:**
- Modify: `scoring-service/tools/analyzers/code_structure.py` (if bug found)
- Modify: `scoring-service/tests/test_analyzers.py`

- [ ] **Step 1: Write test with known exact nesting depth**

Add to `TestCodeStructure`:

```python
def test_python_nesting_depth_accuracy(self):
    """Verify the counter reports exact depth, not an undercount."""
    # Exactly 6 levels of control flow nesting
    content = """def process(items):
    for item in items:
        if item.valid:
            try:
                if item.type == 'a':
                    for sub in item.children:
                        if sub.active:
                            handle(sub)
            except Exception:
                pass
"""
    file = ScannedFile(
        path="deep.py", extension=".py", language="python",
        loc=len(content.splitlines()), content=content, is_test=False,
    )
    findings = analyze_code_structure([file])
    nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
    assert len(nesting_findings) > 0
    # Should report exactly 6 levels (for > if > try > if > for > if)
    depth_match = re.search(r'\((\d+) levels\)', nesting_findings[0]["issue"])
    assert depth_match, f"Could not parse depth from: {nesting_findings[0]['issue']}"
    assert int(depth_match.group(1)) == 6
```

Add `import re` at top of test file if not already there.

- [ ] **Step 2: Write test for JS/TS nesting depth accuracy**

```python
def test_js_nesting_depth_accuracy(self):
    """Verify JS/TS counter reports exact depth."""
    # Exactly 5 levels of control flow
    content = """if (a) {
  for (let i = 0; i < n; i++) {
    if (b) {
      try {
        if (c) {
          doSomething();
        }
      } catch (e) {
        handle(e);
      }
    }
  }
}"""
    file = _make_file("deep.ts", content)
    findings = analyze_code_structure([file])
    nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
    assert len(nesting_findings) > 0
    depth_match = re.search(r'\((\d+) levels\)', nesting_findings[0]["issue"])
    assert depth_match, f"Could not parse depth from: {nesting_findings[0]['issue']}"
    assert int(depth_match.group(1)) == 5
```

- [ ] **Step 3: Run tests to check accuracy**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py::TestCodeStructure::test_python_nesting_depth_accuracy tests/test_analyzers.py::TestCodeStructure::test_js_nesting_depth_accuracy -v`

If tests PASS: counter is accurate, the piragi discrepancy was due to code changes between analysis time and our inspection. Skip to step 5.

If tests FAIL: the counter has a bug. Investigate the output and fix the counter logic, then re-run.

- [ ] **Step 4: Fix counter if needed (conditional)**

Depends on step 3 results. If the Python counter undercounts, likely issue is in how `cf_indent_stack` handles `try/except` blocks (dedenting from try to except at same level may pop prematurely). If JS counter undercounts, likely the `}` matching is too aggressive.

- [ ] **Step 5: Run full test suite**

Run: `cd scoring-service && python -m pytest tests/ -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add scoring-service/tools/analyzers/code_structure.py scoring-service/tests/test_analyzers.py
git commit -m "test(code_structure): add nesting depth accuracy tests

Verifies counter reports exact depth for both Python and JS/TS.
[Include fix description if bug was found]"
```
