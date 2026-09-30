"use client";

import { List, MagnifyingGlass, Monitor, Moon, Sun, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { setLang, T, useLang, useT } from "@/lib/i18n";
import { setThemePreference, systemTheme, useThemePreference, type ThemePreference } from "@/lib/theme";

export const TABS = [
  { href: "/", label: "Home", bn: "হোম" },
  { href: "/findings", label: "The story", bn: "মূল গল্প" },
  { href: "/explore", label: "Satellite map", bn: "স্যাটেলাইট মানচিত্র" },
  { href: "/trends", label: "Climate trends", bn: "জলবায়ুর প্রবণতা" },
  { href: "/hazards", label: "Disaster risk", bn: "দুর্যোগের ঝুঁকি" },
  { href: "/methods", label: "How it works", bn: "কীভাবে কাজ করে" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = useT();

  // Close the mobile menu after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // At the top of a page the bar blends into it; once the page scrolls, a line and a frosted
  // background separate the bar from the content passing beneath. Full-screen map pages don't
  // scroll on large screens, so they keep the line to frame the map.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const mapPage = ["/explore", "/trends", "/hazards"].some((href) => pathname.startsWith(href));
  const separated = scrolled || open || mapPage;

  return (
    <header
      className={`sticky top-0 z-[1000] border-b transition-[border-color,background-color] duration-200 ${
        separated ? "border-line bg-page/85 backdrop-blur-md" : "border-transparent bg-page"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="Earth's Hidden Signals, home">
          <Logo />
          <span className="hidden text-[15px] font-semibold tracking-tight text-ink min-[400px]:inline">Earth&apos;s Hidden Signals</span>
        </Link>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 text-sm transition-colors ${
                  active ? "bg-card font-medium text-ink shadow-soft" : "text-ink-2 hover:bg-card/60 hover:text-ink"
                }`}
              >
                <T en={tab.label} bn={tab.bn} />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/places"
            aria-label={t("Find a place", "জায়গা খুঁজুন")}
            title={t("Find a place", "জায়গা খুঁজুন")}
            className={`flex h-10 items-center gap-2 rounded-full px-3 text-sm transition-colors hover:bg-card ${
              pathname.startsWith("/places") ? "bg-card font-medium text-ink shadow-soft" : "text-ink-2"
            }`}
          >
            <MagnifyingGlass size={18} />
            <span className="hidden xl:inline">
              <T en="Find a place" bn="জায়গা খুঁজুন" />
            </span>
          </Link>
          <LanguageSwitcher />
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t("Close menu", "মেনু বন্ধ করুন") : t("Open menu", "মেনু খুলুন")}
            className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-card lg:hidden"
          >
            {open ? <X size={22} /> : <List size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-line bg-page px-4 pb-4 pt-2 lg:hidden">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
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
        </nav>
      )}
    </header>
  );
}

function Logo() {
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

/** English / Bangla switch. */
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
          className={`h-8 min-w-9 rounded-full px-2 transition-colors ${
            lang === value ? "bg-accent font-medium text-accent-ink" : "text-ink-3 hover:text-ink"
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
    <div role="radiogroup" aria-label={t("Colour theme", "রঙের ধরন")} className="flex rounded-full border border-line bg-card p-0.5">
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
            pref === value ? "bg-accent text-accent-ink" : "text-ink-3 hover:text-ink"
          }`}
        >
          <Icon size={16} weight={pref === value ? "fill" : "regular"} />
        </button>
      ))}
    </div>
  );
}
