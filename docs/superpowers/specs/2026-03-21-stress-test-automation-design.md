# IsItSlop Stress Test Automation — Design Spec

## Overview

A nightly Claude Code automation that self-improves the IsItSlop scoring engine. Each night it discovers GitHub repos, runs them through the analyzers locally, uses LLM reasoning to identify false positives, and auto-applies skip pattern fixes with test coverage. Fixes that break existing tests are reverted. A morning report is emailed with results and run cost.

Lives in `/Users/chrisgscott/projects/claude-automations/` alongside the other nightly automations, following the same conventions.

## Architecture

**Approach:** Two-phase single `claude -p` invocation.

- **Phase 1 — Discovery & Analysis:** Find 5-10 repos via GitHub search, download each via tarball, run the Python analyzers locally in the `scoring-service/` directory. No production API or database involved.
- **Phase 2 — Reasoning & Fixes:** For each finding, read the actual flagged code, reason about whether it's a real problem or false positive, apply skip pattern fixes where warranted, run the test suite as the gate.

**Why single invocation:** Fits the existing automation pattern (one prompt, one script, one plist). The prompt structures work into two phases internally for context management — process repos one at a time rather than loading everything at once.

## Deliverables

| File | Location | Purpose |
|------|----------|---------|
| `PROMPT.md` | `claude-automations/isitslop-stress-test/` | Agent prompt |
| `isitslop-stress-test.sh` | `claude-automations/scripts/` | Wrapper script |
| `com.chrisgscott.isitslop-stress-test.plist` | `~/Library/LaunchAgents/` | LaunchAgent schedule |
| `output/YYYY-MM-DD.md` | `claude-automations/isitslop-stress-test/output/` | Daily reports |

## Phase 1: Repo Discovery & Analysis

### Repo Selection

The agent uses `gh` CLI and/or web search to discover repos each night. No curated list — fully dynamic.

**Diversity targets per batch (5-10 repos):**
- Mix of languages/frameworks (React, Next.js, Python, Go, Rust, etc.)
- Mix of repo sizes (small utility libs, medium apps, large projects)
- Mix of maturity levels (popular well-maintained repos alongside newer ones)
- Bias toward repos with patterns that tend to trigger false positives: monorepos, framework-heavy apps, repos with generated code, repos with data fixtures

### Running Analysis

The agent runs analyzers locally — no production API calls:

1. Download repo via GitHub tarball API (same `repo_downloader.py` the scoring service uses)
2. Run the file scanner against the extracted repo
3. Run all 6 analyzers against the scanned files
4. Collect raw findings (file paths, evidence, severity, dimension)

This avoids polluting the production `analyses` table and is faster than polling a database for results.

## Phase 2: Reasoning & Fix Application

For each finding from each repo, the agent:

### Step 1 — Read the flagged code

Opens the actual file at the flagged line in the downloaded repo to understand context.

### Step 2 — Reason about legitimacy

Considers:
- Is this a well-known framework convention?
- Is this generated/vendored code the developer doesn't control?
- Is the "secret" actually a public key, test fixture, or example?
- Is the "god file" actually a data file, config, or migration?

### Step 3 — Classify the finding

- **Legitimate** — real problem, no change needed
- **False positive (pattern-fixable)** — can be fixed with a skip pattern → auto-apply
- **False positive (threshold-related)** — needs a threshold or weight change → log as recommendation only

### Step 4 — Apply fix (pattern-fixable only)

For confirmed false positives that can be fixed with a skip pattern:

1. Identify the relevant analyzer file in `scoring-service/tools/analyzers/`
2. Add a skip pattern (regex constant, helper function extension, or path pattern)
3. Write a test case in `scoring-service/tests/test_analyzers.py` that reproduces the false positive and verifies the skip
4. Run `python -m pytest tests/` in the scoring-service directory
5. **Tests pass** → keep the fix, commit to branch
6. **Any test fails** → revert the fix, log it with the failure reason for human review

### Scope Boundaries

The automation **only** modifies skip patterns in analyzers. It does **not**:
- Change thresholds (e.g., `GOD_FILE_THRESHOLD`, `DEEP_NESTING_THRESHOLD`)
- Change dimension weights in `scorer.py`
- Modify the verdict writer or any frontend code

Threshold and weight observations are logged as recommendations in the morning report.

## Branch Strategy

- Creates `auto/stress-test-YYYY-MM-DD` branch on the isitslop repo
- Each passing fix is committed individually with a descriptive message (e.g., `fix(security): skip Stripe publishable keys in secret detection`)
- Branch is not merged — left for human review
- If yesterday's branch was never merged, today's run creates a fresh branch anyway
- Old unmerged branches accumulate as signal about fix quality

## Morning Report

Written to `isitslop-stress-test/output/YYYY-MM-DD.md` and emailed via Resend.

### Report Structure

```markdown
# Stress Test Report — YYYY-MM-DD

## Summary
- Repos tested: N
- Total findings analyzed: N
- Legitimate findings: N
- False positives fixed: N
- False positives reverted (test failure): N
- Threshold recommendations: N

## Fixes Applied (branch: auto/stress-test-YYYY-MM-DD)
### 1. [analyzer].py — [description]
- **Repo:** owner/name
- **Finding:** "[issue]" in [file]
- **Reasoning:** [why this is a false positive]
- **Fix:** [what was changed]
- **Test added:** [test function name]

## Fixes Reverted
### 1. [analyzer].py — [description]
- **Failure:** [which test failed]
- **Reasoning:** [why the fix was too broad]
- **Action needed:** [suggestion for human]

## Threshold Recommendations
### 1. [CONSTANT_NAME] (currently [value])
- [observation from N repos]
- [suggested change or consideration]

## Repos Tested
| Repo | Score | Findings | False Positives |
|------|-------|----------|-----------------|

## Run Cost
- Tokens: N
- Cost: $N.NN
- Duration: Nm Ns
```

### Email Delivery

Sent via Resend API (same pattern as morning-briefing):
- **From:** `Stress Test <workflows@chrisgscott.me>`
- **To:** `chrisgscott@gmail.com`
- **Subject:** `IsItSlop Stress Test — N fixes applied, N reverted`
- **Body:** HTML-rendered version of the markdown report

## Operational Details

### Schedule

**1:00 AM** — after the overnight builder (12:15 AM) finishes.

### Budget

`--max-budget-usd 30.00` — higher than other automations due to processing 5-10 repos with code reading and reasoning. Adjust after observing actual costs over a few runs.

### Cost Tracking

The wrapper script captures Claude's usage summary from stdout (tokens, cost) and appends it to the report before emailing. This appears in both the saved markdown and the email for ROI tracking over time.

### Repo Cleanup

Downloaded repo tarballs and extracted directories are cleaned up at the end of the run to avoid disk bloat.

### Failure Handling

If the agent crashes mid-run (context limit, API failure, etc.):
- Wrapper script logs failure to `status.log`
- Partial fixes already committed to the branch are preserved
- Report covers whatever was completed before the crash

### Dependencies

Everything the agent needs is already available:
- `gh` CLI — GitHub repo discovery
- Python environment in `scoring-service/` — running analyzers locally
- Git — branching, committing on the isitslop repo
- Web search — discovering repos
- `RESEND_API_KEY` in `.env` — email delivery

No new API keys or services required.

## Relationship to Existing Systems

### vs. review-flags skill

The review-flags skill (specced in `2026-03-13-review-flags-skill-design.md`) processes **user-reported** false positives from the `finding_flags` table. This automation is **proactive** — it finds false positives on its own by testing against real repos. Both produce the same output (skip patterns + test cases in the analyzers), but from different inputs.

### vs. flag API

The flag API (`/api/flag`) collects user feedback. This automation doesn't use or interact with it. They're complementary — user flags catch false positives on repos users care about, the stress test catches false positives across the broader ecosystem.
