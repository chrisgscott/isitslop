'use client'

import { useState, useEffect } from 'react'
import type { Finding } from '@/types/analysis'

interface FixPromptCardProps {
  finding: Finding
  analysisId: string
  originalIndex: number
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

function getFlagKey(analysisId: string, index: number): string {
  return `flag:${analysisId}:${index}`
}

export function FixPromptCard({ finding, analysisId, originalIndex }: FixPromptCardProps) {
  const [flagState, setFlagState] = useState<'idle' | 'input' | 'submitting' | 'flagged'>('idle')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(getFlagKey(analysisId, originalIndex))) {
        setFlagState('flagged')
      }
    } catch {
      // localStorage unavailable — ignore
    }
  }, [analysisId, originalIndex])

  async function submitFlag() {
    setFlagState('submitting')
    setError(null)

    try {
      const res = await fetch('/api/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: analysisId,
          finding_index: originalIndex,
          reason: reason.trim() || undefined,
        }),
      })

      if (res.status === 429) {
        setError('Too many flags, try later')
        setFlagState('input')
        return
      }

      if (!res.ok) {
        setError('Something went wrong')
        setFlagState('input')
        return
      }

      setFlagState('flagged')
      try {
        localStorage.setItem(getFlagKey(analysisId, originalIndex), '1')
      } catch {
        // localStorage unavailable — ignore
      }
    } catch {
      setError('Something went wrong')
      setFlagState('input')
    }
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

      <div className="text-xs text-[var(--color-ink-light)] bg-[var(--color-paper-dark)] border border-[var(--color-paper-line)] p-2.5 font-[family-name:var(--font-mono)] leading-relaxed">
        {finding.fix_prompt}
      </div>

      {/* Flag button / input / confirmation */}
      {flagState === 'idle' && (
        <button
          onClick={() => setFlagState('input')}
          className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-light)] uppercase tracking-wider transition-colors"
        >
          Not a real issue?
        </button>
      )}

      {flagState === 'input' && (
        <div className="flex items-stretch gap-0">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this a false positive? (optional)"
            maxLength={500}
            className="flex-1 text-xs font-[family-name:var(--font-mono)] bg-white border border-[var(--color-paper-line)] border-r-0 p-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:outline-none"
          />
          <button
            onClick={submitFlag}
            className="shrink-0 px-4 text-[10px] font-[family-name:var(--font-mono)] bg-[var(--color-paper-dark)] border border-[var(--color-paper-line)] text-[var(--color-ink-light)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-line)]/30 transition-colors uppercase tracking-wider"
          >
            Submit
          </button>
        </div>
      )}

      {flagState === 'submitting' && (
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)] uppercase tracking-wider">
          Submitting...
        </p>
      )}

      {flagState === 'flagged' && (
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)] uppercase tracking-wider">
          Flagged — thanks
        </p>
      )}

      {error && (
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--color-red-ink)]">
          {error}
        </p>
      )}
    </div>
  )
}
