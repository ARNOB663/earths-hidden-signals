import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { TourBar } from "@/components/site/Tour";
import { ToasterHost } from "@/components/ui/ToasterHost";
import { Logo, SiteNav } from "@/components/site/SiteNav";
import { countriesFrom } from "@/lib/countries";
import { readFile } from "node:fs/promises";
import path from "node:path";
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
  // Social previews need absolute image URLs.
  metadataBase: new URL("https://earths-hidden-signals.vercel.app"),
  title: "Earth's Hidden Signals",
  description:
    "How South Asia's climate is changing, and what it means for floods, landslides and wildfires, told with 45 years of NASA data.",
  openGraph: {
    title: "Earth's Hidden Signals",
    description:
      "How South Asia's climate is changing, told with 45 years of NASA data. NASA Space Apps 2026.",
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The navbar country search is server-rendered, so the list must also work without JS.
  const countries = countriesFrom(
    JSON.parse(await readFile(path.join(process.cwd(), "public/data/maps/place-signals.json"), "utf-8")),
  ).map(({ slug, name, nameBn, flag }) => ({ slug, name, nameBn, flag }));

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoBengali.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT + LANG_INIT_SCRIPT,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-toast)] focus:rounded-lg focus:bg-accent-strong focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          <T en="Skip to content" bn="মূল অংশে যান" />
        </a>
        <SiteNav countries={countries} />
        <TourBar />
        <ToasterHost />
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
        <footer className="site-footer">
          <div className="mx-auto max-w-384 px-6 pb-16 pt-20 sm:px-8 lg:px-12">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)] lg:gap-16">
              <div className="max-w-md">
                <div className="flex items-center gap-2.5 text-[19px] font-semibold tracking-tight text-(--footer-fg)">
                  <Logo />
                  <span>Earth&apos;s Hidden Signals</span>
                </div>
                <p className="mt-6 max-w-[34ch] text-xl font-medium leading-relaxed text-(--footer-fg-2)">
                  <T
                    en="45 years of Earth data reveal signals we normally cannot see."
                    bn="পৃথিবীর ৪৫ বছরের তথ্য এমন সংকেত প্রকাশ করে যা আমরা সাধারণত দেখতে পাই না।"
                  />
                </p>
                <p className="mt-3 text-sm text-(--footer-fg-3)">
                  <T
                    en="Preparedness, not prediction."
                    bn="প্রস্তুতি, পূর্বাভাস নয়।"
                  />
                </p>
                <Link
                  href="/explore"
                  className="site-footer-cta mt-7 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors"
                >
                  <T en="Explore the map" bn="মানচিত্র দেখুন" />
                  <ArrowRight size={16} strokeWidth={2} aria-hidden />
                </Link>
              </div>

              <FooterColumn title="Explore" titleBn="অনুসন্ধান">
                <FooterLink href="/monitoring" en="Monitoring" bn="পর্যবেক্ষণ" />
                <FooterLink href="/locations" en="Locations" bn="স্থান" />
                <FooterLink
                  href="/explore"
                  en="Satellite map"
                  bn="স্যাটেলাইট মানচিত্র"
                />
                <FooterLink
                  href="/trends"
                  en="Climate trends"
                  bn="জলবায়ুর প্রবণতা"
                />
                <FooterLink
                  href="/hazards"
                  en="Disaster risk"
                  bn="দুর্যোগের ঝুঁকি"
                />
                <FooterLink
                  href="/countries"
                  en="Country dashboards"
                  bn="দেশের ড্যাশবোর্ড"
                />
              </FooterColumn>

              <FooterColumn title="Project" titleBn="প্রকল্প">
                <FooterLink href="/findings" en="The story" bn="মূল গল্প" />
                <FooterLink
                  href="/methods"
                  en="How it works"
                  bn="কীভাবে কাজ করে"
                />
                <FooterLink href="/methods#intelligence" en="Classes, alerts and evaluation" bn="শ্রেণি, সতর্কতা ও মূল্যায়ন" />
                <a
                  href="https://github.com/ARNOB663/earths-hidden-signals"
                  target="_blank"
                  rel="noreferrer"
                  className="site-footer-link inline-flex items-center gap-1.5 text-sm"
                >
                  <T en="GitHub" bn="গিটহাব" />
                  <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
                </a>
              </FooterColumn>
            </div>

            <div className="mt-14 border-t border-(--footer-line) pt-6">
              <div className="flex flex-col gap-4 text-xs text-(--footer-fg-3) md:flex-row md:items-center md:justify-between">
                <p>
                  <T
                    en="Built for NASA Space Apps Challenge 2026 using open Earth data."
                    bn="উন্মুক্ত Earth data দিয়ে NASA Space Apps Challenge 2026-এর জন্য তৈরি।"
                  />
                </p>
                <p className="max-w-2xl leading-relaxed md:text-right">
                  DATA FROM{" "}
                  <a
                    href="https://data.giss.nasa.gov/gistemp/"
                    target="_blank"
                    rel="noreferrer"
                    className="site-footer-link"
                  >
                    GISTEMP
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-monthly"
                    target="_blank"
                    rel="noreferrer"
                    className="site-footer-link"
                  >
                    GPCP
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://firms.modaps.eosdis.nasa.gov/"
                    target="_blank"
                    rel="noreferrer"
                    className="site-footer-link"
                  >
                    FIRMS
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://data.nasa.gov/"
                    target="_blank"
                    rel="noreferrer"
                    className="site-footer-link"
                  >
                    GLC
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://www.gdacs.org/"
                    target="_blank"
                    rel="noreferrer"
                    className="site-footer-link"
                  >
                    GDACS
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://earthdata.nasa.gov/gibs"
                    target="_blank"
                    rel="noreferrer"
                    className="site-footer-link"
                  >
                    GIBS
                  </a>
                </p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function FooterColumn({
  title,
  titleBn,
  children,
}: {
  title: string;
  titleBn: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--footer-fg-3)">
        <T en={title} bn={titleBn} />
      </p>
      <nav className="flex flex-col items-start gap-3">{children}</nav>
    </div>
  );
}

function FooterLink({
  href,
  en,
  bn,
}: {
  href: string;
  en: string;
  bn: string;
}) {
  return (
    <Link href={href} className="site-footer-link text-sm">
      <T en={en} bn={bn} />
    </Link>
  );
}
