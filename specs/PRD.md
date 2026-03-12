# Product Requirements Document: IsItSlop

## Overview

### Problem Statement
Developers vibe code with AI tools and ship code they haven't fully reviewed. They suspect it might be spaghetti but have no fast, fun way to find out. Existing code quality tools require account creation, CI/CD integration, and produce clinical enterprise reports. Nobody pastes a SonarQube link in a group chat.

### Solution
A web app where you paste a public GitHub repo URL and get a Slop Score (0-100, lower is better) with letter grades across six dimensions, a snarky AI-written verdict with specific receipts, and copy-paste fix prompts for each issue. Every result has a shareable static URL. The tone is "your AI did you dirty — here are the receipts."

### Target Users
- **Primary:** Developers who use AI coding tools (Claude, Cursor, Copilot, Windsurf) and want a gut check
- **Secondary:** Developers evaluating open-source repos or reviewing PRs
- **Tertiary:** Tech Twitter / dev community members who share interesting results

## Goals & Success Metrics

### Primary Goals
1. Deliver genuinely useful code quality feedback in under 60 seconds
2. Create results so shareable that growth is organic
3. Position as THE vibe code quality tool

### Success Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Time to result | < 60 seconds | Measure webhook → result ready |
| Share rate | > 10% of results get shared | Track outbound clicks on share buttons |
| Return rate | > 20% of users analyze 2+ repos | Track by session/fingerprint |
| Social mentions | Organic sharing on Twitter/Reddit | Social monitoring |

## Features

### MVP Features
| Feature | Description | Priority |
|---------|-------------|----------|
| URL Input | Simple paste-and-go interface, validates GitHub repo URLs | Must Have |
| Repo Analysis | Download tarball, scan files, detect quality issues across 6 dimensions | Must Have |
| Slop Score | 0-100 composite score with letter grades (A-F) per dimension | Must Have |
| AI Verdict | GPT-4.1-mini generates snarky, specific verdict with receipts | Must Have |
| Fix Prompts | Each finding includes a copy-paste prompt to feed back to AI tools | Must Have |
| Result Page | Shareable static URL per analysis with distinctive design | Must Have |
| Loading State | Engaging wait experience while analysis runs (30-60s) | Must Have |

### Future Features (Post-MVP)
| Feature | Description | Phase |
|---------|-------------|-------|
| Badge Endpoint | `isitslop.co/badge/[repo]` SVG for README embeds | 2 |
| Private Repos | GitHub OAuth + paid tier for private repo analysis | 2 |
| Re-analysis | Track score changes over time for same repo | 2 |
| MCP Server | CLI access via Claude Code / AI tools | 3 |
| Browser Extension | One-click analysis from any GitHub repo page | 3 |
| Leaderboard | "Slopiest repos this week" | 3 |

## User Stories

### Vibe Coder
- As a developer who just vibe coded a project, I want to paste my repo URL and get an honest assessment so I know what my AI left behind
- As a developer reviewing results, I want copy-paste fix prompts so I can tell my AI tool exactly what to clean up
- As a developer with a good score, I want to share my result URL to flex on people

### Repo Evaluator
- As a developer evaluating an open-source library, I want to quickly assess code quality before depending on it
- As a PR reviewer, I want to drop an IsItSlop link in comments to support my feedback

## Functional Requirements

### URL Input
- [ ] Accept GitHub repo URLs in multiple formats: `https://github.com/owner/repo`, `github.com/owner/repo`, `owner/repo`
- [ ] Validate URL format before submission
- [ ] Show clear error for invalid URLs or private repos
- [ ] Support specifying a branch (default: default branch)

### Analysis Engine (Modal Service)
- [ ] Download repo via GitHub tarball API (single request)
- [ ] Skip irrelevant directories: node_modules, dist, build, .next, vendor, __pycache__, .git
- [ ] Skip binary files (images, fonts, compiled assets)
- [ ] Cap analysis at 100MB / 10,000 files (show warning for oversized repos)
- [ ] Detect primary language(s) and adjust analysis accordingly
- [ ] Complete analysis in < 60 seconds for repos under 50MB

### Six Graded Dimensions
Each scored 0-100 with a letter grade (A-F):

1. **Error Handling** — Empty catch blocks, unhandled promises, swallowed errors, missing error boundaries
2. **Test Coverage** — Presence of test files, test-to-code ratio, test script in package.json, test framework configured
3. **Documentation** — README quality, inline comments density, JSDoc/docstrings, API documentation
4. **Security Hygiene** — Hardcoded secrets, .env in repo, exposed API keys, known vulnerable patterns
5. **Code Structure** — God files (400+ LOC), deep nesting, function length, circular deps, copy-paste duplication
6. **Dependency Management** — Unused deps, duplicate-purpose packages, missing lock file, outdated deps, dep count relative to codebase size

### Scoring
- [ ] Each dimension: 0-100 score → letter grade (A: 90-100, B: 80-89, C: 70-79, D: 60-69, F: 0-59)
- [ ] Composite Slop Score: weighted average (structure and error handling weighted higher)
- [ ] Weights: Error Handling 20%, Code Structure 25%, Test Coverage 20%, Security 15%, Dependencies 10%, Docs 10%

### AI Verdict (GPT-4.1-mini)
- [ ] Receives structured JSON of all findings
- [ ] Generates: overall verdict (2-3 sentences), dimension-specific commentary, specific receipts with file paths
- [ ] Each receipt includes a copy-paste fix prompt
- [ ] Tone: blunt, specific, funny — not mean-spirited but not sugar-coated
- [ ] Example: "0 tests. Not zero coverage. Zero tests. Your AI said 'I'll add tests later' and you believed it. Copy this into Claude: 'Add comprehensive test coverage for api/routes.ts — currently has zero tests and 4 unhandled promise rejections.'"

### Result Page
- [ ] Unique URL per analysis: `isitslop.co/r/[short-id]`
- [ ] Display: Slop Score (big number), letter grades grid, verdict, receipts/findings list
- [ ] Share buttons (Twitter, copy link)
- [ ] Open Graph meta tags for social previews
- [ ] "Analyze another repo" CTA

### Loading Experience
- [ ] Show progress states while analysis runs
- [ ] Engaging copy during wait (snarky loading messages)
- [ ] Handle timeout gracefully (> 90 seconds)

## Non-Functional Requirements

### Performance
- Page load time < 2 seconds
- Analysis completion < 60 seconds for typical repos (< 50MB)
- Result page loads instantly (pre-rendered from Supabase)

### Security
- No repo content stored after analysis — only findings/results
- GitHub API token stored securely in Modal secrets
- Rate limiting on analysis endpoint (prevent abuse)
- Input sanitization on repo URLs

### SEO
- Result pages are server-rendered with proper meta tags
- OG image generated per result for social previews

## Constraints & Assumptions

### Technical Constraints
- Next.js 15 with App Router for frontend
- Python on Modal for analysis service
- Supabase for result storage
- OpenAI GPT-4.1-mini for verdict generation
- GitHub tarball API for repo download

### Assumptions
- Public repos only for MVP (no auth needed)
- GitHub-only for MVP (no GitLab/Bitbucket)
- JavaScript/TypeScript repos are primary target but analysis works on any language at a basic level
- Users accept 30-60 second wait for results

## Out of Scope
- Private repository support
- User accounts / authentication
- Historical tracking / re-analysis
- Badge generation
- Multi-provider support (GitLab, Bitbucket)
- Paid tier / billing
- Heavy static analysis (ESLint, semgrep AST parsing)

---
*Generated by lfg skill*
*Last updated: 2026-03-12*
