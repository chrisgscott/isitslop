import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db'
import { parseGitHubUrl, buildRepoUrl } from '@/lib/github'
import { checkAnalyzeRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { allowed, remaining } = checkAnalyzeRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in an hour.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
    )
  }

  const body = await request.json()
  const { url } = body

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  const parsed = parseGitHubUrl(url)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid GitHub URL. Try formats like: owner/repo, github.com/owner/repo, or https://github.com/owner/repo' },
      { status: 400 }
    )
  }

  const id = nanoid(10)

  try {
    await db.query(
      `INSERT INTO analyses (id, repo_url, repo_owner, repo_name, repo_branch, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [id, buildRepoUrl(parsed), parsed.owner, parsed.repo, parsed.branch]
    )
  } catch (err) {
    console.error('Failed to create analysis record:', err)
    return NextResponse.json({ error: 'Failed to start analysis' }, { status: 500 })
  }

  // Fire webhook to scoring service (fire-and-forget)
  const webhookUrl = process.env.SCORING_SERVICE_URL
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_token: process.env.SCORING_WEBHOOK_SECRET || '',
        analysis_id: id,
        repo_owner: parsed.owner,
        repo_name: parsed.repo,
        repo_branch: parsed.branch,
      }),
    }).catch((err) => {
      console.error('Failed to fire webhook:', err)
    })
  }

  return NextResponse.json({ id, status: 'pending' })
}
