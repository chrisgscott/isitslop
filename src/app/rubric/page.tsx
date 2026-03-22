import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Rubric — IsItSlop',
  description: 'How IsItSlop grades your code: 6 dimensions, specific thresholds, deterministic scoring. AI writes the verdict, never influences the grade.',
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

function DimensionSection({
  name,
  weight,
  description,
  children,
}: {
  name: string
  weight: number
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="py-8 border-t border-[var(--color-paper-line)]">
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="text-2xl italic">{name}</h2>
        <span className="text-sm font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)]">
          {weight}% of final score
        </span>
      </div>
      <p className="text-sm text-[var(--color-ink-light)] mb-6">{description}</p>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

function Check({
  name,
  severity,
  threshold,
  description,
  exclusions,
}: {
  name: string
  severity: string
  threshold: string
  description: string
  exclusions?: string[]
}) {
  return (
    <div className="pl-4 border-l-2 border-[var(--color-paper-line)]">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-base font-semibold">{name}</p>
        <SeverityBadge level={severity} />
      </div>
      <p className="text-sm text-[var(--color-ink-light)] mb-1">{description}</p>
      <p className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-ink-faint)]">
        Threshold: {threshold}
      </p>
      {exclusions && exclusions.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-[var(--color-ink-faint)] cursor-pointer hover:text-[var(--color-ink-light)] transition-colors">
            What we skip
          </summary>
          <ul className="mt-1 space-y-0.5">
            {exclusions.map((ex, i) => (
              <li key={i} className="text-xs text-[var(--color-ink-faint)] pl-3 relative before:content-['–'] before:absolute before:left-0">
                {ex}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export default function RubricPage() {
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
              <span><SeverityBadge level="critical" /> &minus;20 pts</span>
              <span><SeverityBadge level="high" /> &minus;12 pts</span>
              <span><SeverityBadge level="medium" /> &minus;6 pts</span>
              <span><SeverityBadge level="low" /> &minus;2 pts</span>
            </div>
            <p>
              Multiple findings stack. Scores are clamped to 0&ndash;100, then weighted by dimension importance and combined into a final grade.
            </p>
            <p>
              <strong className="text-[var(--color-ink)]">Grade scale:</strong>{' '}
              <span className="font-[family-name:var(--font-mono)]">
                A (90&ndash;100) &middot; B (80&ndash;89) &middot; C (70&ndash;79) &middot; D (60&ndash;69) &middot; F (0&ndash;59)
              </span>
            </p>
          </div>
        </section>

        {/* Dimensions */}
        <DimensionSection
          name="Code Structure"
          weight={25}
          description="The biggest weight because it's the biggest AI tell. AI tools write everything into one file, one function, deeply nested. This dimension catches that."
        >
          <Check
            name="God Files"
            severity="low → high"
            threshold="400+ code lines (low), 500+ (medium), 750+ (high)"
            description="Files that do too much. We count actual code lines — comments, blanks, and docstrings don't count. A 600-line file with 200 lines of comments is really a 400-line file."
            exclusions={[
              'Test files, generated files, vendored code',
              'Barrel/index files (re-exports only)',
              'Data files: locales, i18n, seed data, fixtures',
              'Files with >50% string/template literal content',
              'Storybook stories',
            ]}
          />
          <Check
            name="Deep Nesting"
            severity="low → high"
            threshold="5 levels (low), 6-7 (medium), 8+ (high)"
            description="Counts control flow nesting only — if/else/for/while/try/catch. Not object literals, not JSX structure, not config nesting. Single-line returns like `if (x) return y` don't count."
            exclusions={[
              'Test files, generated files, data files',
              'Streamlit layout blocks (st.sidebar, st.container, st.columns)',
              'Gradio layout blocks (gr.Row, gr.Column, gr.Tab)',
            ]}
          />
          <Check
            name="Duplicate Files"
            severity="low"
            threshold="3+ files with same base name and ≥50% content overlap"
            description="Catches copy-paste patterns where the same logic lives in multiple places. Compares content similarity, not just file names."
            exclusions={[
              'Framework conventions (page.tsx, layout.tsx, route.ts, index.ts)',
              'Monorepo config files expected to repeat across workspaces',
              'Template/example directories',
            ]}
          />
        </DimensionSection>

        <DimensionSection
          name="Error Handling"
          weight={20}
          description="AI-generated code loves to swallow errors. An empty catch block is a bug waiting to happen — we look for evidence that errors are actually being handled, not just silenced."
        >
          <Check
            name="Empty Catch Blocks"
            severity="high"
            threshold="Any catch block with no code inside"
            description="A catch block that catches an error and does nothing with it. This is almost never what you want."
          />
          <Check
            name="Console-Only Error Handling"
            severity="medium"
            threshold="Catch blocks that only console.log the error"
            description="Logging an error isn't handling it. If the user can't tell something went wrong, you're just hiding problems."
            exclusions={[
              'console.warn in catch blocks (assumed intentional graceful degradation)',
            ]}
          />
          <Check
            name="Console.log Density"
            severity="medium"
            threshold="5+ console.log calls in a single file"
            description="A high density of console.log usually means debug code left behind in production. We're not counting console.warn or console.error — those are often intentional."
            exclusions={[
              'CLI tools and scripts (scripts/ directories)',
              'Build config files (vite.config, webpack.config, next.config, etc.)',
            ]}
          />
        </DimensionSection>

        <DimensionSection
          name="Test Coverage"
          weight={20}
          description="Not whether your tests are good — we can't tell that from static analysis. But we can tell if they exist, and roughly how much of your code is covered."
        >
          <Check
            name="No Tests Found"
            severity="critical"
            threshold="Zero test files in the entire repo"
            description="We look for .test.*, .spec.*, test_*, and files in /test/ directories. If we find nothing, that's a critical finding."
          />
          <Check
            name="No Test Script"
            severity="high"
            threshold="Node.js project with no test script in package.json"
            description="Even if test files exist, there should be a way to run them. We look for test, test:unit, test:e2e, and test:integration scripts."
          />
          <Check
            name="Low Test-to-Source Ratio"
            severity="high → medium"
            threshold="Below 10% (high), 10-29% (medium)"
            description="Compares total lines of test code to total lines of source code. Below 10% means you're barely testing anything."
          />
        </DimensionSection>

        <DimensionSection
          name="Security"
          weight={15}
          description="We can't do a real security audit from static analysis, but we can catch the obvious disasters — committed secrets, hardcoded credentials, and .env files in the repo."
        >
          <Check
            name=".env File Committed"
            severity="critical"
            threshold="Any .env file present in the repo"
            description="If we can see your .env file, so can everyone else. This usually means secrets are exposed."
          />
          <Check
            name="Hardcoded Secrets"
            severity="critical"
            threshold="API keys, passwords, tokens in source code"
            description="Detects OpenAI keys (sk-...), GitHub tokens (ghp_...), AWS keys (AKIA...), and general api_key/password/secret assignments with string values."
            exclusions={[
              'Environment variable references ($DB_PASSWORD)',
              'Placeholder values (your-password, example-key, test-secret, dummy_*, fake_*)',
              'Error code constants (INCORRECT_PASSWORD)',
              '.env.example and .env.template files',
              'Example, sample, tutorial, and documentation directories',
              'E2E setup scripts, seed files, fixtures, and mock data',
              'Public keys in Docusaurus/Algolia configs',
            ]}
          />
        </DimensionSection>

        <DimensionSection
          name="Dependencies"
          weight={10}
          description="Lower weight because dependency management is genuinely hard and sometimes you just need the packages. But we still flag obvious bloat and hygiene issues."
        >
          <Check
            name="Excessive Dependencies"
            severity="high → medium"
            threshold="60+ production deps (high), 45-59 (medium)"
            description="A high dependency count increases attack surface, bundle size, and the odds of supply chain issues."
          />
          <Check
            name="Missing Lock File"
            severity="high"
            threshold="Dependencies present but no lock file"
            description="Without a lock file, every install might get different versions. We look for package-lock.json, yarn.lock, pnpm-lock.yaml, and bun.lockb."
          />
          <Check
            name="Duplicate-Purpose Packages"
            severity="medium"
            threshold="2+ packages that do the same thing"
            description="Having both axios and node-fetch? Both moment and dayjs? Pick one. We check 8 categories: HTTP clients, utilities, dates, frameworks, test runners, loggers, validators, and CSS-in-JS."
          />
        </DimensionSection>

        <DimensionSection
          name="Documentation"
          weight={10}
          description="The lightest weight because docs are genuinely optional for small projects. But no README at all? That's a choice."
        >
          <Check
            name="No README"
            severity="high"
            threshold="No README.md file in the repo"
            description="A repo without a README is a repo nobody can use. Even a few lines explaining what it does and how to run it is better than nothing."
          />
          <Check
            name="Thin README"
            severity="medium"
            threshold="Fewer than 5 lines of content"
            description="An auto-generated or placeholder README with just a title and nothing else. We want to see at least what it does and how to run it."
          />
          <Check
            name="Very Few Inline Comments"
            severity="low"
            threshold="Below 2% comment ratio in files with 200+ lines"
            description="We're not looking for comments on every line. But a large file with almost no comments suggests the author (human or AI) didn't stop to explain any of the non-obvious logic."
          />
        </DimensionSection>

        {/* Optimization process */}
        <section className="py-8 border-t border-[var(--color-paper-line)]">
          <h2 className="text-2xl italic mb-4">How We Improve</h2>
          <div className="space-y-4 text-sm text-[var(--color-ink-light)]">
            <p>
              A rubric is only as good as its accuracy. We actively optimize against false positives through three feedback loops:
            </p>
            <div className="space-y-3 pl-4 border-l-2 border-[var(--color-paper-line)]">
              <div>
                <p className="text-[var(--color-ink)] font-semibold">Stress Testing</p>
                <p>
                  We regularly run the analyzer against a diverse set of real-world repos — from weekend projects to production monorepos — and manually review the findings. When we find patterns that produce false flags, we add exclusions and refine thresholds.
                </p>
              </div>
              <div>
                <p className="text-[var(--color-ink)] font-semibold">False Positive Reports</p>
                <p>
                  Every finding on a report card has a flag button. When users report a false positive, we review it and, if confirmed, update the analyzer to handle that pattern. Real feedback from real repos drives real improvements.
                </p>
              </div>
              <div>
                <p className="text-[var(--color-ink)] font-semibold">Framework Awareness</p>
                <p>
                  Different frameworks have different conventions. Streamlit apps have deep nesting from layout blocks. Next.js repos have duplicated page.tsx files. Monorepos repeat config files. We teach the analyzer to understand these patterns instead of blindly flagging them.
                </p>
              </div>
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
              {[
                'node_modules, dist, build, .next, vendor, venv, and other dependency/output directories',
                'Generated files (auto-generated headers, .d.ts declarations, .map files, migration files)',
                'Lock files (package-lock.json, yarn.lock, etc.) — analyzed for presence, not content',
                'Binary files and media assets',
                'Vendored UI components (components/ui/, ui/primitives/)',
              ].map((item, i) => (
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
