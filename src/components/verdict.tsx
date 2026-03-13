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

  // Separate the main verdict from dimension commentaries
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
      transition={{ duration: 0.6, delay: 1.2 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      {/* Main verdict */}
      <div className="space-y-4">
        {mainLines.map((line, i) => (
          <p key={i} className="text-lg text-zinc-300 leading-relaxed">
            {line}
          </p>
        ))}
      </div>

      {/* Dimension commentaries */}
      {dimLines.length > 0 && (
        <div className="border-t border-[#1a1a1a] pt-6 space-y-3">
          {dimLines.map((dim, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="font-mono text-zinc-600 uppercase text-xs tracking-wider shrink-0 w-28 pt-0.5">
                {dim.label}
              </span>
              <span className="text-zinc-500">{dim.text}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
