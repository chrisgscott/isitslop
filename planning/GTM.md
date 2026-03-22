# Go-To-Market Strategy

## Philosophy
Free tool, no paywall. Growth comes from shareability of results (especially roast mode). Paid acquisition is for kickstarting the flywheel — organic sharing sustains it. Monetization comes later via sponsorship when audience is proven.

## Organic: Reddit Value-First Automation

### The Play
Show up in subreddit threads where people share GitHub repos. Provide genuinely useful feedback (top 1-2 findings from a full IsItSlop analysis). Never link the tool — let profile/bio do that work.

### The Automation
Daily cron job:
1. Scan target subreddits for posts containing GitHub repo links
2. Run each repo through the full IsItSlop analysis
3. Generate suggested reply content (top 1-2 most specific, useful findings)
4. Email Chris a morning digest:
   - Link to Reddit post
   - Suggested reply with top findings
   - Repeat for each post
5. Chris clicks link, adapts voice/tone, posts manually

### Target Subreddits (to validate)
- r/webdev
- r/nextjs
- r/reactjs
- r/learnprogramming
- r/SideProject
- r/codeforreview

### Why This Works
- Human in the loop on every post — no spam risk
- Every reply is a live demo of what the tool produces
- Builds real credibility in communities, not just impressions

## Paid: Kickstart the Flywheel

### Newsletter Sponsorships
| Newsletter | Audience | Fit | Notes |
|---|---|---|---|
| TLDR | 1M+ devs | Broad reach | Expensive but massive |
| Bytes.dev | 200k+ JS/frontend | High | Perfect vibe coder audience |
| Console.dev | Dev tools discovery | High | Literally a tool discovery newsletter |
| Pointer.io | Senior devs | Medium | They share tools |
| This Week in React | React devs | High | Cheaper, targeted |
| Frontend Focus | Frontend devs | High | Cheaper, targeted |
| JavaScript Weekly | JS devs | High | Cheaper, targeted |

### Content Creators / Dev Influencers
- **The angle:** "I ran my repo through IsItSlop" is a natural video/post. Roast mode makes it entertaining content, not a sponsored ad read.
- **High-reach creators:** Theo, ThePrimeagen, Fireship — code review is already their content. DM them a roast-mode result of their own repo. If it's funny enough, they post it for free.
- **Mid-tier creators:** Dev Twitter/TikTok accounts doing "rate my code" content. $50-100 to run their repo and post the result. Cheap, targeted, authentic.
- **The move:** Don't pitch the tool. Send the roast. Let the result sell itself.

### Free Launch Channels
- **Product Hunt:** Dev tools do well. "Paste a URL, get roasted" is an easy try-before-you-vote hook. One-shot but high impact.
- **Hacker News "Show HN":** IsItSlop is exactly what HN loves to argue about. The comments section alone drives traffic for days.
- **Dev Twitter seeding:** Pay 5-10 dev accounts (10k+ followers) to run their repos and post results. Roast mode = content they'd want to post anyway.

### Events
- **Hackathon sponsorship:** "Run your project through IsItSlop before you demo." Cheap, funny, perfectly targeted at vibe coders.

## Recommended Launch Sequence

### Wave 1: Free channels (Week 1)
- Show HN post
- Product Hunt launch
- Seed dev Twitter with 5-10 roast results

### Wave 2: Paid amplification (Week 2-3)
- 2-3 newsletter sponsorships (Bytes.dev, Console.dev, one JS-specific)
- DM 3-5 dev creators with roast results of their own repos

### Wave 3: Sustained organic (Ongoing)
- Reddit automation digest running daily
- Continue engaging in dev communities authentically
- Share aggregate stats and interesting findings as content ("We analyzed 500 repos — here's the average slop score")

## Success Metrics
- Runs per day/week
- Rerun rate (same repo analyzed again after fixes)
- "Copy report card" click rate
- Result page shares / referral traffic
- Organic mentions on Twitter/Reddit (not planted by us)
