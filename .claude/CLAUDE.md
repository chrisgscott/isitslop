# IsItSlop

## Project Overview
Vibe code gut check tool. Paste a GitHub repo URL → get a Slop Score (0-100) with letter grades across 6 dimensions, a snarky verdict with specific receipts, and copy-paste fix prompts. Growth loop is shareable result URLs.

## Tech Stack
- **Frontend:** Next.js 15 (App Router), TailwindCSS (NO ShadCN)
- **Analysis Service:** Python on Modal (serverless)
- **Database:** Supabase (Postgres, no auth, no RLS)
- **AI:** OpenAI GPT-4.1-mini (verdicts only)
- **Hosting:** Vercel or Render (frontend), Modal (analysis)

## Key Patterns

### Frontend
- Server Components for result pages (SEO + instant load)
- Single API route: POST /api/analyze (creates record, fires webhook)
- Polling on /analyzing/[id] page until result ready
- Result pages at /r/[id] — server-rendered, shareable

### Analysis Service (Modal)
- Webhook endpoint receives { repo_url, analysis_id }
- Downloads repo via GitHub tarball API (single request)
- Single-pass file tree walk collects all metrics
- Six analyzers run against collected file data
- Scorer calculates weighted composite
- Verdict writer sends findings to GPT-4.1-mini
- Saves complete results to Supabase

### Scoring
- Deterministic — same repo always gets same score
- AI writes verdicts only, never influences scoring
- Weights: Error Handling 20%, Code Structure 25%, Test Coverage 20%, Security 15%, Dependencies 10%, Docs 10%

## File Organization
- Frontend: `src/app/`, `src/components/`, `src/lib/`
- Scoring service: `scoring-service/`
- Specs: `specs/`, `planning/`
- Session state: `.ai/`

## Session Protocol

### At Session Start
1. Read `.ai/CONTEXT.md` for current state
2. Check `planning/PROJECT_PLAN.md` for current task
3. Review relevant specs for the task

### During Development
- Ideas → `.ai/INBOX.md`
- Gotchas → `.ai/LEARNINGS.md`
- Decisions → `planning/DECISIONS.md`

### At Session End
1. Update `planning/PROJECT_PLAN.md` with completed tasks
2. Update `.ai/CONTEXT.md` with current state
3. Commit with message referencing task ID

## Design Principles
- **No ShadCN** — custom Tailwind for distinctive look. Use frontend-design skill.
- **Tone:** "Your AI did you dirty. Here are the receipts." Not mean, but not nice.
- **Zero friction** — paste URL, get verdict. No signup, no config.
- **Specific receipts** — every finding has a file path and evidence, not vague warnings.
- **Actionable** — every receipt has a copy-paste fix prompt for AI tools.

## Anti-Patterns
- Don't use ShadCN components
- Don't add auth or user accounts
- Don't let the AI model influence scoring
- Don't store repo source code after analysis
- Don't build for private repos yet
- Don't over-engineer the loading state — snarky messages > progress bars
