import { createServiceClient } from '@/lib/supabase/server'

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return n.toLocaleString()
}

export async function SnarkyStats() {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('analyses')
    .select('slop_score, metadata, scores')
    .eq('status', 'complete')
    .not('slop_score', 'is', null)

  if (!data || data.length < 3) return null

  const totalRepos = data.length
  const totalLoc = data.reduce((sum, r) => {
    const loc = (r.metadata as { total_loc?: number })?.total_loc ?? 0
    return sum + loc
  }, 0)
  const fCount = data.filter((r) => {
    const cs = (r.scores as { code_structure?: { grade: string } })?.code_structure
    return cs?.grade === 'F'
  }).length
  const fPct = Math.round((fCount / totalRepos) * 100)

  const stats = [
    { value: formatNumber(totalRepos), label: 'repos graded' },
    { value: formatNumber(totalLoc), label: 'lines of "code" read' },
    { value: `${fPct}%`, label: 'failing Code Structure' },
    { value: '0', label: 'fucks given' },
  ]

  return (
    <div className="w-full max-w-lg">
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
        {stats.map((stat, i) => (
          <div key={i} className="text-center">
            <span className="text-lg font-bold font-[family-name:var(--font-mono)]">
              {stat.value}
            </span>
            <span className="text-xs text-[var(--color-ink-faint)] italic ml-1.5">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
