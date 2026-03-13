'use client'

import { useState } from 'react'

interface ShareButtonsProps {
  url: string
  repoName: string
  slopScore: number
}

export function ShareButtons({ url, repoName, slopScore }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const tweetText = `Just ran ${repoName} through @IsItSlop... ${slopScore}/100. ${slopScore > 60 ? 'Pain.' : slopScore > 30 ? 'Could be worse.' : 'Not bad actually.'}`
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(url)}`

  function copyLink() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex gap-px justify-center">
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-2.5 bg-[#111] border border-[#1a1a1a] text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 text-xs font-mono uppercase tracking-wider transition-colors"
      >
        Share on X
      </a>
      <button
        onClick={copyLink}
        className="px-5 py-2.5 bg-[#111] border border-[#1a1a1a] border-l-0 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 text-xs font-mono uppercase tracking-wider transition-colors"
      >
        {copied ? 'Copied' : 'Copy Link'}
      </button>
    </div>
  )
}
