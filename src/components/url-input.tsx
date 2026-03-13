'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function UrlInput() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      router.push(`/analyzing/${data.id}`)
    } catch {
      setError('Failed to start analysis. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto relative">
      <div className="space-y-3">
        <label className="block text-xs tracking-[0.2em] uppercase text-[var(--color-ink-light)] text-left">
          Student (repo)
        </label>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null) }}
              placeholder="owner/repo"
              className="w-full bg-transparent border-b-2 border-[var(--color-ink)] pb-2 text-lg text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:outline-none focus:border-[var(--color-red-ink)] transition-colors font-[family-name:var(--font-mono)]"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-2 bg-[var(--color-ink)] text-[var(--color-paper)] text-sm tracking-[0.15em] uppercase hover:bg-[var(--color-red-ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Grading...' : 'Grade'}
          </button>
        </div>
        {error && (
          <p className="text-sm text-[var(--color-red-ink)] italic">{error}</p>
        )}
      </div>

      {/* Handwritten annotation */}
      <div className="absolute -bottom-16 left-2 sm:left-6 rotate-[-2deg] select-none pointer-events-none">
        <svg className="absolute -top-6 left-16 text-[var(--color-red-ink)]" width="28" height="24" viewBox="0 0 28 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 22C14 22 8 16 6 12C4 8 3 4 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M1 8C1 8 3 4 3 4C3 4 6 7 8 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="handwriting text-base sm:text-lg text-[var(--color-red-ink)] ml-1 mt-1">
          Paste your repo URL here. I&apos;ll try to be nice... ish.
        </p>
      </div>
    </form>
  )
}
