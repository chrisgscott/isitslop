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
    <div className="flex gap-3 justify-center">
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
      >
        Share on X
      </a>
      <button
        onClick={copyLink}
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  )
}
