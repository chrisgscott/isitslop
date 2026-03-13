import type { Finding } from '@/types/analysis'
import { FixPromptCard } from './fix-prompt-card'

interface FindingsListProps {
  findings: Finding[]
}

export function FindingsList({ findings }: FindingsListProps) {
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...findings].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  )

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-zinc-200">
        The Receipts ({findings.length})
      </h2>
      {sorted.map((finding, i) => (
        <FixPromptCard key={i} finding={finding} />
      ))}
    </div>
  )
}
