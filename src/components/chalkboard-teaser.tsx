import { getInsights } from '@/lib/insights'
import type { LetterGrade } from '@/types/analysis'
import Link from 'next/link'

function scoreToGrade(score: number): LetterGrade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function gradeColor(grade: LetterGrade): string {
  switch (grade) {
    case 'A': return '#7ec87e'
    case 'B': return '#a8c97e'
    case 'C': return '#e8d44d'
    case 'D': return '#e8a44d'
    case 'F': return '#e85d5d'
  }
}

export async function ChalkboardTeaser() {
  const data = await getInsights()
  if (!data || data.total_repos < 3) return null

  const worstDim = data.dimension_stats[0] // already sorted by avg_score asc
  const failRate = Math.round((worstDim.grades.F / worstDim.total) * 100)

  return (
    <Link href="/insights" className="block w-full max-w-lg group">
      <div className="bg-[#2a3a2a] border-[8px] border-[#5c4033] rounded-sm p-6 shadow-[inset_0_0_40px_rgba(0,0,0,0.3)] transition-all group-hover:border-[#6d5040]">
        <p className="text-[#c8c8a0] text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4">
          Class Performance — {data.total_repos} repos graded
        </p>

        <div className="flex items-center gap-6">
          {/* Average score */}
          <div className="text-center shrink-0">
            <div
              className="text-5xl font-bold"
              style={{
                fontFamily: 'var(--font-hand), cursive',
                color: gradeColor(scoreToGrade(data.avg_score)),
                textShadow: '0 0 15px rgba(255,255,255,0.08)',
              }}
            >
              {data.avg_score}
            </div>
            <p className="text-[#c8c8a0] text-[10px] opacity-50 mt-0.5">class avg</p>
          </div>

          {/* Worst dimension callout */}
          <div className="flex-1 min-w-0">
            <p className="text-[#c8c8a0] text-sm opacity-80 leading-snug">
              <span style={{ color: '#e85d5d' }}>{failRate}%</span> of repos fail{' '}
              <span className="text-white/80">{worstDim.label}</span>
            </p>
            <p className="text-[#c8c8a0] text-xs opacity-40 mt-1 italic"
              style={{ fontFamily: 'var(--font-hand), cursive' }}>
              The bell curve has left the building.
            </p>
          </div>

          {/* Arrow */}
          <span className="text-[#c8c8a0] opacity-30 group-hover:opacity-60 transition-opacity text-lg shrink-0">
            &rarr;
          </span>
        </div>
      </div>
    </Link>
  )
}
