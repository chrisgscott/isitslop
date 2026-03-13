# False Positive Feedback Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users flag individual findings as false positives, store flags in Supabase for human review.

**Architecture:** New `finding_flags` table, new `POST /api/flag` route, refactored rate limiter to support multiple pools, and updated finding card UI replacing "Copy Fix" with "Flag" + inline reason input.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres), TailwindCSS, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-13-false-positive-feedback-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/rate-limit.ts` | Refactor to factory function supporting multiple pools |
| Modify | `src/app/api/analyze/route.ts` | Update import to use new factory |
| Create | `src/app/api/flag/route.ts` | POST endpoint for flagging findings |
| Modify | `src/components/fix-prompt-card.tsx` | Replace "Copy Fix" with "Flag" + reason input |
| Modify | `src/components/findings-list.tsx` | Track originalIndex, pass analysisId + originalIndex to cards |
| Modify | `src/app/r/[id]/page.tsx` | Pass analysisId to FindingsList |

---

## Chunk 1: Database + Rate Limiter + API Route

### Task 1: Create `finding_flags` table

**Files:**
- Database migration (Supabase SQL)

- [ ] **Step 1: Run migration SQL**

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

Run via Supabase MCP `execute_sql` or dashboard SQL editor.

- [ ] **Step 2: Verify table exists**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'finding_flags'
ORDER BY ordinal_position;
```

Expected: 10 columns matching the spec.

---

### Task 2: Refactor rate limiter to factory

**Files:**
- Modify: `src/lib/rate-limit.ts`
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Rewrite rate-limit.ts as a factory**

Replace the entire file with:

```typescript
interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export function createRateLimiter({ maxRequests, windowMs }: RateLimitConfig) {
  const requests = new Map<string, { count: number; resetAt: number }>()

  return function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now()
    const entry = requests.get(ip)

    if (!entry || now > entry.resetAt) {
      requests.set(ip, { count: 1, resetAt: now + windowMs })
      return { allowed: true, remaining: maxRequests - 1 }
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0 }
    }

    entry.count++
    return { allowed: true, remaining: maxRequests - entry.count }
  }
}

// Pre-configured instances
export const checkAnalyzeRateLimit = createRateLimiter({ maxRequests: 20, windowMs: 60 * 60 * 1000 })
export const checkFlagRateLimit = createRateLimiter({ maxRequests: 10, windowMs: 60 * 60 * 1000 })
```

- [ ] **Step 2: Update analyze route import**

In `src/app/api/analyze/route.ts`, change:

```typescript
// Before
import { checkRateLimit } from '@/lib/rate-limit'
// After
import { checkAnalyzeRateLimit } from '@/lib/rate-limit'
```

And update the usage on line 9:

```typescript
// Before
const { allowed, remaining } = checkRateLimit(ip)
// After
const { allowed, remaining } = checkAnalyzeRateLimit(ip)
```

- [ ] **Step 3: Verify the app still builds**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rate-limit.ts src/app/api/analyze/route.ts
git commit -m "refactor: rate limiter to factory supporting multiple pools"
```

---

### Task 3: Create POST /api/flag route

**Files:**
- Create: `src/app/api/flag/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/flag/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { checkFlagRateLimit } from '@/lib/rate-limit'

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { allowed } = checkFlagRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many flags. Try again in an hour.' },
      { status: 429 }
    )
  }

  let body: { analysis_id?: string; finding_index?: number; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { analysis_id, finding_index, reason } = body

  if (!analysis_id || finding_index === undefined || finding_index === null) {
    return NextResponse.json({ error: 'analysis_id and finding_index are required' }, { status: 400 })
  }

  if (typeof finding_index !== 'number' || finding_index < 0 || !Number.isInteger(finding_index)) {
    return NextResponse.json({ error: 'finding_index must be a non-negative integer' }, { status: 400 })
  }

  if (reason && reason.length > 500) {
    return NextResponse.json({ error: 'reason_too_long', message: 'Reason must be 500 characters or fewer' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch the analysis to validate and pull finding data
  const { data: analysis, error: fetchError } = await supabase
    .from('analyses')
    .select('status, receipts')
    .eq('id', analysis_id)
    .single()

  if (fetchError || !analysis) {
    return NextResponse.json({ error: 'analysis_not_found' }, { status: 400 })
  }

  if (analysis.status !== 'complete') {
    return NextResponse.json({ error: 'analysis_not_found' }, { status: 400 })
  }

  const receipts = analysis.receipts as Array<{
    dimension: string; severity: string; file: string | null; issue: string
  }> | null

  if (!receipts || finding_index >= receipts.length) {
    return NextResponse.json({ error: 'finding_index_out_of_range' }, { status: 400 })
  }

  const finding = receipts[finding_index]
  const ipHash = hashIp(ip)

  const { error: insertError } = await supabase
    .from('finding_flags')
    .insert({
      analysis_id,
      finding_index,
      finding_issue: finding.issue,
      finding_file: finding.file,
      finding_severity: finding.severity,
      dimension: finding.dimension,
      reason: reason || null,
      ip_hash: ipHash,
    })

  if (insertError) {
    // Unique constraint violation = already flagged
    if (insertError.code === '23505') {
      return NextResponse.json({ already_flagged: true }, { status: 200 })
    }
    console.error('Failed to insert flag:', insertError)
    return NextResponse.json({ error: 'Failed to save flag' }, { status: 500 })
  }

  return NextResponse.json({ flagged: true }, { status: 201 })
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/flag/route.ts
git commit -m "feat: add POST /api/flag endpoint for false positive reporting"
```

---

## Chunk 2: Frontend

### Task 4: Pass analysisId and originalIndex through component tree

**Files:**
- Modify: `src/app/r/[id]/page.tsx`
- Modify: `src/components/findings-list.tsx`

- [ ] **Step 1: Add analysisId prop to FindingsList**

In `src/app/r/[id]/page.tsx`, change:

```typescript
// Before
<FindingsList findings={analysis.receipts} />
// After
<FindingsList findings={analysis.receipts} analysisId={analysis.id} />
```

- [ ] **Step 2: Update FindingsList to track originalIndex and pass props**

Replace `src/components/findings-list.tsx` entirely:

```typescript
'use client'

import { motion } from 'motion/react'
import type { Finding } from '@/types/analysis'
import { FixPromptCard } from './fix-prompt-card'

interface FindingsListProps {
  findings: Finding[]
  analysisId: string
}

export function FindingsList({ findings, analysisId }: FindingsListProps) {
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const indexed = findings.map((f, i) => ({ ...f, originalIndex: i }))
  const sorted = [...indexed].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 1.8 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-ink-faint)]">
          Areas for Improvement
        </p>
        <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)]">
          ({findings.length})
        </span>
        <div className="flex-1 border-t border-[var(--color-paper-line)]" />
      </div>
      <div className="space-y-4">
        {sorted.map((finding) => (
          <FixPromptCard
            key={finding.originalIndex}
            finding={finding}
            analysisId={analysisId}
            originalIndex={finding.originalIndex}
          />
        ))}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 3: Verify it builds (will fail — FixPromptCard doesn't accept new props yet)**

Run: `npx tsc --noEmit`
Expected: Type error on `analysisId` and `originalIndex` props. This confirms the wiring is correct and the next task will fix it.

---

### Task 5: Replace "Copy Fix" with "Flag" button + reason input

**Files:**
- Modify: `src/components/fix-prompt-card.tsx`

- [ ] **Step 1: Rewrite fix-prompt-card.tsx**

Replace `src/components/fix-prompt-card.tsx` entirely:

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { Finding } from '@/types/analysis'

interface FixPromptCardProps {
  finding: Finding
  analysisId: string
  originalIndex: number
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'var(--color-red-ink)'
    case 'high': return 'var(--color-orange-ink)'
    case 'medium': return 'var(--color-amber-ink)'
    case 'low': return 'var(--color-ink-light)'
    default: return 'var(--color-ink-light)'
  }
}

function getFlagKey(analysisId: string, index: number): string {
  return `flag:${analysisId}:${index}`
}

export function FixPromptCard({ finding, analysisId, originalIndex }: FixPromptCardProps) {
  const [flagState, setFlagState] = useState<'idle' | 'input' | 'submitting' | 'flagged'>('idle')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(getFlagKey(analysisId, originalIndex))) {
        setFlagState('flagged')
      }
    } catch {
      // localStorage unavailable — ignore
    }
  }, [analysisId, originalIndex])

  async function submitFlag() {
    setFlagState('submitting')
    setError(null)

    try {
      const res = await fetch('/api/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: analysisId,
          finding_index: originalIndex,
          reason: reason.trim() || undefined,
        }),
      })

      if (res.status === 429) {
        setError('Too many flags, try later')
        setFlagState('input')
        return
      }

      if (!res.ok) {
        setError('Something went wrong')
        setFlagState('input')
        return
      }

      setFlagState('flagged')
      try {
        localStorage.setItem(getFlagKey(analysisId, originalIndex), '1')
      } catch {
        // localStorage unavailable — ignore
      }
    } catch {
      setError('Something went wrong')
      setFlagState('input')
    }
  }

  const color = severityColor(finding.severity)

  return (
    <div
      className="border-l-2 pl-4 py-3 space-y-2"
      style={{ borderLeftColor: color }}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider"
            style={{ color }}
          >
            {finding.severity}
          </span>
          {finding.file && (
            <>
              <span className="text-[var(--color-ink-faint)]">&middot;</span>
              <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-ink-light)]">
                {finding.file}{finding.line ? `:${finding.line}` : ''}
              </span>
            </>
          )}
        </div>
        <p className="text-sm text-[var(--color-ink)]">{finding.issue}</p>
      </div>

      {finding.evidence && (
        <pre className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-ink-light)] bg-[var(--color-paper-dark)] border border-[var(--color-paper-line)] p-2.5 overflow-x-auto">
          {finding.evidence}
        </pre>
      )}

      <div className="text-xs text-[var(--color-ink-light)] bg-[var(--color-paper-dark)] border border-[var(--color-paper-line)] p-2.5 font-[family-name:var(--font-mono)] leading-relaxed">
        {finding.fix_prompt}
      </div>

      {/* Flag button / input / confirmation */}
      {flagState === 'idle' && (
        <button
          onClick={() => setFlagState('input')}
          className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-light)] uppercase tracking-wider transition-colors"
        >
          Not a real issue?
        </button>
      )}

      {flagState === 'input' && (
        <div className="flex items-stretch gap-0">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this a false positive? (optional)"
            maxLength={500}
            className="flex-1 text-xs font-[family-name:var(--font-mono)] bg-white border border-[var(--color-paper-line)] border-r-0 p-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:outline-none"
          />
          <button
            onClick={submitFlag}
            className="shrink-0 px-4 text-[10px] font-[family-name:var(--font-mono)] bg-[var(--color-paper-dark)] border border-[var(--color-paper-line)] text-[var(--color-ink-light)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-line)]/30 transition-colors uppercase tracking-wider"
          >
            Submit
          </button>
        </div>
      )}

      {flagState === 'submitting' && (
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)] uppercase tracking-wider">
          Submitting...
        </p>
      )}

      {flagState === 'flagged' && (
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)] uppercase tracking-wider">
          Flagged — thanks
        </p>
      )}

      {error && (
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--color-red-ink)]">
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Visual check**

Navigate to `http://localhost:3000/r/0Tiwrj2sGv` and verify:
- Each finding card shows "Not a real issue?" link below the fix prompt
- Clicking it reveals the white-background input + "Submit" button
- The layout matches the existing card styling

- [ ] **Step 4: Commit**

```bash
git add src/app/r/[id]/page.tsx src/components/findings-list.tsx src/components/fix-prompt-card.tsx
git commit -m "feat: add false positive flag button on finding cards"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Test the full flow**

1. Navigate to a result page with findings
2. Click "Not a real issue?" on a finding
3. Type a reason and click "Submit"
4. Verify it shows "Flagged — thanks"
5. Reload the page — verify it still shows "Flagged" (localStorage)

- [ ] **Step 2: Verify the flag was stored**

```sql
SELECT * FROM finding_flags ORDER BY created_at DESC LIMIT 5;
```

Expected: One row with the finding data, reason, and ip_hash.

- [ ] **Step 3: Test duplicate prevention**

Clear localStorage and try flagging the same finding again from the same browser.
Expected: Returns 200 with `already_flagged: true`, UI shows "Flagged — thanks".

- [ ] **Step 4: Test rate limiting**

Flag 11 different findings rapidly.
Expected: 11th flag returns 429, UI shows "Too many flags, try later".

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during e2e testing"
```
