import { UrlInput } from '@/components/url-input'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg mx-auto text-center space-y-10">
        <div className="space-y-4">
          <p className="text-sm tracking-[0.3em] uppercase text-[var(--color-ink-light)]">
            Department of Vibe Code Assessment
          </p>
          <h1 className="text-6xl sm:text-7xl italic leading-[0.9] tracking-tight">
            Is It Slop?
          </h1>
          <p className="text-lg italic text-[var(--color-ink-light)]">
            Vibe coded, huh? Let me grab my red pen...
          </p>
        </div>

        <UrlInput />
      </div>
    </main>
  )
}
