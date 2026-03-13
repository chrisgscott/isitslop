'use client'

import { motion } from 'motion/react'

const DIMENSION_LABELS: Record<string, string> = {
  error_handling: 'Error Handling',
  code_structure: 'Code Structure',
  test_coverage: 'Test Coverage',
  security: 'Security',
  dependencies: 'Dependencies',
  documentation: 'Documentation',
}

function cleanDimensionName(name: string): string {
  return DIMENSION_LABELS[name.toLowerCase().trim()] ?? name
}

interface VerdictProps {
  verdict: string
}

export function Verdict({ verdict }: VerdictProps) {
  const lines = verdict.split('\n').filter(Boolean)

  const mainLines: string[] = []
  const dimLines: { label: string; text: string }[] = []

  for (const line of lines) {
    const dimMatch = line.match(/^\*?\*?(.+?):\*?\*?\s+(.+)$/)
    if (dimMatch) {
      const label = cleanDimensionName(dimMatch[1])
      if (Object.values(DIMENSION_LABELS).includes(label)) {
        dimLines.push({ label, text: dimMatch[2] })
        continue
      }
    }
    mainLines.push(line)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 1.4 }}
      className="space-y-6"
    >
      <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-ink-faint)]">
        Teacher&apos;s Comments
      </p>

      {/* Main verdict in handwriting */}
      <div className="space-y-3 py-2">
        {mainLines.map((line, i) => (
          <p key={i} className="handwriting text-2xl text-[var(--color-blue-ink)] leading-relaxed">
            {line}
          </p>
        ))}
      </div>

      {/* Dimension notes */}
      {dimLines.length > 0 && (
        <div className="space-y-2.5 pt-2">
          {dimLines.map((dim, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-sm text-[var(--color-ink-faint)] italic shrink-0">
                {dim.label}:
              </span>
              <span className="handwriting text-lg text-[var(--color-blue-ink)]">
                {dim.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
