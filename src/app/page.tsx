import { UrlInput } from '@/components/url-input'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 relative">
      {/* Subtle radial glow behind the title */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#22ff44]/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-2xl mx-auto text-center space-y-10 relative z-10">
        <div className="space-y-4">
          <h1 className="text-7xl sm:text-8xl font-black tracking-tight leading-[0.85]">
            Is It<br />
            <span className="text-[#22ff44]">Slop</span>?
          </h1>
          <p className="text-lg text-zinc-500 font-mono">
            You vibe coded it. Let&apos;s see how that went.
          </p>
        </div>

        <UrlInput />

        <p className="text-xs text-zinc-600 font-mono tracking-wide">
          Paste a public GitHub repo URL. We&apos;ll tell you if your AI did you dirty.
        </p>
      </div>
    </main>
  )
}
