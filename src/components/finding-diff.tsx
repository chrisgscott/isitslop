'use client'

import { motion } from 'motion/react'
import type { FindingDiff } from '@/lib/repo-history'

const DIMENSION_LABELS: Record<string, string> = {
  code_structure: 'Code Structure',
  error_handling: 'Error Handling',
  test_coverage: 'Test Coverage',
  security: 'Security',
  dependencies: 'Dependencies',
  documentation: 'Documentation',
}

interface FindingDiffSectionProps {
  diff: FindingDiff
}

export function FindingDiffSection({ diff }: FindingDiffSectionProps) {
  const hasFixed = diff.fixed.length > 0
  const hasNew = diff.new_findings.length > 0
  const hasOutstanding = diff.outstanding.length > 0

  if (!hasFixed && !hasNew && !hasOutstanding) return null

  return (
    <div className="space-y-6">
      {/* Summary line */}
      <div className="flex flex-wrap gap-4 text-sm">
        {hasFixed && (
          <span className="text-[var(--color-green-ink)]">
            {diff.fixed.length} fixed
          </span>
        )}
        {hasOutstanding && (
          <span className="text-[var(--color-ink-light)]">
            {diff.outstanding.length} still outstanding
          </span>
        )}
        {hasNew && (
          <span className="text-[var(--color-orange-ink)]">
            {diff.new_findings.length} new
          </span>
        )}
      </div>

      {/* Fixed findings */}
      {hasFixed && (
        <div>
          <p className="text-xs tracking-[0.15em] uppercase text-[var(--color-green-ink)] mb-2">
            Fixed since last run
          </p>
          <div className="space-y-1.5">
            {diff.fixed.slice(0, 10).map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-2 text-sm"
              >
                <span className="text-[var(--color-green-ink)] mt-0.5 shrink-0">&#10003;</span>
                <div className="min-w-0">
                  <span className="text-[var(--color-ink-light)] line-through decoration-[var(--color-green-ink)]/40">
                    {f.issue}
                  </span>
                  {f.file && (
                    <span className="text-xs text-[var(--color-ink-faint)] ml-2 font-[family-name:var(--font-mono)]">
                      {f.file}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
            {diff.fixed.length > 10 && (
              <p className="text-xs text-[var(--color-ink-faint)] italic ml-5">
                +{diff.fixed.length - 10} more fixed
              </p>
            )}
          </div>
        </div>
      )}

      {/* New findings */}
      {hasNew && (
        <div>
          <p className="text-xs tracking-[0.15em] uppercase text-[var(--color-orange-ink)] mb-2">
            New issues since last run
          </p>
          <div className="space-y-1.5">
            {diff.new_findings.slice(0, 10).map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-2 text-sm"
              >
                <span className="text-[var(--color-orange-ink)] mt-0.5 shrink-0 text-xs">&#9679;</span>
                <div className="min-w-0">
                  <span>{f.issue}</span>
                  {f.file && (
                    <span className="text-xs text-[var(--color-ink-faint)] ml-2 font-[family-name:var(--font-mono)]">
                      {f.file}
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-ink-faint)] ml-2">
                    {DIMENSION_LABELS[f.dimension] ?? f.dimension}
                  </span>
                </div>
              </motion.div>
            ))}
            {diff.new_findings.length > 10 && (
              <p className="text-xs text-[var(--color-ink-faint)] italic ml-5">
                +{diff.new_findings.length - 10} more new issues
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
