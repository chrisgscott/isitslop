'use client'

import { useState } from 'react'
import type { Finding } from '@/types/analysis'

interface FixPromptCardProps {
  finding: Finding
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'var(--color-red-ink)'
    case 'high': return 'var(--color-orange-ink)'
    case 'medium': return 'var(--color-amber-ink)'
    case 'low': return 'var(--color-ink-light)'
    default: return 'var(--color-ink-light)'
  }
}

export function FixPromptCard({ finding }: FixPromptCardProps) {
  const [copied, setCopied] = useState(false)

  function copyPrompt() {
    navigator.clipboard.writeText(finding.fix_prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const color = severityColor(finding.severity)

  return (
    <div
      className="border-l-2 pl-4 py-3 space-y-2"
      style={{ borderLeftColor: color }}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider"
            style={{ color }}
          >
            {finding.severity}
          </span>
          {finding.file && (
            <>
              <span className="text-[var(--color-ink-faint)]">&middot;</span>
              <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-ink-light)]">
                {finding.file}{finding.line ? `:${finding.line}` : ''}
              </span>
            </>
          )}
        </div>
        <p className="text-sm text-[var(--color-ink)]">{finding.issue}</p>
      </div>

      {finding.evidence && (
        <pre className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-ink-light)] bg-[var(--color-paper-dark)] border border-[var(--color-paper-line)] p-2.5 overflow-x-auto">
          {finding.evidence}
        </pre>
      )}

      <div className="flex items-stretch gap-0">
        <div className="flex-1 text-xs text-[var(--color-ink-light)] bg-[var(--color-paper-dark)] border border-[var(--color-paper-line)] border-r-0 p-2.5 font-[family-name:var(--font-mono)] leading-relaxed">
          {finding.fix_prompt}
        </div>
        <button
          onClick={copyPrompt}
          className="shrink-0 px-4 text-[10px] font-[family-name:var(--font-mono)] bg-[var(--color-paper-dark)] border border-[var(--color-paper-line)] text-[var(--color-ink-light)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-line)]/30 transition-colors uppercase tracking-wider"
        >
          {copied ? 'Copied' : 'Copy fix'}
        </button>
      </div>
    </div>
  )
}
