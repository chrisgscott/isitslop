'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'motion/react'

const SNARKY_MESSAGES = [
  "Collecting your homework...",
  "Checking if you showed your work...",
  "Looking for tests... any tests...",
  "Checking if .env is in your backpack (please no)...",
  "The teacher is grading your paper...",
  "Searching for error handling...",
  "Red pen is running low...",
  "Reviewing what your AI turned in for you...",
  "Preparing your report card...",
  "This one's going on the fridge. Not in a good way.",
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
          <p className="text-2xl italic text-[var(--color-red-ink)]">
            Something went wrong.
          </p>
          <p className="text-sm text-[var(--color-ink-light)]">{error}</p>
          <a href="/" className="text-sm text-[var(--color-ink-light)] hover:text-[var(--color-red-ink)] italic transition-colors">
            &larr; Try another repo
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-10 max-w-md">
        <div className="space-y-2">
          <p className="text-xs tracking-[0.3em] uppercase text-[var(--color-ink-faint)]">
            Please wait
          </p>
          <p className="text-2xl italic text-[var(--color-ink-light)]">
            Your report card is being prepared...
          </p>
        </div>

        {/* Snarky message with crossfade */}
        <div className="h-8 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="handwriting text-xl text-[var(--color-blue-ink)]"
            >
              {SNARKY_MESSAGES[messageIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Simple animated ellipsis */}
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-ink-faint)]"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
