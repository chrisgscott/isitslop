# Architecture Decisions

## Decision #001: Analysis Service on Modal (not Next.js API Routes)
**Date:** 2026-03-12
**Status:** Accepted

### Context
Repo analysis involves downloading tarballs (potentially 100MB), walking file trees, running pattern detection, and calling OpenAI. This is a 30-60 second operation.

### Options Considered
1. **Next.js API route** — Keep everything in one codebase
2. **Modal serverless function** — Separate Python service
3. **Supabase Edge Function** — Deno-based serverless

### Decision
Modal serverless function (Python)

### Rationale
- Same proven pattern as SanityCheck scoring service
- Python is better suited for file analysis, regex, and tarball handling
- Serverless scales to zero — no cost when idle
- Keeps frontend lightweight and fast
- 10-minute timeout vs Vercel's 60-second limit

### Consequences
- Two codebases to maintain (Next.js + Python)
- Need Modal account and deployment pipeline
- Async webhook pattern adds complexity vs synchronous

---

## Decision #002: OpenAI GPT-4.1-mini for Verdicts
**Date:** 2026-03-12
**Status:** Accepted

### Context
Need an LLM to write snarky, specific verdicts from structured analysis data. This is creative writing, not complex reasoning.

### Options Considered
1. **GPT-4.1-nano** — $0.0006/request, cheapest
2. **GPT-4.1-mini** — $0.002/request, better writing quality
3. **Claude Haiku** — $0.006/request, more expensive
4. **GPT-4o-mini** — $0.0008/request, proven for creative writing

### Decision
GPT-4.1-mini with config swap capability to test other models

### Rationale
- Best cost/quality ratio for creative writing tasks
- $2 per 1,000 analyses — effectively free
- Better tone control than nano models
- Easy to swap if quality isn't sufficient

### Consequences
- Depends on OpenAI API availability
- May need to test and tune prompts specifically for this model

---

## Decision #003: No Auth for MVP
**Date:** 2026-03-12
**Status:** Accepted

### Context
Public repos only for MVP. The product is paste-URL-get-result with zero friction.

### Options Considered
1. **No auth** — Simplest possible UX
2. **Optional auth** — Save your history
3. **Required auth** — Gate analysis behind signup

### Decision
No auth

### Rationale
- Maximum friction reduction — paste and go
- Results are public by design (shareable URLs)
- Auth adds complexity with no MVP value
- Rate limiting by IP is sufficient for abuse prevention

### Consequences
- No user history or saved analyses
- Rate limiting by IP only (can be circumvented)
- Private repos not possible without auth

---

## Decision #004: No ShadCN — Custom Tailwind
**Date:** 2026-03-12
**Status:** Accepted

### Context
The result page IS the product. It needs to look distinctive and shareable.

### Options Considered
1. **ShadCN/UI** — Fast development, consistent
2. **Custom Tailwind** — Unique design, more effort
3. **Other component library** — Various options

### Decision
Custom Tailwind with the frontend-design skill for UI implementation

### Rationale
- ShadCN makes everything look like every other AI-built app
- The result page needs to feel like a product, not a dashboard
- Shareability requires visual distinctiveness
- Tailwind provides enough structure without prescribing design

### Consequences
- More design effort required
- No pre-built accessible components (need to handle a11y manually)
- Slower initial development

---

## Decision #005: Deterministic Scoring + AI Verdicts
**Date:** 2026-03-12
**Status:** Accepted

### Context
Need to decide whether the AI influences scoring or just writes copy.

### Options Considered
1. **AI does everything** — Send repo to LLM, get score + verdict
2. **Deterministic scoring + AI verdicts** — Code detects issues, AI writes about them
3. **Hybrid** — Code scores, AI can adjust

### Decision
Deterministic scoring + AI verdicts only

### Rationale
- Scores are reproducible and explainable
- Same repo always gets the same score
- AI is great at writing snarky copy, not at consistent scoring
- Users can trust the score because it's based on specific, listed findings
- Easier to debug and improve

### Consequences
- Must build robust analyzers (the scoring IS the product quality)
- AI can't catch nuanced issues the analyzers miss
- May miss context-dependent quality issues

---

*Add new decisions as they arise during development*
