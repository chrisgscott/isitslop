import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createServiceClient } from '@/lib/supabase/server'
import { parseGitHubUrl, buildRepoUrl } from '@/lib/github'

export async function POST(request: NextRequest) {
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
  const supabase = createServiceClient()

  const { error: insertError } = await supabase
    .from('analyses')
    .insert({
      id,
      repo_url: buildRepoUrl(parsed),
      repo_owner: parsed.owner,
      repo_name: parsed.repo,
      repo_branch: parsed.branch,
      status: 'pending',
    })

  if (insertError) {
    console.error('Failed to create analysis record:', insertError)
    return NextResponse.json({ error: 'Failed to start analysis' }, { status: 500 })
  }

  // Fire webhook to Modal (fire-and-forget)
  const webhookUrl = process.env.MODAL_WEBHOOK_URL
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_WEBHOOK_SECRET || ''}`,
      },
      body: JSON.stringify({
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
