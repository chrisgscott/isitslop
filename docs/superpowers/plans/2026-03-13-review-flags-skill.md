# Review Flags Skill Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Claude Code skill that reviews user-submitted false positive flags, inspects the actual repo code, and auto-applies analyzer fixes for confirmed false positives.

**Architecture:** A skill file (`~/.claude/skills/review-flags/SKILL.md`) containing detailed instructions for the review workflow. A database migration adds a `reviewed_at` column to `finding_flags`. The skill uses Supabase MCP to query flags, curl to download repos, and directly edits analyzer Python files + tests.

**Tech Stack:** Claude Code skill (markdown), Supabase (Postgres via MCP), Python (analyzers + tests), GitHub API (tarball download)

**Spec:** `docs/superpowers/specs/2026-03-13-review-flags-skill-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `~/.claude/skills/review-flags/SKILL.md` | Skill instructions — the full review workflow |
| Migrate | `finding_flags` table (Supabase) | Add `reviewed_at` column |

---

## Chunk 1: Database Migration + Skill File

### Task 1: Add `reviewed_at` column to `finding_flags`

**Files:**
- Migrate: `finding_flags` table in Supabase (project ID: `bufdtvslivshzjpiyfzn`)

- [ ] **Step 1: Run migration**

Execute via Supabase MCP `execute_sql`:

```sql
ALTER TABLE finding_flags ADD COLUMN reviewed_at timestamptz;
```

- [ ] **Step 2: Verify column exists**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'finding_flags' AND column_name = 'reviewed_at';
```

Expected: One row — `reviewed_at`, `timestamp with time zone`, `YES`.

---

### Task 2: Create the skill file

**Files:**
- Create: `~/.claude/skills/review-flags/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p ~/.claude/skills/review-flags
```

- [ ] **Step 2: Write the skill file**

Create `~/.claude/skills/review-flags/SKILL.md` with the following content:

````markdown
---
version: 1
name: review-flags
description: >
  Review user-submitted false positive flags on IsItSlop. Use when the user says
  "review flags," "check flagged findings," "process false positives," "review-flags,"
  or wants to inspect and fix analyzer false positives reported by users.
---

# Review Flags — IsItSlop False Positive Review

Review user-submitted false positive flags, inspect the actual repo code, and auto-apply analyzer fixes for confirmed false positives.

## Prerequisites

- Supabase MCP server must be connected (project ID: `bufdtvslivshzjpiyfzn`)
- Working directory should be the isitslop project root: `/Users/chrisgscott/projects/scratch/isitslop`
- Python environment available for running scoring-service tests

## Workflow

### Step 1: Pull Unreviewed Flags

Query via Supabase MCP `execute_sql`:

```sql
SELECT ff.*, a.repo_owner, a.repo_name, a.repo_branch, a.receipts
FROM finding_flags ff
JOIN analyses a ON a.id = ff.analysis_id
WHERE ff.reviewed_at IS NULL
ORDER BY ff.created_at ASC;
```

If no results, report "No unreviewed flags" and stop.

Group the results by `(dimension, finding_issue)` to batch identical patterns. Report the count: "Found N unreviewed flags across M unique patterns."

### Step 2: Process Each Pattern Group

For each unique `(dimension, finding_issue)` group:

#### 2a. Select Representative Flag

Pick the flag with the most useful `reason` field (non-null, longest). Extract:
- `analysis_id`, `finding_index`, `finding_issue`, `finding_file`, `finding_severity`, `dimension`
- `reason` (user's explanation)
- `repo_owner`, `repo_name`, `repo_branch` (from the joined analyses row)
- Line number: the `receipts` column is `jsonb` in Postgres. Parse the JSON array and access `receipts[finding_index].line` (may be `null` for some findings). You can extract it in the SQL query directly: `a.receipts->ff.finding_index->>'line'`, or parse the full `receipts` JSON after fetching.

#### 2b. Download the Repo

```bash
TEMP_DIR=$(mktemp -d)
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
AUTH_HEADER=""
if [ -n "$GITHUB_TOKEN" ]; then
  AUTH_HEADER="-H \"Authorization: token $GITHUB_TOKEN\""
fi
curl -sL $AUTH_HEADER "https://api.github.com/repos/{repo_owner}/{repo_name}/tarball/{repo_branch}" | tar xz -C "$TEMP_DIR"
REPO_DIR=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)
```

The tarball extracts to a directory like `owner-repo-sha/`. The `REPO_DIR` variable holds the extracted path.

#### 2c. Inspect the Code

1. Read the flagged file from the downloaded repo at/around the flagged line:
   - File path: `$TEMP_DIR/$REPO_DIR/{finding_file}`
   - Read ~20 lines around the flagged line for context

2. Read the relevant analyzer:
   - File: `scoring-service/tools/analyzers/{dimension}.py`
   - Understand the current skip logic and patterns

3. Determine if this is a genuine false positive. Consider:
   - **What does the flagged code actually do?** Is it truly benign?
   - **What did the user say?** Does their reason make sense?
   - **Can we skip this safely?** Is the pattern specific enough to not mask real issues?
   - **Is this a pattern or a one-off?** Patterns are worth fixing; one-offs may not be.

#### 2d. If NOT a False Positive — Reject

The finding is correct. No code changes needed. Skip to step 2f to mark the flags as reviewed, then move to the next pattern group.

#### 2e. If Confirmed False Positive — Apply Fix

Follow the existing conventions for the target analyzer:

| Analyzer | How to add skip logic |
|----------|----------------------|
| `security.py` | Add to regex constants (`SETUP_SCRIPT_PATTERNS`, `PUBLIC_KEY_CONTEXTS`, `SHELL_VARIABLE`) or add a new helper function following the pattern of `_is_setup_or_test_script()`, `_is_public_key_context()`, `_is_shell_variable_value()` |
| `code_structure.py` | Add to `DATA_PATH_PATTERNS`, `FRAMEWORK_CONVENTIONS`, or extend `_is_data_file()`. For nesting: extend JSX/config detection in the nesting analysis section |
| `error_handling.py` | Extend `_match_is_in_string()` or add file-level/pattern-level skip conditions |
| `dependencies.py` | Update duplicate purpose groups or adjust threshold logic |
| `documentation.py` | Update heuristic checks for readme content |
| `test_coverage.py` | Update ratio thresholds or skip conditions |

**Then write a test** in `scoring-service/tests/test_analyzers.py`:
- Create a `ScannedFile` or `ScanResult` that reproduces the false positive scenario
- Assert the analyzer produces no findings for that scenario
- Follow existing test patterns in the file (see `TestSecurity`, `TestCodeStructure`, etc.)

**Run the tests:**
```bash
cd scoring-service && python -m pytest tests/test_analyzers.py -v
```
All tests must pass (both new and existing).

**Re-run the analyzer against the downloaded repo** to verify the fix works in context:
```bash
cd scoring-service && python -c "
from tools.file_scanner import scan_directory
from tools.analyzers.{dimension} import analyze_{dimension}
result = scan_directory('$TEMP_DIR/$REPO_DIR')
# For file-based analyzers (security, code_structure, error_handling):
findings = analyze_{dimension}(result.files)
# For result-based analyzers (test_coverage, documentation, dependencies):
# findings = analyze_{dimension}(result)
flagged = [f for f in findings if f['issue'] == '{finding_issue}']
print(f'Remaining matches: {len(flagged)}')
assert len(flagged) == 0, 'Fix did not resolve the false positive!'
print('Verified: finding no longer appears.')
"
```

#### 2f. Mark Flags as Reviewed

Whether confirmed or rejected, mark all flags in this pattern group:

```sql
UPDATE finding_flags
SET reviewed_at = now()
WHERE dimension = '{dimension}'
  AND finding_issue = '{finding_issue}'
  AND reviewed_at IS NULL;
```

#### 2g. Clean Up

```bash
rm -rf "$TEMP_DIR"
```

### Step 3: Commit Changes

If any analyzer fixes were applied:

```bash
cd /Users/chrisgscott/projects/scratch/isitslop
git add scoring-service/tools/analyzers/ scoring-service/tests/test_analyzers.py
git commit -m "fix: address false positive flags — {brief description of patterns fixed}"
```

### Step 4: Summary

Print a summary table:

```
## Flag Review Summary

| Pattern | Dimension | Count | Verdict |
|---------|-----------|-------|---------|
| {issue} | {dim}     | N     | ✅ Fixed / ❌ Valid finding |

**Total:** N patterns reviewed, X confirmed false positives (fixed), Y valid findings
```

If any fixes were applied, print:

> **Deploy when ready:** `cd scoring-service && modal deploy modal_app.py`

## Important Notes

- **Never suppress real issues.** When adding skip patterns, make them as specific as possible. A skip for "Algolia keys in docusaurus configs" is good. A skip for "all API keys in config files" is dangerous.
- **One fix at a time.** Process each pattern group fully (fix → test → verify) before moving to the next. Don't batch fixes across pattern groups.
- **Test the existing tests too.** When adding a new skip pattern, make sure existing tests still catch the things they're supposed to catch. Run the full test suite, not just the new test.
- **The user's reason is a hint, not gospel.** Users may flag things for the wrong reason, or a finding may be correct even if the user disagrees. Use your judgment based on the actual code.
````

- [ ] **Step 3: Verify the skill is discoverable**

The skill should appear in the available skills list. Verify by checking:
```bash
ls ~/.claude/skills/review-flags/SKILL.md
```

- [ ] **Step 4: Note on version control**

The skill file lives at `~/.claude/skills/review-flags/SKILL.md`, outside the isitslop repo. It is not tracked in git — it stands on its own as a local Claude Code skill. No commit needed for the skill file itself. The spec and plan docs are already committed to the repo.

---

### Task 3: End-to-end verification

- [ ] **Step 1: Invoke the skill**

Run `/review-flags` in Claude Code. It should:
1. Query `finding_flags` for unreviewed flags
2. Find the existing test flag (from our earlier testing)
3. Process it through the workflow

- [ ] **Step 2: Verify the flag was marked as reviewed**

```sql
SELECT id, finding_issue, reviewed_at
FROM finding_flags
ORDER BY created_at DESC
LIMIT 5;
```

Expected: The test flag should have `reviewed_at` set.

- [ ] **Step 3: Commit plan doc**

```bash
cd /Users/chrisgscott/projects/scratch/isitslop
git add docs/superpowers/plans/2026-03-13-review-flags-skill.md
git commit -m "Add implementation plan: review-flags skill"
```
