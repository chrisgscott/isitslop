import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
