# IsItSlop

You vibe coded it. Let's see how that went.

Paste a GitHub repo URL. Get a Slop Score. Get the receipts. Get fix prompts to make your AI clean up its own mess.

## Development

```bash
# Frontend
pnpm install
pnpm dev

# Scoring service
cd scoring-service
pip install -r requirements.txt
modal serve modal_app.py
```

## Stack
- **Frontend:** Next.js 15 + Tailwind → Vercel
- **Analysis:** Python on Modal
- **Database:** Supabase
- **AI:** OpenAI GPT-4.1-mini (verdicts)
