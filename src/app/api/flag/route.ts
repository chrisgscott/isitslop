import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { checkFlagRateLimit } from '@/lib/rate-limit'

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { allowed } = checkFlagRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many flags. Try again in an hour.' },
      { status: 429 }
    )
  }

  let body: { analysis_id?: string; finding_index?: number; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { analysis_id, finding_index, reason } = body

  if (!analysis_id || finding_index === undefined || finding_index === null) {
    return NextResponse.json({ error: 'analysis_id and finding_index are required' }, { status: 400 })
  }

  if (typeof finding_index !== 'number' || finding_index < 0 || !Number.isInteger(finding_index)) {
    return NextResponse.json({ error: 'finding_index must be a non-negative integer' }, { status: 400 })
  }

  if (reason && reason.length > 500) {
    return NextResponse.json({ error: 'reason_too_long', message: 'Reason must be 500 characters or fewer' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch the analysis to validate and pull finding data
  const { data: analysis, error: fetchError } = await supabase
    .from('analyses')
    .select('status, receipts')
    .eq('id', analysis_id)
    .single()

  if (fetchError || !analysis) {
    return NextResponse.json({ error: 'analysis_not_found' }, { status: 400 })
  }

  if (analysis.status !== 'complete') {
    return NextResponse.json({ error: 'analysis_not_found' }, { status: 400 })
  }

  const receipts = analysis.receipts as Array<{
    dimension: string; severity: string; file: string | null; issue: string
  }> | null

  if (!receipts || finding_index >= receipts.length) {
    return NextResponse.json({ error: 'finding_index_out_of_range' }, { status: 400 })
  }

  const finding = receipts[finding_index]
  const ipHash = hashIp(ip)

  const { error: insertError } = await supabase
    .from('finding_flags')
    .insert({
      analysis_id,
      finding_index,
      finding_issue: finding.issue,
      finding_file: finding.file,
      finding_severity: finding.severity,
      dimension: finding.dimension,
      reason: reason || null,
      ip_hash: ipHash,
    })

  if (insertError) {
    // Unique constraint violation = already flagged
    if (insertError.code === '23505') {
      return NextResponse.json({ already_flagged: true }, { status: 200 })
    }
    console.error('Failed to insert flag:', insertError)
    return NextResponse.json({ error: 'Failed to save flag' }, { status: 500 })
  }

  return NextResponse.json({ flagged: true }, { status: 201 })
}
