interface SlopScoreProps {
  score: number
}

function getScoreColor(score: number): string {
  if (score <= 20) return 'text-green-400'
  if (score <= 40) return 'text-lime-400'
  if (score <= 60) return 'text-yellow-400'
  if (score <= 80) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreLabel(score: number): string {
  if (score <= 10) return 'Pristine'
  if (score <= 25) return 'Pretty Clean'
  if (score <= 40) return 'Needs Work'
  if (score <= 55) return 'Kinda Sloppy'
  if (score <= 70) return 'Sloppy'
  if (score <= 85) return 'Sloppy AF'
  return 'Certified Slop'
}

export function SlopScore({ score }: SlopScoreProps) {
  return (
    <div className="text-center space-y-2">
      <div className={`text-8xl font-black tabular-nums ${getScoreColor(score)}`}>
        {score}
      </div>
      <div className="text-sm font-mono text-zinc-500 uppercase tracking-widest">
        Slop Score
      </div>
      <div className={`text-lg font-bold ${getScoreColor(score)}`}>
        {getScoreLabel(score)}
      </div>
    </div>
  )
}
