"use client";

import {
  Activity,
  ChartLine,
  FlaskConical,
  House,
  Menu,
  Monitor,
  Moon,
  Satellite,
  Sun,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { setLang, T, useLang, useT } from "@/lib/i18n";
import { CountrySearch } from "./CountrySearch";
import type { Country } from "@/lib/countries";
import {
  setThemePreference,
  systemTheme,
  useThemePreference,
  type ThemePreference,
} from "@/lib/theme";

// Each tab keeps a short label for the tab bar and a full one for phones and screen readers.
export const TABS = [
  { href: "/", label: "Home", short: "Home", bn: "হোম", shortBn: "হোম", Icon: House },
  { href: "/signals", label: "Signals", short: "Signals", bn: "সংকেত", shortBn: "সংকেত", Icon: Activity },
  { href: "/watch", label: "Watch", short: "Watch", bn: "কী দেখবেন", shortBn: "দেখুন", Icon: ChartLine },
  { href: "/accuracy", label: "Accuracy", short: "Accuracy", bn: "নির্ভুলতা", shortBn: "নির্ভুলতা", Icon: TriangleAlert },
  { href: "/hazards", label: "Hazards", short: "Hazards", bn: "দুর্যোগ", shortBn: "দুর্যোগ", Icon: TriangleAlert },
  { href: "/trends", label: "Trends", short: "Trends", bn: "প্রবণতা", shortBn: "প্রবণতা", Icon: ChartLine },
  { href: "/explore", label: "Map", short: "Map", bn: "মানচিত্র", shortBn: "মানচিত্র", Icon: Satellite },
  { href: "/methods", label: "About", short: "About", bn: "সম্পর্কে", shortBn: "সম্পর্কে", Icon: FlaskConical },
];

const isActive = (pathname: string, tab: (typeof TABS)[number]) =>
  tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

export function SiteNav({ countries }: { countries: Pick<Country, "slug" | "name" | "nameBn" | "flag">[] }) {
  const pathname = usePathname();
  const satelliteMap = pathname === "/explore";
  const [open, setOpen] = useState(false);
  const t = useT();

  // Close the mobile menu after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // On the homepage the hero extends behind the navbar, so we stay transparent until the user
  // scrolls. On map pages we always show a backdrop so the nav frames the map. Everywhere else
  // we use a solid background at rest and a frosted-glass one when scrolled.
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const mapPage = ["/explore", "/trends", "/hazards"].some((href) =>
    pathname.startsWith(href),
  );
  const separated = scrolled || open || mapPage;

  // Three visual states:
  // 1. Hero-transparent: homepage at the very top, before scrolling or opening the menu.
  //    Background is fully transparent so the hero gradient reads through the navbar.
  // 2. Frosted-glass: scrolled, menu open, or a map page — readable over any content below.
  // 3. Solid: any other page at rest.
  const headerBg =
    isHome && !scrolled && !open
      ? "border-transparent home-hero-nav"
      : separated
        ? "border-line bg-page/85 backdrop-blur-md"
        : "border-transparent bg-page";

  return (
    <header
      className={`sticky top-0 z-[var(--z-nav)] transition-[border-color,background-color] duration-300 ${
        isHome && !scrolled && !open ? "home-hero-nav" : `border-b ${headerBg}`
      }`}
    >
      <div className="mx-auto flex h-16 min-w-0 max-w-384 items-center gap-3 px-6 sm:px-8 lg:gap-3 lg:px-12">
        <Link
          href="/"
          className="-m-1.5 flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg p-1.5"
          aria-label="Earth's Hidden Signals, home"
        >
          <Logo />
          <span className="hidden truncate text-[15px] font-semibold tracking-tight text-ink min-[400px]:inline">
            Earth&apos;s Hidden Signals
          </span>
        </Link>

        {/* From lg the tabs carry icons only; from xl they gain short labels, so 1024-1279 stays uncrowded. */}
        <nav
          aria-label="Main"
          className="ml-2 hidden min-w-0 items-center gap-1 lg:flex"
        >
          {TABS.map((tab) => {
            const active = isActive(pathname, tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={t(tab.label, tab.bn)}
                title={t(tab.label, tab.bn)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:px-3 ${
                  active
                    ? "bg-card font-medium text-ink shadow-soft"
                    : "text-ink-2 hover:bg-card/60 hover:text-ink"
                }`}
              >
                <tab.Icon size={18} strokeWidth={1.75} aria-hidden />
                <span className="hidden xl:inline">
                  <T en={tab.short} bn={tab.shortBn} />
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-accent">
          {!satelliteMap && <CountrySearch countries={countries} />}
          <LanguageSwitcher />
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={
              open
                ? t("Close menu", "মেনু বন্ধ করুন")
                : t("Open menu", "মেনু খুলুন")
            }
            className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors duration-150 hover:bg-card lg:hidden"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Main"
          className="border-t border-line bg-page px-4 pb-4 pt-2 lg:hidden"
        >
          {TABS.map((tab) => {
            const active = isActive(pathname, tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-xl px-4 py-3 text-base ${active ? "bg-card font-medium text-ink" : "text-ink-2"}`}
              >
                <T en={tab.label} bn={tab.bn} />
              </Link>
            );
          })}
          {!satelliteMap && (
            <div className="mt-1 border-t border-line pt-3">
              <CountrySearch countries={countries} large />
            </div>
          )}
        </nav>
      )}
    </header>
  );
}

export function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="13" fill="var(--accent)" />
      <path
        d="M5 17c4-3 7 1 11-1s6-5 11-2"
        stroke="var(--accent-ink)"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M7 22c3-1.5 6 1 9-.5s5-3 9-1"
        stroke="var(--accent-ink)"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        opacity=".6"
      />
    </svg>
  );
}

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  bn: string;
  Icon: typeof Sun;
}[] = [
  {
    value: "system",
    label: "Match my device",
    bn: "ডিভাইসের মতো",
    Icon: Monitor,
  },
  { value: "light", label: "Light", bn: "আলো", Icon: Sun },
  { value: "dark", label: "Dark", bn: "অন্ধকার", Icon: Moon },
];

/** English / Bangla switch. */
function LanguageSwitcher() {
  const lang = useLang();
  return (
    <div
      role="radiogroup"
      aria-label="Language / ভাষা"
      className="flex rounded-full border border-line bg-card p-0.5 text-sm"
    >
      {(
        [
          ["en", "EN", "English"],
          ["bn", "বাং", "বাংলা"],
        ] as const
      ).map(([value, short, full]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={lang === value}
          aria-label={full}
          title={full}
          onClick={() => setLang(value)}
          className={`h-8 min-w-9 rounded-full px-2 transition-colors ${
            lang === value
              ? "bg-accent-strong font-medium text-accent-ink"
              : "text-ink-3 hover:text-ink"
          }`}
        >
          {short}
        </button>
      ))}
    </div>
  );
}

function ThemeSwitcher() {
  const pref = useThemePreference();
  const t = useT();

  // While following the device, react when the device switches between light and dark.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.dataset.theme = systemTheme();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  return (
    <div
      role="radiogroup"
      aria-label={t("Colour theme", "রঙের ধরন")}
      className="flex rounded-full border border-line bg-card p-0.5"
    >
      {THEME_OPTIONS.map(({ value, label, bn, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          title={t(label, bn)}
          aria-label={t(label, bn)}
          onClick={() => setThemePreference(value)}
          className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
            pref === value
              ? "bg-accent-strong text-accent-ink"
              : "text-ink-3 hover:text-ink"
          }`}
        >
          <Icon size={16} strokeWidth={pref === value ? 2.25 : 1.75} />
        </button>
      ))}
    </div>
  );
}
