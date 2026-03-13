# Review Flags Skill

## Problem

IsItSlop's static analyzers produce false positives. Users can now flag these via the "Not a real issue?" button, but flags accumulate in a database table with no review process. Without a way to process flags and fix the underlying analyzer logic, the same false positives keep recurring.

## Solution

A Claude Code skill (`/review-flags`) that pulls unreviewed flags, downloads the flagged repos, inspects the actual code to confirm or reject each flag, auto-applies analyzer fixes for confirmed false positives, re-runs analysis to verify, and marks flags as reviewed.

On-demand only. No scheduling, no admin UI. Run it when you want to process accumulated flags.

## Database Change

Add `reviewed_at` column to the existing `finding_flags` table:

```sql
ALTER TABLE finding_flags ADD COLUMN reviewed_at timestamptz;
```

- `NULL` = unreviewed (skill queries these)
- Set to `now()` after processing, regardless of outcome (confirmed or rejected)
- No separate status column needed

## Skill Workflow

### 1. Pull Unreviewed Flags

Query via Supabase MCP:

```sql
SELECT *
FROM finding_flags
WHERE reviewed_at IS NULL
ORDER BY created_at ASC;
```

Group results by `(dimension, finding_issue)` to batch identical patterns. If no unreviewed flags exist, report that and exit.

### 2. For Each Pattern Group

Pick a representative flag — prefer one with a `reason` field populated, as user context helps with determination.

**Fetch analysis context:**
- Look up the analysis record: `SELECT repo_owner, repo_name, repo_branch, receipts FROM analyses WHERE id = $analysis_id`
- Recover the flagged line number from `receipts[finding_index].line` (the `finding_flags` table doesn't store the line, but the original receipts array does)

**Download the repo:**
- Download via GitHub tarball API using curl: `curl -L https://api.github.com/repos/{owner}/{repo}/tarball/{branch} -o repo.tar.gz`
- Use `GITHUB_TOKEN` from environment if available (unauthenticated requests are limited to 60/hour)
- Extract to a temp directory

**Inspect the code:**
- Read the flagged file at/around the line recovered from receipts
- Read the relevant analyzer's current skip logic (`scoring-service/tools/analyzers/{dimension}.py`)
- Determine: is this a genuine false positive? Consider:
  - The code context (what does the flagged line actually do?)
  - The user's reason (if provided)
  - Whether the pattern is specific enough to skip safely without masking real issues

### 3. If Confirmed False Positive

**Apply the fix** — extend the relevant analyzer's skip logic following its existing conventions:

| Analyzer | Fix pattern |
|----------|------------|
| `security.py` | Add to regex constants (`SETUP_SCRIPT_PATTERNS`, `PUBLIC_KEY_CONTEXTS`) or add new helper function |
| `code_structure.py` | Add to `DATA_PATH_PATTERNS`, `FRAMEWORK_CONVENTIONS`, or `_is_data_file()` logic |
| `error_handling.py` | Extend `_match_is_in_string()` or add file-level skip conditions |
| `dependencies.py` | Update duplicate purpose groups or threshold logic |
| `documentation.py` | Update heuristic checks |
| `test_coverage.py` | Update ratio thresholds or skip conditions |

**Write a test** — add a test case to `scoring-service/tests/test_analyzers.py` that:
- Reproduces the false positive scenario (creates a `ScannedFile` or `ScanResult` matching the flagged context)
- Asserts the analyzer produces no findings for that scenario

**Run tests:**
```bash
cd scoring-service && python -m pytest tests/test_analyzers.py -v
```
All tests must pass.

**Re-run analysis** — import and run the specific analyzer function against the downloaded repo files. Confirm the flagged finding no longer appears in the output. This is a local Python invocation, not a Modal or Supabase call.

**Mark flags reviewed:**
```sql
UPDATE finding_flags
SET reviewed_at = now()
WHERE dimension = '{dimension}' AND finding_issue = '{issue}' AND reviewed_at IS NULL;
```

Note: this batch UPDATE marks all flags with matching `(dimension, finding_issue)` as reviewed, even across different repos. This is intentional — if the pattern is a false positive, it's a false positive everywhere. In rare cases where the same issue text is a true positive in one repo and false in another, the fix's skip pattern should be specific enough to only suppress the genuinely benign case.

### 4. If Not a False Positive

Mark flags as reviewed (same UPDATE), no code changes. The finding was correct.

### 5. Summary

Print a summary:
- How many pattern groups reviewed
- How many confirmed as false positives (with analyzer changes made)
- How many rejected (finding was correct)
- Reminder to deploy scoring service to Modal if any fixes were applied

## Repo Download

Uses GitHub's tarball API via curl (the skill runs in Claude Code, not Modal). Downloads to a temp directory, extracts, inspects the relevant files, then cleans up. Uses `GITHUB_TOKEN` from the environment for authenticated requests if available (60/hour unauthenticated, 5000/hour authenticated).

Only the specific flagged file(s) need inspection, but the full tarball is downloaded because:
- It's a single HTTP request
- The analyzer may need surrounding context (imports, project structure)
- It matches what the scoring service sees during analysis

## Deployment

The skill does NOT auto-deploy to Modal. After applying fixes, it prints:

> "Analyzer fixes applied and verified. Deploy the scoring service to Modal when ready:
> `cd scoring-service && modal deploy modal_app.py`"

Deployment is a shared system action that warrants manual confirmation.

## Skill File

Located at `~/.claude/skills/review-flags/`. Standard Claude Code skill format with a markdown instruction file.

## What This Does Not Include

- No auto-deploy to Modal
- No admin UI for browsing flags
- No scheduled automation
- No flag voting, weighting, or community consensus
- No changes to the frontend or flag submission flow
- No batch re-analysis of all past analyses (only the specific flagged repo)
