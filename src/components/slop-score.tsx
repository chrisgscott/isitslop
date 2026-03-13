'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

interface SlopScoreProps {
  score: number
}

function getScoreColor(score: number): string {
  if (score <= 20) return '#22ff44'
  if (score <= 40) return '#a3ff12'
  if (score <= 60) return '#facc15'
  if (score <= 80) return '#fb923c'
  return '#ef4444'
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

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 1200
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
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
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="text-center space-y-3"
    >
      <div className="relative inline-block">
        {/* Glow layer */}
        <div
          className="absolute inset-0 blur-[60px] opacity-30 score-glow"
          style={{ backgroundColor: color }}
        />
        <div
          className="relative text-[10rem] sm:text-[12rem] font-black tabular-nums leading-none"
          style={{ color }}
        >
          <AnimatedNumber value={score} />
        </div>
      </div>
      <div className="text-xs font-mono text-zinc-600 uppercase tracking-[0.25em]">
        Slop Score
      </div>
      <div
        className="text-sm font-mono font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {getScoreLabel(score)}
      </div>
    </motion.div>
  )
}
