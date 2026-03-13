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
    <main className="min-h-screen bg-black text-white py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <a
            href={analysis.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-zinc-500 hover:text-zinc-300"
          >
            {analysis.repo_owner}/{analysis.repo_name}
          </a>
        </div>

        <SlopScore score={analysis.slop_score!} />
        <DimensionGrades scores={analysis.scores!} />
        <Verdict verdict={analysis.verdict!} />

        <CopyReportButton analysis={analysis} />

        <ShareButtons
          url={resultUrl}
          repoName={`${analysis.repo_owner}/${analysis.repo_name}`}
          slopScore={analysis.slop_score!}
        />

        {analysis.receipts && analysis.receipts.length > 0 && (
          <FindingsList findings={analysis.receipts} />
        )}

        <div className="text-center pt-8 border-t border-zinc-800">
          <a href="/" className="text-zinc-400 hover:text-white underline">
            Analyze another repo
          </a>
        </div>
      </div>
    </main>
  )
}
