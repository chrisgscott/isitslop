'use client'

import { motion } from 'motion/react'
import type { HistoryRun } from '@/lib/repo-history'
import type { DimensionKey } from '@/types/analysis'

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  code_structure: 'Code Structure',
  error_handling: 'Error Handling',
  test_coverage: 'Test Coverage',
  security: 'Security',
  dependencies: 'Dependencies',
  documentation: 'Documentation',
}

function Sparkline({ values, currentIndex, color }: { values: number[]; currentIndex: number; color: string }) {
  const width = 200
  const height = 40
  const padding = 4

  if (values.length < 2) return null

  const min = 0
  const max = 100
  const xStep = (width - padding * 2) / (values.length - 1)

  const points = values.map((v, i) => ({
    x: padding + i * xStep,
    y: padding + (height - padding * 2) * (1 - (v - min) / (max - min)),
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid line at 50 */}
      <line
        x1={padding} y1={height / 2}
        x2={width - padding} y2={height / 2}
        stroke="var(--color-paper-line)" strokeWidth="0.5" strokeDasharray="2 2"
      />
      {/* Trend line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />
      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === currentIndex ? 4 : 2.5}
          fill={i === currentIndex ? color : 'var(--color-paper)'}
          stroke={color}
          strokeWidth={i === currentIndex ? 2 : 1.5}
        />
      ))}
    </svg>
  )
}

interface ScoreTrendProps {
  runs: HistoryRun[]
  currentIndex: number
}

export function ScoreTrend({ runs, currentIndex }: ScoreTrendProps) {
  const currentRun = runs[currentIndex]
  const prevRun = currentIndex > 0 ? runs[currentIndex - 1] : null
  const scoreDelta = prevRun ? currentRun.score - prevRun.score : 0

  return (
    <div>
      {/* Overall trend header */}
      <div className="flex items-center gap-4 mb-4">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-ink-faint)]">
            Run {currentIndex + 1} of {runs.length}
          </p>
          {prevRun && (
            <p className="text-sm mt-0.5">
              {scoreDelta > 0 ? (
                <span className="text-[var(--color-green-ink)]">+{scoreDelta} points since last run</span>
              ) : scoreDelta < 0 ? (
                <span className="text-[var(--color-red-ink)]">{scoreDelta} points since last run</span>
              ) : (
                <span className="text-[var(--color-ink-light)]">No change since last run</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Overall score sparkline */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-ink-faint)] w-24 shrink-0">Overall</span>
          <Sparkline
            values={runs.map((r) => r.score)}
            currentIndex={currentIndex}
            color="var(--color-ink)"
          />
          <span className="text-sm font-[family-name:var(--font-mono)] text-[var(--color-ink-light)] w-8 text-right">
            {currentRun.score}
          </span>
        </div>
      </div>

      {/* Per-dimension sparklines */}
      <div className="space-y-2">
        {(Object.keys(DIMENSION_LABELS) as DimensionKey[]).map((dim) => {
          const values = runs.map((r) => r.dimension_scores[dim] ?? 0)
          const current = currentRun.dimension_scores[dim] ?? 0
          const prev = prevRun?.dimension_scores[dim] ?? null
          const delta = prev !== null ? current - prev : null

          return (
            <div key={dim} className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-ink-faint)] w-24 shrink-0 truncate">
                {DIMENSION_LABELS[dim]}
              </span>
              <Sparkline
                values={values}
                currentIndex={currentIndex}
                color={current >= 80 ? 'var(--color-green-ink)'
                  : current >= 60 ? 'var(--color-blue-ink)'
                  : current >= 40 ? 'var(--color-amber-ink)'
                  : 'var(--color-red-ink)'}
              />
              <span className="text-sm font-[family-name:var(--font-mono)] text-[var(--color-ink-light)] w-8 text-right">
                {current}
              </span>
              {delta !== null && delta !== 0 && (
                <span className={`text-xs w-8 ${delta > 0 ? 'text-[var(--color-green-ink)]' : 'text-[var(--color-red-ink)]'}`}>
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Run dates */}
      <div className="mt-4 flex gap-3 flex-wrap">
        {runs.map((run, i) => {
          const date = new Date(run.analyzed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <a
              key={run.id}
              href={`/r/${run.id}`}
              className={`text-xs font-[family-name:var(--font-mono)] px-2 py-0.5 rounded transition-colors ${
                i === currentIndex
                  ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                  : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]'
              }`}
            >
              {date}
            </a>
          )
        })}
      </div>
    </div>
  )
}
