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
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-mono text-sm select-none pointer-events-none">
              &gt;
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null) }}
              placeholder="owner/repo"
              className="w-full pl-8 pr-4 py-3.5 bg-[#111] border border-[#222] rounded-none text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#22ff44]/40 font-mono text-sm transition-colors"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-8 py-3.5 bg-[#22ff44] text-black font-bold rounded-none hover:bg-[#1de83d] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-mono uppercase tracking-wider"
          >
            {loading ? '...' : 'Run'}
          </button>
        </div>
        {error && (
          <p className="text-red-400 text-xs font-mono">{error}</p>
        )}
      </div>
    </form>
  )
}
