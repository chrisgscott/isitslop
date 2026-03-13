import type { Metadata } from "next";
import { Darker_Grotesque, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Darker_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      <body
        className={`${display.variable} ${mono.variable} antialiased`}
      >
        <div className="noise" />
        {children}
      </body>
    </html>
  );
}
