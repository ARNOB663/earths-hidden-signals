"use client";

import { List, Monitor, Moon, Sun, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { setThemePreference, systemTheme, useThemePreference, type ThemePreference } from "@/lib/theme";

export const TABS = [
  { href: "/", label: "Home" },
  { href: "/findings", label: "The story" },
  { href: "/explore", label: "Satellite map" },
  { href: "/trends", label: "Climate trends" },
  { href: "/hazards", label: "Disaster risk" },
  { href: "/methods", label: "How it works" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="Earth's Hidden Signals, home">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-ink">Earth&apos;s Hidden Signals</span>
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
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
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
                {tab.label}
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

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "Match my device", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

function ThemeSwitcher() {
  const pref = useThemePreference();

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
    <div role="radiogroup" aria-label="Colour theme" className="flex rounded-full border border-line bg-card p-0.5">
      {THEME_OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          title={label}
          aria-label={label}
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
