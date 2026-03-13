'use client'

import { motion } from 'motion/react'
import type { DimensionScores, DimensionKey, LetterGrade } from '@/types/analysis'

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  error_handling: 'Errors',
  test_coverage: 'Tests',
  documentation: 'Docs',
  security: 'Security',
  code_structure: 'Structure',
  dependencies: 'Deps',
}

function gradeColor(grade: LetterGrade): string {
  switch (grade) {
    case 'A': return '#22ff44'
    case 'B': return '#a3ff12'
    case 'C': return '#facc15'
    case 'D': return '#fb923c'
    case 'F': return '#ef4444'
  }
}

interface DimensionGradesProps {
  scores: DimensionScores
}

export function DimensionGrades({ scores }: DimensionGradesProps) {
  const dimensions = Object.entries(scores) as [DimensionKey, { score: number; grade: LetterGrade; findings_count: number }][]

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-[#1a1a1a] border border-[#1a1a1a] max-w-2xl mx-auto">
      {dimensions.map(([key, data], i) => {
        const color = gradeColor(data.grade)
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#0a0a0a] p-4 text-center relative group"
          >
            {/* Top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ backgroundColor: color, opacity: 0.5 }}
            />
            <div
              className="text-3xl font-black leading-none"
              style={{ color }}
            >
              {data.grade}
            </div>
            <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mt-2">
              {DIMENSION_LABELS[key]}
            </div>
            <div className="text-[10px] font-mono text-zinc-700 mt-0.5">
              {data.score}/100
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
