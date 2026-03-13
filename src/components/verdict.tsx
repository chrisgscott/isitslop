interface VerdictProps {
  verdict: string
}

export function Verdict({ verdict }: VerdictProps) {
  const lines = verdict.split('\n').filter(Boolean)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {lines.map((line, i) => {
        const dimMatch = line.match(/^\*\*(.+?):\*\*\s*(.+)$/)
        if (dimMatch) {
          return (
            <div key={i} className="text-sm">
              <span className="font-bold text-zinc-300">{dimMatch[1]}:</span>{' '}
              <span className="text-zinc-400">{dimMatch[2]}</span>
            </div>
          )
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
