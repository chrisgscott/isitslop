import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SlopScore } from '@/components/slop-score'
import { DimensionGrades } from '@/components/dimension-grades'
import { Verdict } from '@/components/verdict'
import { FindingsList } from '@/components/findings-list'
import { ShareButtons } from '@/components/share-buttons'
import { CopyReportButton } from '@/components/copy-report-button'
import type { Analysis } from '@/types/analysis'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('analyses')
    .select('repo_owner, repo_name, slop_score')
    .eq('id', id)
    .single()

  if (!data) return { title: 'IsItSlop' }

  const grade = 100 - (data.slop_score ?? 0)
  const title = `${data.repo_owner}/${data.repo_name} — Grade: ${grade}/100`
  const description = `IsItSlop graded ${data.repo_owner}/${data.repo_name}: ${grade}/100.`

  return {
    title,
    description,
    openGraph: { title, description, siteName: 'IsItSlop' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ResultPage({ params }: PageProps) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data || data.status !== 'complete') {
    notFound()
  }

  const analysis = data as Analysis
  const overallGrade = 100 - (analysis.slop_score ?? 0)
  const resultUrl = `https://isitslop.co/r/${id}`
  const analyzedDate = analysis.analyzed_at
    ? new Date(analysis.analyzed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <main className="min-h-screen py-12 sm:py-20 px-4">
      <div className="max-w-4xl mx-auto relative">
        {/* Report Card Header */}
        <header className="relative pb-8">
          {/* Partial rule — 66% width */}
          <div className="absolute bottom-0 left-0 w-3/4 border-b border-[var(--color-paper-line)]" />
          <div className="space-y-2 pr-0 sm:pr-40">
            <p className="text-xs tracking-[0.4em] uppercase text-[var(--color-ink-faint)]">
              Department of Vibe Code Assessment
            </p>
            <h1 className="text-4xl sm:text-5xl italic">
              Report Card
            </h1>
            <div className="flex gap-6 text-sm text-[var(--color-ink-light)]">
              <span>
                <span className="text-[var(--color-ink-faint)]">Student: </span>
                <a
                  href={analysis.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-[family-name:var(--font-mono)] hover:text-[var(--color-red-ink)] transition-colors"
                >
                  {analysis.repo_owner}/{analysis.repo_name}
                </a>
              </span>
              <span>
                <span className="text-[var(--color-ink-faint)]">Term: </span>
                {analyzedDate}
              </span>
            </div>
          </div>

          {/* Stamp — positioned top right on desktop, centered below on mobile */}
          <div className="flex justify-center mt-8 sm:mt-0 sm:absolute sm:top-1 sm:right-0">
            <SlopScore score={overallGrade} />
          </div>
        </header>

        {/* Two-column: Grades + Teacher's Comments */}
        <div className="py-8 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <section>
            <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-ink-faint)] mb-4">
              Grades by Subject
            </p>
            <DimensionGrades scores={analysis.scores!} />

            {/* Actions — right under the grades */}
            <div className="mt-6 space-y-4">
              <CopyReportButton analysis={analysis} />
              <div className="flex items-start gap-2 select-none" aria-hidden="true">
                <p className="handwriting text-[var(--color-red-ink)] text-base rotate-[1.5deg] leading-[1.4]">
                  Hand this to your AI,<br />or see me after class.
                </p>
                <svg width="28" height="36" viewBox="0 0 28 36" fill="none" className="shrink-0 mt-0.5">
                  <path d="M14 34 C14 34, 12 8, 14 2" stroke="var(--color-red-ink)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  <path d="M8 8 L14 2 L20 8" stroke="var(--color-red-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
              <ShareButtons
                url={resultUrl}
                repoName={`${analysis.repo_owner}/${analysis.repo_name}`}
                slopScore={overallGrade}
              />
            </div>
          </section>

          <section>
            <Verdict verdict={analysis.verdict!} />
          </section>
        </div>

        {/* Findings / Areas for Improvement */}
        {analysis.receipts && analysis.receipts.length > 0 && (
          <section className="py-8 border-t border-[var(--color-paper-line)]">
            <FindingsList findings={analysis.receipts} analysisId={analysis.id} />
          </section>
        )}

        {/* Footer */}
        <footer className="pt-12 pb-8 border-t border-[var(--color-paper-line)] space-y-8">
          <div className="max-w-xs">
            <p className="text-xs text-[var(--color-ink-faint)] italic mb-6">
              Parent/Guardian Signature
            </p>
            <div className="border-b border-[var(--color-ink)] w-full" />
          </div>

          <div className="text-center">
            <a href="/" className="text-sm text-[var(--color-ink-light)] hover:text-[var(--color-red-ink)] italic transition-colors">
              &larr; Grade another student
            </a>
          </div>
        </footer>
      </div>
    </main>
  )
}
