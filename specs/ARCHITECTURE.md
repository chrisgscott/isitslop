# Architecture Document: IsItSlop

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  Next.js 15 (App Router) + TailwindCSS                      │
│  Deployed on: Vercel (isitslop.co)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              ▼                       ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│      Supabase        │  │       Modal (Python)              │
│  Postgres + Storage  │  │  Analysis + Verdict Service       │
│  (Result storage,    │  │  - Download tarball               │
│   shareable URLs)    │  │  - File system scan               │
│                      │  │  - Pattern detection              │
│                      │  │  - Score calculation              │
│                      │  │  - GPT-4.1-mini verdict           │
│                      │  │  - Save results to Supabase       │
└──────────────────────┘  └──────────────────────────────────┘
```

### Request Flow

```
1. User pastes GitHub URL on isitslop.co
2. Frontend validates URL, calls Next.js API route
3. API route creates a pending analysis record in Supabase
4. API route fires async webhook to Modal scoring service
5. Frontend redirects to result page, polls for completion
6. Modal service:
   a. Downloads repo tarball from GitHub API
   b. Extracts and walks file tree (single pass)
   c. Collects metrics across all 6 dimensions
   d. Calculates scores
   e. Sends structured findings to GPT-4.1-mini for verdict
   f. Saves complete results to Supabase
7. Frontend detects completion, renders result page
```

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 15 (App Router) | Server components for SEO, API routes for webhook |
| Styling | TailwindCSS (no ShadCN) | Distinctive design — this needs to look unique |
| Database | Supabase (Postgres) | Simple storage, instant queries, managed |
| Analysis Service | Python on Modal | Serverless, scales to zero, file analysis is natural in Python |
| AI Verdict | OpenAI GPT-4.1-mini | Best cost/quality for creative writing ($0.002/request) |
| Repo Access | GitHub Tarball API | Single request to download entire repo |
| Hosting | Vercel or Render | TBD based on cost comparison |
| Type Safety | TypeScript (frontend), Python type hints (backend) | |

## Project Structure

```
isitslop/
├── src/                          # Next.js frontend
│   ├── app/
│   │   ├── page.tsx              # Landing page (URL input)
│   │   ├── layout.tsx            # Root layout
│   │   ├── r/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Result page (shareable)
│   │   ├── analyzing/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Loading/polling page
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts      # Triggers Modal webhook
│   ├── components/
│   │   ├── url-input.tsx         # Main input component
│   │   ├── slop-score.tsx        # Big score display
│   │   ├── dimension-grades.tsx  # Letter grade grid
│   │   ├── verdict.tsx           # AI verdict display
│   │   ├── findings-list.tsx     # Receipts with fix prompts
│   │   ├── fix-prompt-card.tsx   # Individual fix prompt (copy button)
│   │   └── share-buttons.tsx     # Social share
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── github.ts             # URL parsing/validation
│   │   └── utils.ts
│   └── types/
│       ├── database.types.ts     # Generated from Supabase
│       └── analysis.ts           # Shared analysis types
├── scoring-service/              # Modal Python service
│   ├── modal_app.py              # Modal app + webhook endpoint
│   ├── requirements.txt
│   ├── tools/
│   │   ├── repo_downloader.py    # GitHub tarball download + extract
│   │   ├── file_scanner.py       # Single-pass file tree walker
│   │   ├── analyzers/
│   │   │   ├── error_handling.py
│   │   │   ├── test_coverage.py
│   │   │   ├── documentation.py
│   │   │   ├── security.py
│   │   │   ├── code_structure.py
│   │   │   └── dependencies.py
│   │   ├── scorer.py             # Score calculation + weighting
│   │   └── verdict_writer.py     # GPT-4.1-mini verdict generation
│   ├── schemas/
│   │   └── analysis_output.json  # JSON schema for verdict prompt
│   └── workflows/
│       └── analyze_repo.md       # SOP for analysis pipeline
├── supabase/
│   └── migrations/
├── specs/                        # This directory
├── planning/
├── .ai/
├── .claude/
└── README.md
```

## Key Architectural Decisions

### Decision 1: Separate Analysis Service on Modal
The analysis (repo download, file scanning, scoring) runs as a serverless Python function on Modal, not as a Next.js API route. This keeps the frontend lightweight and lets the heavy work scale independently. Same pattern as SanityCheck scoring service.

### Decision 2: Async Webhook Pattern
The frontend fires a webhook to Modal and polls for results. The user sees a loading page with snarky progress messages. This avoids long-running HTTP connections and handles the 30-60 second analysis time gracefully.

### Decision 3: No Auth, No RLS
MVP has no user accounts. Analysis results are public by design (they're meant to be shared). Supabase is used as simple storage with no RLS policies. Rate limiting is handled at the API route level.

### Decision 4: Single-Pass Analysis
The file tree is walked once, collecting all metrics for all dimensions simultaneously. No multi-pass or per-file-type analysis. This keeps the analysis fast and simple.

### Decision 5: Deterministic Scoring + AI Verdicts
All detection and scoring is deterministic (regex, file counting, pattern matching). The AI (GPT-4.1-mini) only writes the verdict copy — it doesn't influence scoring. This means scores are reproducible and explainable.

### Decision 6: No ShadCN
This product's differentiation includes its visual design. Using ShadCN would make it look like every other AI-built app. Custom Tailwind styling for a distinctive look.

## Data Flow

### Analysis Request
```
User Input → Next.js API Route → Create pending record in Supabase
  → Fire webhook to Modal → Redirect to /analyzing/[id]
```

### Analysis Processing (Modal)
```
Webhook received → Download tarball → Extract to temp dir
  → Walk file tree (single pass, collect all metrics)
  → Calculate dimension scores → Calculate composite score
  → Send findings JSON to GPT-4.1-mini → Receive verdict
  → Save complete results to Supabase
```

### Result Retrieval
```
/analyzing/[id] polls Supabase → Status changes to "complete"
  → Redirect to /r/[id] → Server-render result page from Supabase data
```

## Rate Limiting & Abuse Prevention

- Rate limit analysis requests: 5 per IP per hour (MVP)
- Max repo size: 100MB tarball
- Max files: 10,000
- Timeout: 90 seconds per analysis
- No repo content stored — only findings and scores

## Error Handling

| Error | User Experience |
|-------|----------------|
| Invalid GitHub URL | Inline validation error |
| Private repo | "This repo is private. We only do public repos (for now)." |
| Repo too large | "This repo is too thicc. We cap at 100MB." |
| Analysis timeout | "This repo broke us. It might be too complex to analyze." |
| GitHub API rate limit | "GitHub is rate limiting us. Try again in a few minutes." |
| Modal service error | "Something went wrong on our end. Try again." |

---
*Generated by lfg skill*
