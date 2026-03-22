import type { Metadata } from 'next'
import { readFileSync } from 'fs'
import { join } from 'path'

export const metadata: Metadata = {
  title: 'The Rubric — IsItSlop',
  description: 'How IsItSlop grades your code: 6 dimensions, specific thresholds, deterministic scoring. AI writes the verdict, never influences the grade.',
}

interface Check {
  name: string
  severity: string
  threshold: string
  description: string
  exclusions: string[]
}

interface Dimension {
  key: string
  name: string
  weight: number
  description: string
  checks: Check[]
}

interface OptimizationStep {
  name: string
  description: string
}

interface Rubric {
  last_updated: string
  last_change: string
  penalty_points: Record<string, number>
  grade_scale: Record<string, [number, number]>
  dimensions: Dimension[]
  skipped_files: string[]
  optimization_process: OptimizationStep[]
}

function getRubric(): Rubric {
  const raw = readFileSync(join(process.cwd(), 'rubric.json'), 'utf-8')
  return JSON.parse(raw)
}

function SeverityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-[var(--color-red-ink)] text-white',
    high: 'bg-[var(--color-orange-ink)] text-white',
    medium: 'bg-[var(--color-amber-ink)] text-white',
    low: 'bg-[var(--color-ink-light)] text-white',
  }
  return (
    <span className={`text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded-sm ${colors[level] ?? ''}`}>
      {level}
    </span>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function RubricPage() {
  const rubric = getRubric()

  return (
    <main className="min-h-screen py-12 sm:py-20 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <header className="pb-8">
          <p className="text-xs tracking-[0.4em] uppercase text-[var(--color-ink-faint)]">
            Department of Vibe Code Assessment
          </p>
          <h1 className="text-4xl sm:text-5xl italic mt-2">The Rubric</h1>
          <p className="text-lg italic text-[var(--color-ink-light)] mt-3">
            How we grade your code. No curves, no mercy, no AI influence.
          </p>
          <p className="text-xs text-[var(--color-ink-faint)] font-[family-name:var(--font-mono)] mt-3">
            Last optimized {formatDate(rubric.last_updated)} &mdash; {rubric.last_change}
          </p>
        </header>

        {/* Philosophy */}
        <section className="py-8 border-t border-[var(--color-paper-line)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm tracking-[0.15em] uppercase text-[var(--color-ink-faint)] mb-2">
                Deterministic
              </h3>
              <p className="text-sm text-[var(--color-ink-light)]">
                Same repo, same score, every time. No randomness, no AI judgment calls on scoring. Run it twice, get the same number.
              </p>
            </div>
            <div>
              <h3 className="text-sm tracking-[0.15em] uppercase text-[var(--color-ink-faint)] mb-2">
                AI-Free Scoring
              </h3>
              <p className="text-sm text-[var(--color-ink-light)]">
                AI writes the snarky verdict and nothing else. Every score comes from pattern matching and static analysis against the thresholds on this page.
              </p>
            </div>
            <div>
              <h3 className="text-sm tracking-[0.15em] uppercase text-[var(--color-ink-faint)] mb-2">
                Always Improving
              </h3>
              <p className="text-sm text-[var(--color-ink-light)]">
                We run stress tests against real repos, review false positive reports, and tune thresholds continuously. Every flag on a report card has a &ldquo;false positive?&rdquo; button that feeds back into our optimization loop.
              </p>
            </div>
          </div>
        </section>

        {/* How scoring works */}
        <section className="py-8 border-t border-[var(--color-paper-line)]">
          <h2 className="text-2xl italic mb-4">How Scoring Works</h2>
          <div className="space-y-3 text-sm text-[var(--color-ink-light)]">
            <p>
              Each dimension starts at <strong className="text-[var(--color-ink)]">100 points</strong>. Every finding subtracts points based on severity:
            </p>
            <div className="flex gap-4 flex-wrap font-[family-name:var(--font-mono)] text-xs">
              {Object.entries(rubric.penalty_points).map(([level, pts]) => (
                <span key={level}><SeverityBadge level={level} /> &minus;{pts} pts</span>
              ))}
            </div>
            <p>
              Multiple findings stack. Scores are clamped to 0&ndash;100, then weighted by dimension importance and combined into a final grade.
            </p>
            <p>
              <strong className="text-[var(--color-ink)]">Grade scale:</strong>{' '}
              <span className="font-[family-name:var(--font-mono)]">
                {Object.entries(rubric.grade_scale).map(([grade, [min, max]]) => (
                  `${grade} (${min}–${max})`
                )).join(' · ')}
              </span>
            </p>
          </div>
        </section>

        {/* Dimensions */}
        {rubric.dimensions.map((dim) => (
          <section key={dim.key} className="py-8 border-t border-[var(--color-paper-line)]">
            <div className="flex items-baseline gap-3 mb-2">
              <h2 className="text-2xl italic">{dim.name}</h2>
              <span className="text-sm font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)]">
                {dim.weight}% of final score
              </span>
            </div>
            <p className="text-sm text-[var(--color-ink-light)] mb-6">{dim.description}</p>
            <div className="space-y-6">
              {dim.checks.map((check) => (
                <div key={check.name} className="pl-4 border-l-2 border-[var(--color-paper-line)]">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-base font-semibold">{check.name}</p>
                    <SeverityBadge level={check.severity.split(' ')[0]} />
                  </div>
                  <p className="text-sm text-[var(--color-ink-light)] mb-1">{check.description}</p>
                  <p className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)]">
                    Threshold: {check.threshold}
                  </p>
                  {check.exclusions.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-[var(--color-ink-faint)] cursor-pointer hover:text-[var(--color-ink-light)] transition-colors">
                        What we skip
                      </summary>
                      <ul className="mt-1 space-y-0.5">
                        {check.exclusions.map((ex, i) => (
                          <li key={i} className="text-xs text-[var(--color-ink-faint)] pl-3 relative before:content-['–'] before:absolute before:left-0">
                            {ex}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Optimization process */}
        <section className="py-8 border-t border-[var(--color-paper-line)]">
          <h2 className="text-2xl italic mb-4">How We Improve</h2>
          <div className="space-y-4 text-sm text-[var(--color-ink-light)]">
            <p>
              A rubric is only as good as its accuracy. We actively optimize against false positives through {rubric.optimization_process.length} feedback loops:
            </p>
            <div className="space-y-3 pl-4 border-l-2 border-[var(--color-paper-line)]">
              {rubric.optimization_process.map((step) => (
                <div key={step.name}>
                  <p className="text-[var(--color-ink)] font-semibold">{step.name}</p>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
            <p className="italic text-[var(--color-ink-faint)]">
              The goal isn&apos;t zero findings — it&apos;s zero unfair findings.
            </p>
          </div>
        </section>

        {/* What we skip */}
        <section className="py-8 border-t border-[var(--color-paper-line)]">
          <h2 className="text-2xl italic mb-4">What We Skip</h2>
          <div className="text-sm text-[var(--color-ink-light)] space-y-2">
            <p>Some files are excluded from analysis entirely:</p>
            <ul className="space-y-1 pl-4">
              {rubric.skipped_files.map((item, i) => (
                <li key={i} className="relative pl-3 before:content-['–'] before:absolute before:left-0 before:text-[var(--color-ink-faint)]">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="py-8 border-t border-[var(--color-paper-line)] text-center space-y-4">
          <p className="handwriting text-[var(--color-red-ink)] text-lg">
            Now you know how the grading works. No excuses.
          </p>
          <a href="/" className="inline-block text-sm text-[var(--color-ink-light)] hover:text-[var(--color-red-ink)] italic transition-colors">
            &larr; Submit your repo
          </a>
        </footer>
      </div>
    </main>
  )
}
