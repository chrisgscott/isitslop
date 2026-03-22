import { getInsights } from '@/lib/insights'
import type { Metadata } from 'next'
import type { LetterGrade } from '@/types/analysis'

export const revalidate = 300 // refresh every 5 minutes

export const metadata: Metadata = {
  title: 'Class Performance — IsItSlop',
  description: 'Aggregate analysis across all repos graded by IsItSlop. See which subjects students fail most.',
}

function gradeColor(grade: LetterGrade): string {
  switch (grade) {
    case 'A': return 'text-[#7ec87e]'
    case 'B': return 'text-[#a8c97e]'
    case 'C': return 'text-[#e8d44d]'
    case 'D': return 'text-[#e8a44d]'
    case 'F': return 'text-[#e85d5d]'
  }
}

function scoreToGrade(score: number): LetterGrade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

export default async function InsightsPage() {
  const data = await getInsights()

  if (!data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <p className="text-xl italic text-[var(--color-ink-light)]">
          No grades to report yet. Check back after some repos have been analyzed.
        </p>
        <a href="/" className="mt-6 text-sm text-[var(--color-ink-light)] hover:text-[var(--color-red-ink)] italic transition-colors">
          &larr; Back to class
        </a>
      </main>
    )
  }

  const overallGrade = scoreToGrade(data.avg_score)

  return (
    <main className="min-h-screen py-12 sm:py-20 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <header className="pb-8 border-b border-[var(--color-paper-line)]">
          <p className="text-xs tracking-[0.4em] uppercase text-[var(--color-ink-faint)]">
            Department of Vibe Code Assessment
          </p>
          <h1 className="text-4xl sm:text-5xl italic mt-2">
            Class Performance
          </h1>
          <p className="text-sm text-[var(--color-ink-light)] mt-2">
            Aggregate findings across {data.total_repos} graded {data.total_repos === 1 ? 'repo' : 'repos'}
          </p>
        </header>

        {/* Chalkboard - overall stats */}
        <section className="my-10 rounded-sm overflow-hidden">
          <div className="bg-[#2a3a2a] border-[12px] border-[#5c4033] p-8 sm:p-10 shadow-[inset_0_0_60px_rgba(0,0,0,0.3)]">
            <p className="text-[#c8c8a0] text-xs tracking-[0.3em] uppercase mb-6 opacity-70">
              This semester&apos;s class average
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-8 sm:gap-12">
              {/* Big score */}
              <div className="text-center">
                <div className={`text-7xl sm:text-8xl font-bold ${gradeColor(overallGrade)}`}
                  style={{ fontFamily: 'var(--font-hand), cursive', textShadow: '0 0 20px rgba(255,255,255,0.1)' }}>
                  {data.avg_score}
                </div>
                <p className="text-[#c8c8a0] text-sm opacity-60 mt-1">avg score</p>
              </div>

              {/* Dimension breakdown */}
              <div className="flex-1 w-full">
                <div className="grid grid-cols-1 gap-2">
                  {data.dimension_stats.map((dim) => {
                    const dimGrade = scoreToGrade(dim.avg_score)
                    const failRate = Math.round((dim.grades.F / dim.total) * 100)
                    return (
                      <div key={dim.key} className="flex items-center gap-3">
                        <span className="text-[#c8c8a0] text-sm w-32 sm:w-36 truncate opacity-80">
                          {dim.label}
                        </span>
                        <div className="flex-1 h-4 bg-[#1e2e1e] rounded-sm overflow-hidden">
                          <div
                            className="h-full rounded-sm transition-all"
                            style={{
                              width: `${dim.avg_score}%`,
                              backgroundColor: dim.avg_score >= 90 ? '#7ec87e'
                                : dim.avg_score >= 80 ? '#a8c97e'
                                : dim.avg_score >= 70 ? '#e8d44d'
                                : dim.avg_score >= 60 ? '#e8a44d'
                                : '#e85d5d',
                              opacity: 0.8,
                            }}
                          />
                        </div>
                        <span className={`text-sm font-bold w-8 text-center ${gradeColor(dimGrade)}`}
                          style={{ fontFamily: 'var(--font-hand), cursive' }}>
                          {dim.avg_score}
                        </span>
                        {failRate > 0 && (
                          <span className="text-[10px] text-[#e85d5d] opacity-70 w-16 text-right">
                            {failRate}% fail
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <p className="text-[#c8c8a0] text-xs mt-8 opacity-40 italic text-center"
              style={{ fontFamily: 'var(--font-hand), cursive' }}>
              &ldquo;I expected nothing and I&apos;m still disappointed.&rdquo;
            </p>
          </div>
        </section>

        {/* Two columns: grade distribution + top findings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">

          {/* Grade distribution per dimension */}
          <section>
            <h2 className="text-xs tracking-[0.2em] uppercase text-[var(--color-ink-faint)] mb-4">
              Grade Distribution by Subject
            </h2>
            <div className="space-y-4">
              {data.dimension_stats.map((dim) => (
                <div key={dim.key}>
                  <p className="text-sm mb-1">{dim.label}</p>
                  <div className="flex gap-0.5 h-6">
                    {(['A', 'B', 'C', 'D', 'F'] as LetterGrade[]).map((grade) => {
                      const count = dim.grades[grade]
                      if (count === 0) return null
                      const pct = (count / dim.total) * 100
                      const colors: Record<LetterGrade, string> = {
                        A: 'bg-[var(--color-green-ink)]',
                        B: 'bg-[var(--color-green-ink)]/60',
                        C: 'bg-[var(--color-amber-ink)]',
                        D: 'bg-[var(--color-orange-ink)]',
                        F: 'bg-[var(--color-red-ink)]',
                      }
                      return (
                        <div
                          key={grade}
                          className={`${colors[grade]} flex items-center justify-center text-[10px] font-bold text-white/90 first:rounded-l-sm last:rounded-r-sm`}
                          style={{ width: `${pct}%`, minWidth: count > 0 ? '18px' : 0 }}
                          title={`${grade}: ${count} repos (${Math.round(pct)}%)`}
                        >
                          {pct >= 15 ? grade : ''}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Top findings */}
          <section>
            <h2 className="text-xs tracking-[0.2em] uppercase text-[var(--color-ink-faint)] mb-4">
              Most Common Findings
            </h2>
            <div className="space-y-3">
              {data.top_findings.map((finding, i) => {
                const pct = Math.round((finding.repos_affected / data.total_repos) * 100)
                return (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-red-ink)] w-10 text-right shrink-0 pt-0.5">
                      {pct}%
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{finding.issue}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">
                        {finding.repos_affected} of {data.total_repos} repos
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-[var(--color-paper-line)] text-center space-y-4">
          <p className="handwriting text-[var(--color-red-ink)] text-lg">
            Think your repo can beat the curve?
          </p>
          <a href="/" className="inline-block text-sm text-[var(--color-ink-light)] hover:text-[var(--color-red-ink)] italic transition-colors">
            &larr; Submit your repo
          </a>
        </footer>
      </div>
    </main>
  )
}
