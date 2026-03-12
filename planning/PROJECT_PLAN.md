# Project Plan: IsItSlop

## Overview
- **Current Phase:** 1 of 4
- **Progress:** 0/19 tasks (0%)
- **Status:** Not Started

## Phase 1: Foundation

**Goal:** Project scaffolding, database, and basic frontend shell

| ID | Task | Status | Complexity | Notes |
|----|------|--------|------------|-------|
| 1.1 | Next.js 15 project scaffolding + Tailwind config | ready | M | No ShadCN — custom design |
| 1.2 | Supabase project setup + analyses table migration | ready | S | |
| 1.3 | Supabase client setup (server + client) | blocked | S | Needs 1.2 |
| 1.4 | GitHub URL parser + validator utility | ready | S | Handle multiple URL formats |
| 1.5 | Next.js API route: POST /api/analyze | blocked | M | Needs 1.2, 1.3, 1.4 |

**Phase 1 Checklist:**
- [ ] Can run `pnpm dev` and see landing page
- [ ] Supabase connected with analyses table
- [ ] URL validation works for all GitHub URL formats
- [ ] API route creates pending analysis record
- [ ] Type safety for analysis types

---

## Phase 2: Scoring Service (Modal)

**Goal:** Python analysis service that downloads, scans, scores, and writes verdicts

| ID | Task | Status | Complexity | Notes |
|----|------|--------|------------|-------|
| 2.1 | Modal app scaffolding + webhook endpoint | ready | M | Follow SanityCheck pattern |
| 2.2 | Repo downloader (GitHub tarball API) | ready | M | Handle size limits, errors |
| 2.3 | File scanner (single-pass tree walker) | ready | M | Skip binaries, node_modules, etc. |
| 2.4 | Analyzer: Error Handling | blocked | M | Needs 2.3 |
| 2.5 | Analyzer: Test Coverage | blocked | S | Needs 2.3 |
| 2.6 | Analyzer: Documentation | blocked | S | Needs 2.3 |
| 2.7 | Analyzer: Security Hygiene | blocked | M | Needs 2.3 |
| 2.8 | Analyzer: Code Structure | blocked | L | Needs 2.3 — most complex |
| 2.9 | Analyzer: Dependency Management | blocked | M | Needs 2.3 |
| 2.10 | Scorer (weighted composite + letter grades) | blocked | S | Needs 2.4-2.9 |
| 2.11 | Verdict writer (GPT-4.1-mini integration) | blocked | M | Needs 2.10 |
| 2.12 | End-to-end pipeline + Supabase save | blocked | M | Needs all above |

**Phase 2 Checklist:**
- [ ] Can trigger analysis via webhook
- [ ] Repo downloads and extracts correctly
- [ ] All 6 analyzers produce findings
- [ ] Scores calculate correctly with weighting
- [ ] Verdict generates with specific receipts and fix prompts
- [ ] Results save to Supabase
- [ ] Analysis completes in < 60 seconds for typical repos

---

## Phase 3: Frontend — Result Experience

**Goal:** The result page, loading experience, and landing page polish

| ID | Task | Status | Complexity | Notes |
|----|------|--------|------------|-------|
| 3.1 | Landing page with URL input | blocked | M | Needs Phase 1 — use frontend-design skill |
| 3.2 | Loading/analyzing page with polling | blocked | M | Snarky loading messages |
| 3.3 | Result page: score + grades + verdict | blocked | L | The hero page — needs to look amazing |
| 3.4 | Findings list with copy-paste fix prompts | blocked | M | Copy button per finding |
| 3.5 | Share buttons + OG meta tags | blocked | M | Twitter card, copy link |

**Phase 3 Checklist:**
- [ ] Landing page looks distinctive, not template-y
- [ ] Loading state is engaging with snarky messages
- [ ] Result page renders all data beautifully
- [ ] Fix prompts copy to clipboard
- [ ] Share links work with proper OG previews
- [ ] Responsive design works on mobile

---

## Phase 4: Integration & Polish

**Goal:** Wire everything together, deploy, polish

| ID | Task | Status | Complexity | Notes |
|----|------|--------|------------|-------|
| 4.1 | End-to-end flow: input → analyze → result | blocked | M | Integration testing |
| 4.2 | Rate limiting on /api/analyze | blocked | S | 5 per IP per hour |
| 4.3 | Error handling UX (all error states) | blocked | M | |
| 4.4 | Deploy frontend to Vercel | blocked | S | |
| 4.5 | Deploy scoring service to Modal | blocked | S | |
| 4.6 | DNS setup (isitslop.co) | blocked | S | |

**Phase 4 Checklist:**
- [ ] Full flow works end-to-end in production
- [ ] Rate limiting prevents abuse
- [ ] All error states handled gracefully
- [ ] isitslop.co resolves and works

---

## Human Checkpoints

| After | Review Type | Status |
|-------|-------------|--------|
| Phase 1 | Review: API route + data model | Pending |
| Phase 2 | Review: Analysis quality + verdict tone | Pending |
| Phase 3 | Review: Design + UX | Pending |
| Phase 4 | Final: Pre-deployment | Pending |

---

## Legend
- **Status:** ready | in_progress | blocked | done
- **Complexity:** S (< 30 min) | M (30-60 min) | L (> 1 hour)

---
*Updated automatically by AI after each task completion*
