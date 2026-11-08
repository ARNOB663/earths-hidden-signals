import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ToasterHost } from "@/components/ui/ToasterHost";
import { Logo, SiteNav } from "@/components/site/SiteNav";
import { LANG_INIT_SCRIPT, THEME_INIT_SCRIPT } from "@/lib/bootScripts";
import { T } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Geist has no Bangla letters; this font takes over for Bangla text.
const notoBengali = Noto_Sans_Bengali({ variable: "--font-bn", subsets: ["bengali"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://earths-hidden-signals.vercel.app"),
  title: "Earth's Hidden Signals",
  description:
    "A climate-hazard intelligence platform for South Asia: what environmental signals are occurring, whether they are unusual, what historical evidence exists, and where the data cannot answer. Observational screening, never a forecast or an official warning.",
  openGraph: {
    title: "Earth's Hidden Signals",
    description: "What the rain is doing, what history says, and where the data cannot answer. NASA Space Apps 2026.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

const GITHUB = "https://github.com/ARNOB663/earths-hidden-signals";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoBengali.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + LANG_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-toast)] focus:rounded-lg focus:bg-accent-strong focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          <T en="Skip to content" bn="মূল অংশে যান" />
        </a>
        <SiteNav />
        <ToasterHost />
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
        <footer className="site-footer">
          <div className="mx-auto max-w-384 px-6 pb-14 pt-16 sm:px-8 lg:px-12">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(10rem,0.6fr)_minmax(10rem,0.7fr)]">
              <div className="max-w-md">
                <div className="flex items-center gap-2.5 text-[19px] font-semibold tracking-tight text-(--footer-fg)">
                  <Logo />
                  <span>Earth&apos;s Hidden Signals</span>
                </div>
                <p className="mt-5 max-w-[36ch] text-lg font-medium leading-relaxed text-(--footer-fg-2)">
                  <T
                    en="Understand what the environment is doing, whether it is unusual, and where the data cannot answer."
                    bn="পরিবেশ কী করছে, তা অস্বাভাবিক কি না, আর কোথায় তথ্য উত্তর দিতে পারে না — তা বুঝুন।"
                  />
                </p>
                <p className="mt-3 text-sm text-(--footer-fg-3)">
                  <T en="Observational screening. Not a forecast, not an official warning." bn="পর্যবেক্ষণভিত্তিক স্ক্রিনিং। পূর্বাভাস নয়, সরকারি সতর্কবার্তা নয়।" />
                </p>
                <Link href="/signal" className="site-footer-cta mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors">
                  <T en="Open the Signal" bn="সংকেত খুলুন" />
                  <ArrowRight size={16} strokeWidth={2} aria-hidden />
                </Link>
              </div>

              <nav aria-labelledby="footer-pages" className="flex flex-col items-start gap-3">
                <h2 id="footer-pages" className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--footer-fg-3)">
                  <T en="Pages" bn="পাতা" />
                </h2>
                <FooterLink href="/climate-trends" en="Climate Trends" bn="জলবায়ু প্রবণতা" />
                <FooterLink href="/climate-twins" en="Climate Twins" bn="জলবায়ু যমজ" />
                <FooterLink href="/methods" en="Methods" bn="পদ্ধতি" />
                <FooterLink href="/for-organizations" en="Organizations" bn="প্রতিষ্ঠান" />
                <FooterLink href="/methods#data" en="Data Sources" bn="তথ্যসূত্র" />
                <a href={GITHUB} target="_blank" rel="noreferrer" className="site-footer-link inline-flex items-center gap-1.5 text-sm">
                  <T en="GitHub" bn="গিটহাব" />
                  <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
                </a>
              </nav>

              <div className="text-sm text-(--footer-fg-3)">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--footer-fg-3)">
                  <T en="Built with" bn="তৈরি হয়েছে" />
                </h2>
                <p className="leading-relaxed">
                  GISTEMP · GPCP · IMERG · GDACS · FIRMS · GLC · GIBS · geoBoundaries · Open-Meteo · WMO SWIC
                </p>
                <p className="mt-4 leading-relaxed">
                  <T en="NASA Space Apps Challenge 2026. Open data, open methods." bn="NASA Space Apps Challenge 2026। উন্মুক্ত তথ্য, উন্মুক্ত পদ্ধতি।" />
                </p>
              </div>
            </div>

            <div className="mt-12 border-t border-(--footer-line) pt-6 text-xs leading-relaxed text-(--footer-fg-3)">
              <p>
                <T
                  en="Official warnings come from national meteorological and disaster agencies. This site helps people understand environmental signals and prepare; it does not replace them."
                  bn="সরকারি সতর্কবার্তা আসে জাতীয় আবহাওয়া ও দুর্যোগ সংস্থা থেকে। এই সাইট পরিবেশগত সংকেত বুঝতে ও প্রস্তুতি নিতে সাহায্য করে; তাদের বিকল্প নয়।"
                />
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function FooterLink({ href, en, bn }: { href: string; en: string; bn: string }) {
  return (
    <Link href={href} className="site-footer-link text-sm">
      <T en={en} bn={bn} />
    </Link>
  );
}
