'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'motion/react'

const SNARKY_MESSAGES = [
  "Downloading your masterpiece...",
  "Counting console.logs...",
  "Looking for tests... any tests...",
  "Checking if .env is committed (please no)...",
  "Measuring the spaghetti...",
  "Asking GPT what it thinks of GPT's code...",
  "Searching for error handling...",
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
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-6">
          <div className="text-6xl font-black text-red-400">ERR</div>
          <p className="text-red-400 font-mono text-sm">{error}</p>
          <a href="/" className="text-zinc-500 hover:text-[#22ff44] font-mono text-sm transition-colors">
            &larr; Try another repo
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-12">
        {/* Pulsing dot */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#22ff44] animate-pulse" />
          <span className="text-xs font-mono text-zinc-600 uppercase tracking-widest">Analyzing</span>
        </div>

        {/* Snarky message with crossfade */}
        <div className="h-8 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-lg text-zinc-400 font-mono"
            >
              {SNARKY_MESSAGES[messageIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Minimal progress bar */}
        <div className="w-48 h-px bg-[#222] mx-auto overflow-hidden">
          <motion.div
            className="h-full bg-[#22ff44]/50"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>
    </main>
  )
}
