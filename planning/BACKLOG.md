# Post-MVP Backlog

## Phase 2: Shareability & Growth
- "Roast Me" mode toggle: unhinged verdict voice designed to be screenshotted and shared. Current teacher tone becomes the default "kind" mode. Roast mode weaponizes specificity — every dimension comment is a standalone punchline. Same scores, same receipts, different voice. The viral loop lives here.

## Phase 3: Engagement Data & Monetization Prep
Strategy: fully free until audience justifies sponsorship. No paywall, no paid tiers. Monetize via sponsorship from AI coding tools (Cursor, Windsurf, etc.) sold on engagement data — not just eyeballs but proof of a behavior loop.

- **Daily engagement digest (email):** Total runs, unique repos, rerun count, avg score delta between first and follow-up runs, top 5 most-improved repos. Cron job → email to Chris. No dashboard needed yet.
- **Instrument engagement events:** Track first-run vs rerun (same repo), "copy report card" clicks, result page views, time-to-rerun. This is both product insight and future sponsor pitch data.
- Badge endpoint: `isitslop.co/badge/[repo]` for README embeds (free distribution, drives return visits)
- Re-analysis: track score changes over time (feeds the rerun delta metric)
- **Sponsorship placement (when scale justifies):** Single contextual sponsor on result page ("Fix your slop with [Sponsor]"). One sponsor > generic ads. On-brand, not cheap.

### Parked (not pursuing)
- ~~Private repo support (GitHub OAuth + paid tier)~~ — users can just toggle repo to public and back
- ~~"Fix it" mode: automated PR with fixes (premium)~~ — revisit if demand appears

## Phase 4: Distribution
- MCP server for CLI access from Claude Code
- Browser extension: one-click from any GitHub repo page
- GitHub Action: run IsItSlop on PRs
- Slack bot: `/isitslop <repo-url>`

## Phase 5: Community
- Leaderboard: "Slopiest repos this week"
- "Wall of Shame" / "Wall of Fame" opt-in gallery
- Compare two repos head-to-head
- Organization-level analysis (all repos in an org)

## Ideas Parking Lot
- Language-specific analyzer plugins (Python, Go, Rust)
- AST-based analysis for deeper structural issues
- AI-generated refactoring suggestions (not just prompts)
- GitLab / Bitbucket support
- Self-hosted / on-prem version
