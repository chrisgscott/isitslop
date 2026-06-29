import type { Metadata } from "next";
import { Instrument_Serif, Caveat, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-HB8S0L6G0P";

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
});

const caveat = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: 'IsItSlop — Vibe Code Gut Check',
  description: 'Paste a GitHub repo URL. Find out if your AI did you dirty. Get fix prompts to make it clean up its own mess.',
  metadataBase: new URL('https://isitslop.co'),
  openGraph: {
    title: 'IsItSlop — Vibe Code Gut Check',
    description: 'Paste a GitHub repo URL. Find out if your AI did you dirty.',
    siteName: 'IsItSlop',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IsItSlop — Vibe Code Gut Check',
    description: 'Paste a GitHub repo URL. Find out if your AI did you dirty.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
      <body
        className={`${instrumentSerif.variable} ${caveat.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
        <footer className="py-6 text-center">
          <nav className="flex justify-center gap-6 text-sm text-[var(--color-ink-faint)]">
            <a href="/" className="hover:text-[var(--color-ink)] transition-colors">Home</a>
            <a href="/insights" className="hover:text-[var(--color-ink)] transition-colors">Class Performance</a>
            <a href="/rubric" className="hover:text-[var(--color-ink)] transition-colors">The Rubric</a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
