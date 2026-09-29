import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { LANG_INIT_SCRIPT, THEME_INIT_SCRIPT } from "@/lib/bootScripts";
import { T } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist has no Bangla letters; this font takes over for Bangla text.
const notoBengali = Noto_Sans_Bengali({
  variable: "--font-bn",
  subsets: ["bengali"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Earth's Hidden Signals",
  description:
    "How South Asia's climate is changing, and what it means for floods, landslides and wildfires, told with 45 years of NASA data.",
  openGraph: {
    title: "Earth's Hidden Signals",
    description: "How South Asia's climate is changing, told with 45 years of NASA data. NASA Space Apps 2026.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${notoBengali.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + LANG_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          <T en="Skip to content" bn="মূল অংশে যান" />
        </a>
        <SiteNav />
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-6 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              <T
                en="Built for the NASA Space Apps Challenge 2026 with open NASA data. It shows trends to help people prepare; it does not predict disasters."
                bn="নাসার উন্মুক্ত তথ্য দিয়ে NASA Space Apps Challenge 2026-এর জন্য তৈরি। এটি মানুষকে প্রস্তুত হতে সাহায্য করার জন্য প্রবণতা দেখায়; দুর্যোগের পূর্বাভাস দেয় না।"
              />
            </p>
            <div className="flex shrink-0 gap-4">
              <Link href="/methods" className="hover:text-ink">
                <T en="Data & methods" bn="তথ্য ও পদ্ধতি" />
              </Link>
              <a href="https://github.com/ARNOB663/earths-hidden-signals" className="hover:text-ink">
                <T en="Source code" bn="সোর্স কোড" />
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
