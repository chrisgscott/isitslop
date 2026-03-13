'use client'

import { useEffect, useState } from 'react'

interface SlopScoreProps {
  score: number
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--color-green-ink)'
  if (score >= 60) return 'var(--color-blue-ink)'
  if (score >= 40) return 'var(--color-amber-ink)'
  if (score >= 20) return 'var(--color-orange-ink)'
  return 'var(--color-red-ink)'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Pristine'
  if (score >= 75) return 'Pretty Clean'
  if (score >= 60) return 'Needs Work'
  if (score >= 45) return 'Kinda Sloppy'
  if (score >= 30) return 'Sloppy'
  if (score >= 15) return 'Sloppy AF'
  return 'Certified Slop'
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 800
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  return <>{display}</>
}

export function SlopScore({ score }: SlopScoreProps) {
  const color = getScoreColor(score)

  return (
    <div className="flex justify-center">
      <div
        className="stamp relative inline-flex flex-col items-center justify-center w-36 h-36 rounded-full border-[3px] text-center"
        style={{
          borderColor: color,
          color: color,
        }}
      >
        {/* Double border effect */}
        <div
          className="absolute inset-[3px] rounded-full border pointer-events-none"
          style={{ borderColor: color, opacity: 0.4 }}
        />

        <div className="text-[8px] tracking-[0.25em] uppercase font-[family-name:var(--font-mono)]" style={{ opacity: 0.7 }}>
          Grade
        </div>
        <div className="text-5xl font-bold leading-none tabular-nums">
          <AnimatedNumber value={score} />
        </div>
        <div className="text-[9px] tracking-[0.15em] uppercase mt-0.5 font-[family-name:var(--font-mono)]">
          {getScoreLabel(score)}
        </div>
      </div>
    </div>
  )
}
