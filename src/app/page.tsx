import { UrlInput } from '@/components/url-input'

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h1 className="text-6xl font-black tracking-tight">
          Is It Slop?
        </h1>
        <p className="text-xl text-zinc-400 max-w-lg mx-auto">
          You vibe coded it. Let&apos;s see how that went.
        </p>
        <UrlInput />
        <p className="text-sm text-zinc-600">
          Paste a public GitHub repo URL. We&apos;ll tell you if your AI did you dirty.
        </p>
      </div>
    </main>
  )
}
