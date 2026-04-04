# LLM Finding Reviewer

**Date:** 2026-04-03
**Status:** Approved

## Problem

The God file detector uses a pure LOC threshold (400 code lines) as a proxy for "file does too much." This creates false positives on large-but-cohesive files (a single-purpose parser, a pricing calculator) and misses small files with low cohesion (300 lines touching auth, email, database, and routing). The real signal is cohesion, not length -- but cohesion requires semantic judgment that a deterministic analyzer can't fully provide.

The nightly stress test already performs exactly this kind of LLM-assisted review externally: it runs deterministic analyzers, then uses an LLM to classify findings as legitimate or false positive. This design brings that same review pattern into the analysis pipeline itself.

## Approach

Add a single LLM review pass between the analyzer stage and scoring stage in the pipeline. The review annotates borderline findings with a disposition ("confirm" or "likely_false_positive") and a reason. It does not change scores -- annotations are metadata for the UI and verdict writer.

### Why annotation-only (no score changes)

- Deterministic scores stay reproducible across runs
- Builds trust in the annotations before giving them scoring power
- Can always add a toggle later ("strict" vs "reviewed" scoring)

### Why a separate call (not bundled into verdict)

- The verdict writer mixes creative writing with structured judgment -- hard to tune independently
- The verdict only sees top 10 findings; borderline findings often aren't in that set
- Parsing structured JSON from a creative-writing prompt is fragile

## Architecture

### Pipeline integration

```
analyzers -> review_borderline_findings() -> calculate_scores() -> generate_verdict()
                    ^                              |                      |
                    |                              |                      |
              NEW MODULE                     UNCHANGED              CAN REFERENCE
           (finding_reviewer.py)                                  llm_review ANNOTATIONS
```

In `pipeline.py`, between the analyzer runs and `calculate_scores`:

```python
findings = review_borderline_findings(findings, scan.files)
```

### New module: `tools/finding_reviewer.py`

**Public function:**

```python
def review_borderline_findings(
    findings: list[dict],
    files: list[ScannedFile],
) -> list[dict]
```

Takes the full findings list and scanned files. Returns the same list with `llm_review` annotations added to borderline findings. Non-borderline findings are untouched.

**Graceful degradation:** If `OPENAI_API_KEY` is missing, the LLM call fails, or JSON parsing fails, return findings unchanged. Log the error. No new failure modes for the pipeline.

### Borderline filter

A finding is borderline if:
- Severity is `low` (any dimension), OR
- Severity is `medium` AND dimension is `code_structure`

Everything else (high, critical, medium in non-code_structure dimensions) skips review.

Findings with `file: None` (e.g., duplicate-file findings) are excluded from review -- there's no single file to extract a structural summary from.

If zero findings are borderline after filtering, skip the LLM call entirely.

### Structural summary extractor

```python
def _extract_structural_summary(file: ScannedFile) -> dict
```

Regex-based, no AST. Extracts per-file:

- **imports**: list of import path strings
  - Python: `import x`, `from x import y`
  - JS/TS: `import ... from 'x'`, `require('x')`
  - Go: `import "x"`
- **exports**: list of top-level public symbol names
  - JS/TS: `export function X`, `export const X`, `export class X`, `export default`
  - Python: top-level `def` and `class` at indent 0
  - Go: capitalized top-level `func` and `type`
- **import_count**: len(imports)
- **export_count**: len(exports)
- **domain_buckets**: set of category labels from keyword matching on import paths
- **domain_bucket_count**: len(domain_buckets)

**Domain keyword dictionary:**

```python
DOMAIN_KEYWORDS = {
    "data": ["db", "database", "prisma", "drizzle", "sql", "mongo", "redis", "orm"],
    "auth": ["auth", "session", "jwt", "oauth", "passport"],
    "messaging": ["email", "smtp", "sendgrid", "mailgun", "notification", "push"],
    "http": ["express", "fastify", "router", "middleware", "handler", "endpoint"],
    "ui": ["react", "vue", "svelte", "component", "render", "dom", "css"],
    "storage": ["s3", "blob", "upload", "file", "stream"],
    "payment": ["stripe", "billing", "payment", "subscription"],
}
```

Does not need to be exhaustive. Gives the LLM real signal beyond bare filenames.

### LLM prompt

**System message:**

```
You review code analysis findings to identify likely false positives.
You receive borderline findings with structural metadata about each file.
Your job: determine if each finding reflects a real problem or if the
analyzer was too aggressive.

Respond with a JSON array. Each element:
{"finding_index": 0, "disposition": "confirm" or "likely_false_positive", "reason": "one sentence"}

Do not invent new findings. Do not comment on findings not listed.
If unsure, confirm the finding -- err toward the analyzer being right.
```

**User message:** Numbered list of borderline findings, each with:
- Dimension, severity, issue text
- File path
- Evidence string
- Structural summary (imports, exports, domain buckets) inline

**LLM config:**
- Model: `gpt-4.1-mini` (same as verdict writer -- one provider, one API key)
- Temperature: 0 (consistency over creativity)
- No retry on failure

**Token estimate:** 100-150 tokens per finding+summary input. Typical analysis flags 5-15 borderline findings. Total: 750-2250 input tokens, 200-500 output tokens. Well under $0.01/analysis.

### Finding annotation format

Borderline findings that get reviewed have an `llm_review` key added:

```python
{
    "dimension": "code_structure",
    "severity": "low",
    "file": "src/pricing/calculator.ts",
    "issue": "Large file (420 code lines) -- barely over threshold",
    "evidence": "420 code lines (of 510 total), threshold is 400",
    "fix_prompt": "...",
    "llm_review": {
        "disposition": "likely_false_positive",
        "reason": "File imports only from pricing domain, all exports serve invoice calculation"
    }
}
```

Findings without review have no `llm_review` key. Downstream consumers check for its presence.

### Verdict writer integration

The verdict prompt already receives top findings. If any have `llm_review`, append that context to the finding line in the prompt:

```
- [LOW] Large file (420 code lines) (src/pricing/calculator.ts)
  [REVIEWER NOTE: likely false positive -- File imports only from pricing domain]
```

The teacher persona can reference this naturally. No changes to the verdict system prompt needed.

### Storage

No schema changes. Findings are stored as a JSON array in Supabase. The `llm_review` key serializes naturally as part of the finding dict.

## Testing strategy

- Unit tests for `_extract_structural_summary` with fixtures per language (JS/TS, Python, Go)
- Unit tests for the borderline filter logic
- Unit test for prompt building (given findings + summaries, verify prompt format)
- Unit test for response parsing (valid JSON, malformed JSON, empty response)
- Unit test for graceful degradation (missing API key, API error, timeout)
- Integration test: mock the OpenAI call, verify findings come back with annotations
- No need to test LLM judgment quality in unit tests -- that's what the stress test is for

## Relationship to the nightly stress test

The stress test and the finding reviewer serve different scopes:

- **Finding reviewer (this feature):** Contextual review for one repo at analysis time. Annotations are repo-specific.
- **Stress test:** Finds systemic false positive patterns across many repos. Produces permanent skip-pattern fixes in the analyzers.

The stress test keeps running. Over time, patterns the reviewer consistently flags as false positives become candidates for deterministic skip patterns -- the reviewer identifies them, the stress test codifies them.

## Future considerations (not in scope)

- Toggle between "strict score" (deterministic only) and "reviewed score" (LLM-adjusted) in the UI
- Using the structural summary for a deterministic cohesion composite score alongside LOC
- Expanding the domain keyword dictionary based on stress test data
