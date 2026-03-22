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

const SLOW_THRESHOLD_MS = 120_000
const TIMEOUT_MS = 300_000

export default function AnalyzingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [messageIndex, setMessageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSlow, setIsSlow] = useState(false)
  const [startTime] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % SNARKY_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const poll = setInterval(async () => {
      const elapsed = Date.now() - startTime

      if (elapsed > TIMEOUT_MS) {
        setError('OK this one\'s actually stuck. The repo might be too large for us to handle right now.')
        clearInterval(poll)
        return
      }

      if (elapsed > SLOW_THRESHOLD_MS) {
        setIsSlow(true)
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
          <p className="text-xs text-[var(--color-ink-faint)]">
            Bookmark this page and check back — it might still finish.
          </p>
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

        {/* Slow analysis notice */}
        <AnimatePresence>
          {isSlow && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-[var(--color-ink-faint)] italic"
            >
              This one&apos;s a big repo. Still grading, hang tight...
            </motion.p>
          )}
        </AnimatePresence>

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
