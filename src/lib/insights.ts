import { db } from '@/lib/db'
import type { DimensionKey, DimensionScores, Finding, LetterGrade } from '@/types/analysis'

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  code_structure: 'Code Structure',
  error_handling: 'Error Handling',
  test_coverage: 'Test Coverage',
  security: 'Security',
  dependencies: 'Dependencies',
  documentation: 'Documentation',
}

export interface DimensionStats {
  key: DimensionKey
  label: string
  avg_score: number
  grades: Record<LetterGrade, number>
  total: number
}

export interface TopFinding {
  issue: string
  dimension: DimensionKey
  repos_affected: number
}

export interface InsightsData {
  total_repos: number
  avg_score: number
  dimension_stats: DimensionStats[]
  top_findings: TopFinding[]
}

export async function getInsights(): Promise<InsightsData | null> {
  const { rows: data } = await db.query(
    `SELECT slop_score, scores, receipts FROM analyses
     WHERE status = 'complete' AND slop_score IS NOT NULL AND scores IS NOT NULL`
  )

  if (!data || data.length === 0) return null

  const total_repos = data.length
  const avg_score = Math.round(
    data.reduce((sum, r) => sum + (100 - (r.slop_score ?? 0)), 0) / total_repos
  )

  // Aggregate dimension stats
  const dimAgg: Record<DimensionKey, { scores: number[]; grades: Record<LetterGrade, number> }> = {} as never
  const allDimensions: DimensionKey[] = ['code_structure', 'error_handling', 'test_coverage', 'security', 'dependencies', 'documentation']

  for (const dim of allDimensions) {
    dimAgg[dim] = { scores: [], grades: { A: 0, B: 0, C: 0, D: 0, F: 0 } }
  }

  for (const row of data) {
    const scores = row.scores as DimensionScores
    for (const [key, val] of Object.entries(scores)) {
      const dim = key as DimensionKey
      if (dimAgg[dim]) {
        dimAgg[dim].scores.push(val.score)
        dimAgg[dim].grades[val.grade]++
      }
    }
  }

  const dimension_stats: DimensionStats[] = allDimensions
    .map((key) => ({
      key,
      label: DIMENSION_LABELS[key],
      avg_score: Math.round(dimAgg[key].scores.reduce((a, b) => a + b, 0) / dimAgg[key].scores.length),
      grades: dimAgg[key].grades,
      total: dimAgg[key].scores.length,
    }))
    .sort((a, b) => a.avg_score - b.avg_score)

  // Aggregate top findings by unique issue text, count distinct repos
  const findingMap = new Map<string, { dimension: DimensionKey; repos: Set<number> }>()

  for (let i = 0; i < data.length; i++) {
    const receipts = data[i].receipts as Finding[] | null
    if (!receipts) continue
    for (const f of receipts) {
      // Normalize: strip specific numbers from file-size findings for grouping
      const normalized = f.issue
        .replace(/\(\d+ lines\)/, '(N lines)')
        .replace(/\(\d+ levels\)/, '(N levels)')
      const key = `${f.dimension}::${normalized}`
      if (!findingMap.has(key)) {
        findingMap.set(key, { dimension: f.dimension, repos: new Set() })
      }
      findingMap.get(key)!.repos.add(i)
    }
  }

  const top_findings: TopFinding[] = Array.from(findingMap.entries())
    .map(([key, val]) => ({
      issue: key.split('::')[1],
      dimension: val.dimension,
      repos_affected: val.repos.size,
    }))
    .sort((a, b) => b.repos_affected - a.repos_affected)
    .slice(0, 8)

  return {
    total_repos,
    avg_score,
    dimension_stats,
    top_findings,
  }
}
