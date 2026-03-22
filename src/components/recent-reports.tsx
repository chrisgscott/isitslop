import { createServiceClient } from '@/lib/supabase/server'
import { isRepoNameSafe } from '@/lib/content-filter'
import Link from 'next/link'
import type { LetterGrade } from '@/types/analysis'

function scoreToGrade(score: number): LetterGrade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function gradeClass(grade: LetterGrade): string {
  switch (grade) {
    case 'A': return 'text-[var(--color-green-ink)]'
    case 'B': return 'text-[var(--color-green-ink)]/80'
    case 'C': return 'text-[var(--color-amber-ink)]'
    case 'D': return 'text-[var(--color-orange-ink)]'
    case 'F': return 'text-[var(--color-red-ink)]'
  }
}

export async function RecentReports() {
  const supabase = createServiceClient()

  // Get most recent completed analysis per repo (deduplicated)
  const { data } = await supabase
    .from('analyses')
    .select('id, repo_owner, repo_name, slop_score, analyzed_at')
    .eq('status', 'complete')
    .not('slop_score', 'is', null)
    .order('analyzed_at', { ascending: false })
    .limit(50)

  if (!data || data.length === 0) return null

  // Deduplicate by repo — keep only the most recent run
  const seen = new Set<string>()
  const unique = data.filter((row) => {
    const key = `${row.repo_owner}/${row.repo_name}`
    if (seen.has(key)) return false
    if (!isRepoNameSafe(row.repo_owner, row.repo_name)) return false
    seen.add(key)
    return true
  }).slice(0, 8)

  if (unique.length < 2) return null

  return (
    <div className="w-full max-w-lg">
      <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-ink-faint)] mb-3 text-center">
        Recent Report Cards
      </p>
      <div className="space-y-1">
        {unique.map((row) => {
          const score = 100 - (row.slop_score ?? 0)
          const grade = scoreToGrade(score)
          const date = row.analyzed_at
            ? new Date(row.analyzed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : ''

          return (
            <Link
              key={row.id}
              href={`/r/${row.id}`}
              className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-sm hover:bg-[var(--color-paper-dark)] transition-colors group"
            >
              <span className={`text-lg font-bold w-8 text-center ${gradeClass(grade)}`}>
                {grade}
              </span>
              <span className="flex-1 text-sm font-[family-name:var(--font-mono)] truncate group-hover:text-[var(--color-red-ink)] transition-colors">
                {row.repo_owner}/{row.repo_name}
              </span>
              <span className="text-xs text-[var(--color-ink-faint)] font-[family-name:var(--font-mono)] shrink-0">
                {score}
              </span>
              <span className="text-xs text-[var(--color-ink-faint)] shrink-0 w-14 text-right">
                {date}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
