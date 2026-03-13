'use client'

import { useState } from 'react'
import type { Analysis, DimensionKey } from '@/types/analysis'

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  error_handling: 'Error Handling',
  code_structure: 'Code Structure',
  test_coverage: 'Test Coverage',
  security: 'Security',
  dependencies: 'Dependencies',
  documentation: 'Documentation',
}

function buildReport(analysis: Analysis): string {
  const lines: string[] = []

  lines.push(`# IsItSlop Report: ${analysis.repo_owner}/${analysis.repo_name}`)
  lines.push(``)
  lines.push(`**Overall Grade: ${100 - (analysis.slop_score ?? 0)}/100**`)
  lines.push(``)

  if (analysis.scores) {
    lines.push(`## Dimension Grades`)
    for (const [key, data] of Object.entries(analysis.scores)) {
      const label = DIMENSION_LABELS[key as DimensionKey] || key
      lines.push(`- ${label}: ${data.grade} (${data.score}/100, ${data.findings_count} issues)`)
    }
    lines.push(``)
  }

  if (analysis.verdict) {
    lines.push(`## Verdict`)
    lines.push(analysis.verdict)
    lines.push(``)
  }

  if (analysis.receipts && analysis.receipts.length > 0) {
    lines.push(`## Findings (${analysis.receipts.length} total)`)
    lines.push(``)

    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const sorted = [...analysis.receipts].sort(
      (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
    )

    for (const finding of sorted) {
      lines.push(`### [${finding.severity.toUpperCase()}] ${finding.issue}`)
      if (finding.file) {
        lines.push(`**File:** ${finding.file}${finding.line ? `:${finding.line}` : ''}`)
      }
      if (finding.evidence) {
        lines.push(`**Evidence:** ${finding.evidence}`)
      }
      lines.push(`**Fix:** ${finding.fix_prompt}`)
      lines.push(``)
    }
  }

  lines.push(`---`)
  lines.push(`Report from isitslop.co — see me after class.`)

  return lines.join('\n')
}

interface CopyReportButtonProps {
  analysis: Analysis
}

export function CopyReportButton({ analysis }: CopyReportButtonProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const report = buildReport(analysis)
    navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <button
      onClick={handleCopy}
      className="w-full max-w-sm mx-auto block px-6 py-3.5 bg-[var(--color-ink)] text-[var(--color-paper)] text-sm tracking-[0.15em] uppercase hover:bg-[var(--color-red-ink)] transition-colors"
    >
      {copied ? 'Copied. Now hand it to your AI.' : 'Copy report card for your AI'}
    </button>
  )
}
