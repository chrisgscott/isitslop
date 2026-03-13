const DIMENSION_LABELS: Record<string, string> = {
  error_handling: 'Error Handling',
  code_structure: 'Code Structure',
  test_coverage: 'Test Coverage',
  security: 'Security',
  dependencies: 'Dependencies',
  documentation: 'Documentation',
}

function cleanDimensionName(name: string): string {
  return DIMENSION_LABELS[name.toLowerCase().trim()] ?? name
}

interface VerdictProps {
  verdict: string
}

export function Verdict({ verdict }: VerdictProps) {
  const lines = verdict.split('\n').filter(Boolean)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {lines.map((line, i) => {
        // Match "**Dimension:** commentary" or "dimension: commentary" (no bold)
        const dimMatch = line.match(/^\*?\*?(.+?):\*?\*?\s+(.+)$/)
        if (dimMatch) {
          const label = cleanDimensionName(dimMatch[1])
          // Only treat as dimension line if label is a known dimension
          if (Object.values(DIMENSION_LABELS).includes(label)) {
            return (
              <div key={i} className="text-sm">
                <span className="font-bold text-zinc-300">{label}:</span>{' '}
                <span className="text-zinc-400">{dimMatch[2]}</span>
              </div>
            )
          }
        }
        return (
          <p key={i} className="text-lg text-zinc-200 leading-relaxed">
            {line}
          </p>
        )
      })}
    </div>
  )
}
