'use client'

import { useState } from 'react'

interface ShareButtonsProps {
  url: string
  repoName: string
  slopScore: number
}

export function ShareButtons({ url, repoName, slopScore }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const tweetText = `${repoName} got a ${slopScore}/100 on its report card. ${slopScore >= 80 ? 'Teacher was almost impressed.' : slopScore >= 50 ? 'Needs improvement.' : 'Parent-teacher conference required.'}`
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
        className="px-5 py-2 border border-[var(--color-paper-line)] text-[var(--color-ink-light)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] text-xs tracking-[0.15em] uppercase transition-colors"
      >
        Share on X
      </a>
      <button
        onClick={copyLink}
        className="px-5 py-2 border border-[var(--color-paper-line)] text-[var(--color-ink-light)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] text-xs tracking-[0.15em] uppercase transition-colors"
      >
        {copied ? 'Copied' : 'Copy Link'}
      </button>
    </div>
  )
}
