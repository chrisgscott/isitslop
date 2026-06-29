import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
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

  try {
    const { rows } = await db.query(
      `SELECT status, receipts FROM analyses WHERE id = $1`,
      [analysis_id]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'analysis_not_found' }, { status: 400 })
    }

    const analysis = rows[0]

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

    await db.query(
      `INSERT INTO finding_flags (analysis_id, finding_index, finding_issue, finding_file, finding_severity, dimension, reason, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [analysis_id, finding_index, finding.issue, finding.file, finding.severity, finding.dimension, reason || null, ipHash]
    )

    return NextResponse.json({ flagged: true }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      return NextResponse.json({ already_flagged: true }, { status: 200 })
    }
    console.error('Failed to insert flag:', err)
    return NextResponse.json({ error: 'Failed to save flag' }, { status: 500 })
  }
}
