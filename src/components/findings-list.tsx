'use client'

import { motion } from 'motion/react'
import type { Finding } from '@/types/analysis'
import { FixPromptCard } from './fix-prompt-card'

interface FindingsListProps {
  findings: Finding[]
  analysisId: string
}

export function FindingsList({ findings, analysisId }: FindingsListProps) {
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const indexed = findings.map((f, i) => ({ ...f, originalIndex: i }))
  const sorted = [...indexed].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 1.8 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-ink-faint)]">
          Areas for Improvement
        </p>
        <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)]">
          ({findings.length})
        </span>
        <div className="flex-1 border-t border-[var(--color-paper-line)]" />
      </div>
      <div className="space-y-4">
        {sorted.map((finding) => (
          <FixPromptCard
            key={finding.originalIndex}
            finding={finding}
            analysisId={analysisId}
            originalIndex={finding.originalIndex}
          />
        ))}
      </div>
    </motion.div>
  )
}
