import type { DimensionScores, DimensionKey, LetterGrade } from '@/types/analysis'

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  error_handling: 'Error Handling',
  test_coverage: 'Tests',
  documentation: 'Docs',
  security: 'Security',
  code_structure: 'Structure',
  dependencies: 'Dependencies',
}

function gradeColor(grade: LetterGrade): string {
  switch (grade) {
    case 'A': return 'text-green-400 border-green-400/30'
    case 'B': return 'text-lime-400 border-lime-400/30'
    case 'C': return 'text-yellow-400 border-yellow-400/30'
    case 'D': return 'text-orange-400 border-orange-400/30'
    case 'F': return 'text-red-400 border-red-400/30'
  }
}

interface DimensionGradesProps {
  scores: DimensionScores
}

export function DimensionGrades({ scores }: DimensionGradesProps) {
  const dimensions = Object.entries(scores) as [DimensionKey, { score: number; grade: LetterGrade; findings_count: number }][]

  return (
    <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
      {dimensions.map(([key, data]) => (
        <div
          key={key}
          className={`border rounded-lg p-3 text-center ${gradeColor(data.grade)}`}
        >
          <div className="text-3xl font-black">{data.grade}</div>
          <div className="text-xs text-zinc-500 mt-1">{DIMENSION_LABELS[key]}</div>
        </div>
      ))}
    </div>
  )
}
