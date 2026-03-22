import { createServiceClient } from '@/lib/supabase/server'
import type { Analysis, DimensionKey, Finding } from '@/types/analysis'

export interface HistoryRun {
  id: string
  analyzed_at: string
  score: number
  dimension_scores: Record<DimensionKey, number>
}

export interface FindingDiff {
  fixed: Finding[]
  outstanding: Finding[]
  new_findings: Finding[]
}

export interface RepoHistory {
  runs: HistoryRun[]
  current_index: number
  finding_diff: FindingDiff | null
}

export async function getRepoHistory(
  currentAnalysisId: string,
  repoOwner: string,
  repoName: string,
): Promise<RepoHistory | null> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('analyses')
    .select('id, analyzed_at, slop_score, scores, receipts')
    .eq('repo_owner', repoOwner)
    .eq('repo_name', repoName)
    .eq('status', 'complete')
    .not('slop_score', 'is', null)
    .not('scores', 'is', null)
    .order('analyzed_at', { ascending: true })

  if (!data || data.length < 2) return null

  const runs: HistoryRun[] = data.map((row) => {
    const scores = row.scores as Analysis['scores']
    const dimension_scores: Record<string, number> = {}
    if (scores) {
      for (const [key, val] of Object.entries(scores)) {
        dimension_scores[key] = val.score
      }
    }
    return {
      id: row.id,
      analyzed_at: row.analyzed_at ?? row.id,
      score: 100 - (row.slop_score ?? 0),
      dimension_scores: dimension_scores as Record<DimensionKey, number>,
    }
  })

  const current_index = runs.findIndex((r) => r.id === currentAnalysisId)
  if (current_index < 0) return null

  // Compute finding diff against the previous run
  let finding_diff: FindingDiff | null = null
  if (current_index > 0) {
    const prevRow = data[current_index - 1]
    const currRow = data[current_index]
    const prevFindings = (prevRow.receipts as Finding[]) ?? []
    const currFindings = (currRow.receipts as Finding[]) ?? []

    finding_diff = diffFindings(prevFindings, currFindings)
  }

  return { runs, current_index, finding_diff }
}

function findingKey(f: Finding): string {
  // Match on dimension + file + normalized issue
  const normalized = f.issue
    .replace(/\(\d+ lines\)/, '(N lines)')
    .replace(/\(\d+ levels\)/, '(N levels)')
  return `${f.dimension}::${f.file ?? 'unknown'}::${normalized}`
}

function diffFindings(prev: Finding[], curr: Finding[]): FindingDiff {
  const prevKeys = new Map<string, Finding>()
  for (const f of prev) {
    prevKeys.set(findingKey(f), f)
  }

  const currKeys = new Map<string, Finding>()
  for (const f of curr) {
    currKeys.set(findingKey(f), f)
  }

  const fixed: Finding[] = []
  const outstanding: Finding[] = []
  const new_findings: Finding[] = []

  // Findings in prev but not in curr = fixed
  for (const [key, f] of prevKeys) {
    if (!currKeys.has(key)) {
      fixed.push(f)
    }
  }

  // Findings in both = outstanding
  // Findings in curr but not prev = new
  for (const [key, f] of currKeys) {
    if (prevKeys.has(key)) {
      outstanding.push(f)
    } else {
      new_findings.push(f)
    }
  }

  return { fixed, outstanding, new_findings }
}
