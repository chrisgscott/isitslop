'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const SNARKY_MESSAGES = [
  "Downloading your masterpiece...",
  "Counting console.logs...",
  "Looking for tests... any tests...",
  "Checking if .env is committed (please no)...",
  "Measuring the spaghetti...",
  "Asking GPT what it thinks of GPT's code...",
  "Searching for error handling (found: catch(e) {})...",
  "Calculating your shame score...",
  "Reviewing 47 files your AI hallucinated...",
  "Almost done roasting you...",
]

export default function AnalyzingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [messageIndex, setMessageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [startTime] = useState(Date.now())
  const TIMEOUT_MS = 120_000

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % SNARKY_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const poll = setInterval(async () => {
      if (Date.now() - startTime > TIMEOUT_MS) {
        setError('Analysis is taking too long. The repo might be too large or our service is busy. Try again later.')
        clearInterval(poll)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('analyses')
        .select('status, error_message')
        .eq('id', id)
        .single()

      if (fetchError) {
        setError('Could not find this analysis.')
        clearInterval(poll)
        return
      }

      if (data.status === 'complete') {
        clearInterval(poll)
        router.push(`/r/${id}`)
      } else if (data.status === 'error') {
        clearInterval(poll)
        setError(data.error_message || 'Analysis failed.')
      }
    }, 2000)

    return () => clearInterval(poll)
  }, [id, router, startTime])

  if (error) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black">Oops</h1>
          <p className="text-red-400">{error}</p>
          <a href="/" className="text-zinc-400 hover:text-white underline">
            Try another repo
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-8">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" />
        <p className="text-xl text-zinc-400 animate-pulse">
          {SNARKY_MESSAGES[messageIndex]}
        </p>
      </div>
    </main>
  )
}
