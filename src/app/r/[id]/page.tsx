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

  const title = `${data.repo_owner}/${data.repo_name} — Slop Score: ${data.slop_score}/100`
  const description = `IsItSlop analyzed ${data.repo_owner}/${data.repo_name} and gave it a ${data.slop_score}/100 slop score.`

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
  const resultUrl = `https://isitslop.co/r/${id}`

  return (
    <main className="min-h-screen py-20 px-4">
      <div className="max-w-3xl mx-auto space-y-16">
        {/* Repo header */}
        <div className="text-center">
          <a
            href={analysis.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-zinc-600 hover:text-[#22ff44] transition-colors tracking-wide"
          >
            {analysis.repo_owner}/{analysis.repo_name} &nearr;
          </a>
        </div>

        {/* The Score */}
        <SlopScore score={analysis.slop_score!} />

        {/* Dimension grades */}
        <DimensionGrades scores={analysis.scores!} />

        {/* Verdict */}
        <Verdict verdict={analysis.verdict!} />

        {/* Actions */}
        <div className="space-y-4">
          <CopyReportButton analysis={analysis} />
          <ShareButtons
            url={resultUrl}
            repoName={`${analysis.repo_owner}/${analysis.repo_name}`}
            slopScore={analysis.slop_score!}
          />
        </div>

        {/* Findings */}
        {analysis.receipts && analysis.receipts.length > 0 && (
          <FindingsList findings={analysis.receipts} />
        )}

        {/* Footer */}
        <div className="text-center pt-8 border-t border-[#1a1a1a]">
          <a href="/" className="text-xs font-mono text-zinc-600 hover:text-[#22ff44] transition-colors tracking-wide">
            &larr; Analyze another repo
          </a>
        </div>
      </div>
    </main>
  )
}
