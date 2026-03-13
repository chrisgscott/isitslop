'use client'

import { useState } from 'react'
import type { Finding } from '@/types/analysis'

interface FixPromptCardProps {
  finding: Finding
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-red-500/50 bg-red-500/5'
    case 'high': return 'border-orange-500/50 bg-orange-500/5'
    case 'medium': return 'border-yellow-500/50 bg-yellow-500/5'
    case 'low': return 'border-zinc-600 bg-zinc-800/50'
    default: return 'border-zinc-700'
  }
}

export function FixPromptCard({ finding }: FixPromptCardProps) {
  const [copied, setCopied] = useState(false)

  function copyPrompt() {
    navigator.clipboard.writeText(finding.fix_prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${severityColor(finding.severity)}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-mono uppercase text-zinc-500">
            {finding.severity}
          </span>
          <p className="text-sm text-zinc-200">{finding.issue}</p>
          {finding.file && (
            <p className="text-xs font-mono text-zinc-500">
              {finding.file}{finding.line ? `:${finding.line}` : ''}
            </p>
          )}
        </div>
      </div>

      {finding.evidence && (
        <pre className="text-xs font-mono text-zinc-500 bg-zinc-900 rounded p-2 overflow-x-auto">
          {finding.evidence}
        </pre>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 text-xs text-zinc-400 bg-zinc-900 rounded p-2 font-mono">
          {finding.fix_prompt}
        </div>
        <button
          onClick={copyPrompt}
          className="shrink-0 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
