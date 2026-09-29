"use client";

// English / Bangla switch. The page is pre-rendered in English; after it loads, the viewer's
// saved choice (localStorage) swaps the text. <T en="…" bn="…" /> keeps both languages
// side by side in the code, so a translation can never drift away from its English text.

import { useSyncExternalStore } from "react";

export type Lang = "en" | "bn";
const KEY = "lang";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  return () => observer.disconnect();
}

export function useLang(): Lang {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.lang === "bn" ? "bn" : "en"),
    () => "en",
  );
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Storage can be blocked; the switch still works for this visit.
  }
  document.documentElement.lang = lang;
}


/** Inline text in both languages. */
export function T({ en, bn }: { en: React.ReactNode; bn: React.ReactNode }) {
  return <>{useLang() === "bn" ? bn : en}</>;
}

export { bnNum } from "./bn";

/** A string in the current language (for attributes like aria-label and placeholder). */
export function useT() {
  const lang = useLang();
  return (en: string, bn: string) => (lang === "bn" ? bn : en);
}
