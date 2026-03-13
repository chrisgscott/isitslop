# False Positive Feedback System

## Problem

IsItSlop's static analyzers produce occasional false positives — e.g., Algolia public search keys flagged as hardcoded secrets, or e2e setup scripts flagged for generated test passwords. Users have no way to report these. Without a feedback loop, the same false positives recur and erode trust in the tool.

## Solution

A "Flag" button on each finding card that lets users report potential false positives. Flags are stored in a new Supabase table for periodic human review. Review findings inform analyzer improvements (new skip patterns, smarter heuristics).

No auto-suppression. No auth required. The feedback loop is human-in-the-loop: flags are signal, not votes.

## Database

New `finding_flags` table in Supabase (no RLS, no auth — consistent with existing project):

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `analysis_id` | `text` | References `analyses.id` (logical FK, no constraint) |
| `finding_index` | `integer` | Position in the **original unsorted** `receipts` JSONB array |
| `finding_issue` | `text` | Denormalized issue text |
| `finding_file` | `text nullable` | Denormalized file path (nullable — some findings have no file) |
| `finding_severity` | `text` | Denormalized severity |
| `dimension` | `text` | Which analyzer produced it |
| `reason` | `text nullable` | Optional free-text from user, max 500 characters |
| `ip_hash` | `text` | SHA-256 of requester IP |
| `created_at` | `timestamptz` | Default `now()` |

Unique constraint on `(analysis_id, finding_index, ip_hash)` — one flag per finding per IP. Duplicate attempts return `200` with `{ "already_flagged": true }`.

Denormalized fields allow reviewing flags without joining to the analyses table. The `ip_hash` is for rate limiting and dedup only, not user tracking.

```sql
CREATE TABLE finding_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id text NOT NULL,
  finding_index integer NOT NULL,
  finding_issue text NOT NULL,
  finding_file text,
  finding_severity text NOT NULL,
  dimension text NOT NULL,
  reason text CHECK (char_length(reason) <= 500),
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, finding_index, ip_hash)
);

CREATE INDEX idx_finding_flags_analysis ON finding_flags (analysis_id);
CREATE INDEX idx_finding_flags_dimension ON finding_flags (dimension);
CREATE INDEX idx_finding_flags_created ON finding_flags (created_at DESC);
```

## API Route

`POST /api/flag`

### Request Body

```json
{
  "analysis_id": "0Tiwrj2sGv",
  "finding_index": 3,
  "reason": "This is a public Algolia search key, not a secret"
}
```

- `analysis_id` (required): must reference an existing `analyses` record with status `complete`
- `finding_index` (required): must be a valid index in the **original unsorted** `receipts` array
- `reason` (optional): free-text explanation, max 500 characters

### Behavior

1. Validate `analysis_id` exists and has status `complete`
2. Validate `finding_index` is within bounds of the `receipts` array
3. Validate `reason` is <= 500 characters (if provided)
4. Pull finding data from `receipts[finding_index]` to denormalize into the flag record
5. Hash requester IP with SHA-256
6. Check rate limit: 10 flags per IP per hour
7. Insert into `finding_flags` (unique constraint handles dedup — on conflict, return success with `already_flagged`)

### Responses

- `201` — flag created
- `200` — already flagged (`{ "already_flagged": true }`)
- `400` — invalid input, with `error` field distinguishing: `"analysis_not_found"`, `"finding_index_out_of_range"`, `"reason_too_long"`
- `429` — rate limit exceeded

### Rate Limiting

Creates a new `RateLimiter` instance with its own pool. The existing rate-limit module (`src/lib/rate-limit.ts`) will be refactored to export a factory function that accepts `{ maxRequests, windowMs }` config, rather than using module-level constants. Both `/api/analyze` (20/hour) and `/api/flag` (10/hour) will use separate instances from the same factory.

## Frontend

### Finding Index Tracking

The `FindingsList` component sorts findings by severity before rendering. To maintain a stable reference to each finding's original position in the `receipts` array, each finding will be annotated with its original index before sorting:

```typescript
const indexed = findings.map((f, i) => ({ ...f, originalIndex: i }))
const sorted = [...indexed].sort(...)
```

The `originalIndex` is passed to each `FixPromptCard` and used in the flag API call. This ensures the API always references the correct finding regardless of display order.

### Finding Card (`fix-prompt-card.tsx`)

The "Copy Fix" button is replaced with a "Flag" button. The per-finding copy is redundant with the "Copy Report Card" button which copies all findings.

**Default state:** "Flag" button in the same position and style as the former "Copy Fix" button. If localStorage has `flag:${analysisId}:${originalIndex}`, show "Flagged" in disabled state instead.

**After clicking "Flag":** A reason input + "Submit" button slides in below the fix prompt container:
- Input has a white background to visually distinguish it as an editable field
- Placeholder text: "Why is this a false positive? (optional)"
- "Submit" button uses paper-dark background, matching card styling
- Input and button use the same mono font and sizing as the rest of the card

**After submitting:** Input area collapses, button changes to "Flagged — thanks" (disabled state). Sets localStorage key `flag:${analysisId}:${originalIndex}`.

**On error:** Brief inline message below the input:
- Rate limit: "Too many flags, try later"
- Other: "Something went wrong"

### Props Changes

`FixPromptCard` gains two new props:
- `analysisId: string` — for the flag API call and localStorage key
- `originalIndex: number` — the finding's position in the original receipts array

### Copy Report Button

No changes. Already copies all findings with fix prompts.

### No Other UI Changes

The flag interaction is entirely contained within the finding card component.

## Review Workflow

Not built as part of this feature. The table is designed for easy ad-hoc querying:

```sql
-- Recent flags
SELECT * FROM finding_flags ORDER BY created_at DESC;

-- Most-flagged patterns (find systematic false positives)
SELECT finding_issue, dimension, COUNT(*)
FROM finding_flags
GROUP BY finding_issue, dimension
ORDER BY count DESC;

-- Flags for a specific analyzer
SELECT * FROM finding_flags WHERE dimension = 'security';

-- Flags for a specific analysis
SELECT * FROM finding_flags WHERE analysis_id = '0Tiwrj2sGv';
```

A scheduled job will be set up separately to pull and review flags.

## What This Does Not Include

- No auto-suppression of flagged findings
- No user accounts or authentication
- No admin UI for reviewing flags
- No batch flagging (flag multiple findings at once)
- No "community flagged" badges on findings

These can be added later if the volume of flags warrants it.
