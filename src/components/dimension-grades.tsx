'use client'

import { motion } from 'motion/react'
import type { DimensionScores, DimensionKey, LetterGrade } from '@/types/analysis'

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  error_handling: 'Error Handling',
  test_coverage: 'Test Coverage',
  documentation: 'Documentation',
  security: 'Security',
  code_structure: 'Code Structure',
  dependencies: 'Dependencies',
}

function gradeClass(grade: LetterGrade): string {
  switch (grade) {
    case 'A': return 'grade-a'
    case 'B': return 'grade-b'
    case 'C': return 'grade-c'
    case 'D': return 'grade-d'
    case 'F': return 'grade-f'
  }
}

interface DimensionGradesProps {
  scores: DimensionScores
}

export function DimensionGrades({ scores }: DimensionGradesProps) {
  const dimensions = Object.entries(scores) as [DimensionKey, { score: number; grade: LetterGrade; findings_count: number }][]

  return (
    <div>
      {/* Table header */}
      <div className="flex items-center text-xs tracking-[0.2em] uppercase text-[var(--color-ink-faint)] border-b border-[var(--color-paper-line)] pb-2 mb-1">
        <div className="flex-1">Subject</div>
        <div className="w-16 text-center">Grade</div>
        <div className="w-14 text-center">Score</div>
        <div className="w-14 text-center">Issues</div>
      </div>

      {/* Grade rows */}
      {dimensions.map(([key, data], i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.8 + i * 0.07 }}
          className="flex items-center py-3 border-b border-[var(--color-paper-line)]/50"
        >
          <div className="flex-1 text-base">
            {DIMENSION_LABELS[key]}
          </div>
          <div className={`w-16 text-center text-2xl font-bold ${gradeClass(data.grade)}`}>
            {data.grade}
          </div>
          <div className="w-14 text-center text-sm font-[family-name:var(--font-mono)] text-[var(--color-ink-light)]">
            {data.score}
          </div>
          <div className="w-14 text-center text-sm font-[family-name:var(--font-mono)] text-[var(--color-ink-light)]">
            {data.findings_count || '\u2014'}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
