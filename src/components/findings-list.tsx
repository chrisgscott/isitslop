'use client'

import { motion } from 'motion/react'
import type { Finding } from '@/types/analysis'
import { FixPromptCard } from './fix-prompt-card'

interface FindingsListProps {
  findings: Finding[]
}

export function FindingsList({ findings }: FindingsListProps) {
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...findings].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 1.5 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-[0.2em]">
          The Receipts
        </h2>
        <span className="text-xs font-mono text-zinc-700">
          {findings.length}
        </span>
        <div className="flex-1 h-px bg-[#1a1a1a]" />
      </div>
      <div className="space-y-2">
        {sorted.map((finding, i) => (
          <FixPromptCard key={i} finding={finding} />
        ))}
      </div>
    </motion.div>
  )
}
