"use client";

import {
  Activity,
  ChartNoAxesColumnIncreasing,
  CheckCheck,
  House,
  Menu,
  Monitor,
  Moon,
  ScanEye,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { setLang, T, useLang, useT } from "@/lib/i18n";
import {
  setThemePreference,
  systemTheme,
  useThemePreference,
  type ThemePreference,
} from "@/lib/theme";

// The seven pages, in one order: what is happening (Signal), where it cannot be said (Gap),
// how it has been tested (Replay, Accuracy), what to do (Act) and what is watched for you (Watch).
export const TABS = [
  { href: "/", label: "Home", short: "Home", bn: "হোম", shortBn: "হোম", Icon: House },
  { href: "/signal", label: "Signal", short: "Signal", bn: "সংকেত", shortBn: "সংকেত", Icon: Activity },
  { href: "/gap", label: "Gap", short: "Gap", bn: "ফাঁক", shortBn: "ফাঁক", Icon: ScanEye },
  { href: "/replay", label: "Replay", short: "Replay", bn: "পুনরাবৃত্তি", shortBn: "পুনরাবৃত্তি", Icon: Monitor },
  { href: "/accuracy", label: "Accuracy", short: "Accuracy", bn: "নির্ভুলতা", shortBn: "নির্ভুলতা", Icon: ChartNoAxesColumnIncreasing },
  { href: "/act", label: "Act", short: "Act", bn: "প্রস্তুতি", shortBn: "প্রস্তুতি", Icon: ShieldCheck },
  { href: "/watch", label: "Watch", short: "Watch", bn: "নজর", shortBn: "নজর", Icon: CheckCheck },
];

const isActive = (pathname: string, tab: (typeof TABS)[number]) =>
  tab.href === "/" ? pathname === "/" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = useT();

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const headerBg =
    isHome && !scrolled && !open
      ? "border-transparent home-hero-nav"
      : scrolled || open
        ? "border-line bg-page/85 backdrop-blur-md"
        : "border-transparent bg-page";

  return (
    <header
      className={`sticky top-0 z-[var(--z-nav)] transition-[border-color,background-color] duration-300 ${
        isHome && !scrolled && !open ? "home-hero-nav" : `border-b ${headerBg}`
      }`}
    >
      <div className="mx-auto flex h-16 min-w-0 max-w-384 items-center gap-3 px-4 sm:px-8 lg:gap-4 lg:px-12">
        <Link href="/" className="-m-1.5 flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg p-1.5" aria-label="Earth's Hidden Signals, home">
          <Logo />
          <span className="hidden truncate text-[15px] font-semibold tracking-tight text-ink lg:inline">Earth&apos;s Hidden Signals</span>
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 items-center gap-0.5 lg:flex">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:px-3 ${
                  active ? "bg-card font-medium text-ink shadow-soft" : "text-ink-2 hover:bg-card/60 hover:text-ink"
                }`}
              >
                <tab.Icon size={17} strokeWidth={1.75} aria-hidden />
                <span className="hidden xl:inline">
                  <T en={tab.short} bn={tab.shortBn} />
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-accent">
          <LanguageSwitcher />
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t("Close menu", "মেনু বন্ধ করুন") : t("Open menu", "মেনু খুলুন")}
            className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors duration-150 hover:bg-card lg:hidden"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-line bg-page px-4 pb-4 pt-2 lg:hidden">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base ${active ? "bg-card font-medium text-ink" : "text-ink-2"}`}
              >
                <tab.Icon size={18} aria-hidden />
                <T en={tab.label} bn={tab.bn} />
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}

export function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="13" fill="var(--accent)" />
      <path d="M5 17c4-3 7 1 11-1s6-5 11-2" stroke="var(--accent-ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M7 22c3-1.5 6 1 9-.5s5-3 9-1" stroke="var(--accent-ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; bn: string; Icon: typeof Sun }[] = [
  { value: "system", label: "Match my device", bn: "ডিভাইসের মতো", Icon: Monitor },
  { value: "light", label: "Light", bn: "আলো", Icon: Sun },
  { value: "dark", label: "Dark", bn: "অন্ধকার", Icon: Moon },
];

function LanguageSwitcher() {
  const lang = useLang();
  return (
    <div role="radiogroup" aria-label="Language / ভাষা" className="flex rounded-full border border-line bg-card p-0.5 text-sm">
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
          className={`h-8 min-w-9 rounded-full px-2 transition-colors ${lang === value ? "bg-accent-strong font-medium text-accent-ink" : "text-ink-3 hover:text-ink"}`}
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
  useEffect(() => {
    if (pref !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.dataset.theme = systemTheme();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref]);
  return (
    <div role="radiogroup" aria-label={t("Colour theme", "রঙের ধরন")} className="hidden rounded-full border border-line bg-card p-0.5 sm:flex">
      {THEME_OPTIONS.map(({ value, label, bn, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          title={t(label, bn)}
          aria-label={t(label, bn)}
          onClick={() => setThemePreference(value)}
          className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${pref === value ? "bg-accent-strong text-accent-ink" : "text-ink-3 hover:text-ink"}`}
        >
          <Icon size={16} strokeWidth={pref === value ? 2.25 : 1.75} />
        </button>
      ))}
    </div>
  );
}
