# IsItSlop — Session Context

## Current State
- **Phase:** Pre-development (specs complete)
- **Last Action:** Generated specification package
- **Next Action:** Begin Phase 1 (Foundation)

## Key Context
- Vibe code gut check tool — paste GitHub URL, get Slop Score + snarky verdict
- Architecture: Next.js frontend + Python Modal service + Supabase
- No auth, public repos only, results are public/shareable
- AI (GPT-4.1-mini) writes verdicts only — scoring is deterministic
- Same Modal webhook pattern as SanityCheck scoring service
