'use client'

import { useState } from 'react'
import type { Finding } from '@/types/analysis'

interface FixPromptCardProps {
  finding: Finding
}

function severityStyles(severity: string): { border: string; accent: string; bg: string } {
  switch (severity) {
    case 'critical': return { border: 'border-red-500/30', accent: 'text-red-400', bg: 'bg-red-500/[0.03]' }
    case 'high': return { border: 'border-orange-500/30', accent: 'text-orange-400', bg: 'bg-orange-500/[0.03]' }
    case 'medium': return { border: 'border-yellow-500/30', accent: 'text-yellow-400', bg: 'bg-yellow-500/[0.03]' }
    case 'low': return { border: 'border-zinc-700/50', accent: 'text-zinc-500', bg: 'bg-zinc-800/20' }
    default: return { border: 'border-zinc-800', accent: 'text-zinc-500', bg: '' }
  }
}

export function FixPromptCard({ finding }: FixPromptCardProps) {
  const [copied, setCopied] = useState(false)
  const styles = severityStyles(finding.severity)

  function copyPrompt() {
    navigator.clipboard.writeText(finding.fix_prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`border ${styles.border} ${styles.bg} p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono uppercase tracking-wider ${styles.accent}`}>
              {finding.severity}
            </span>
            {finding.file && (
              <>
                <span className="text-zinc-700">/</span>
                <span className="text-xs font-mono text-zinc-600">
                  {finding.file}{finding.line ? `:${finding.line}` : ''}
                </span>
              </>
            )}
          </div>
          <p className="text-sm text-zinc-300">{finding.issue}</p>
        </div>
      </div>

      {finding.evidence && (
        <pre className="text-xs font-mono text-zinc-600 bg-[#0a0a0a] border border-[#1a1a1a] p-3 overflow-x-auto">
          {finding.evidence}
        </pre>
      )}

      <div className="flex items-stretch gap-0">
        <div className="flex-1 text-xs text-zinc-500 bg-[#0a0a0a] border border-[#1a1a1a] border-r-0 p-3 font-mono leading-relaxed">
          {finding.fix_prompt}
        </div>
        <button
          onClick={copyPrompt}
          className="shrink-0 px-4 text-xs font-mono bg-[#111] border border-[#1a1a1a] text-zinc-500 hover:text-[#22ff44] hover:border-[#22ff44]/30 transition-colors uppercase tracking-wider"
        >
          {copied ? 'OK' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
