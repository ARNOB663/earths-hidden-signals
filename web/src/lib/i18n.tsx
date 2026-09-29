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

/** Runs before first paint, so a saved Bangla choice applies without a flash where possible. */
export const LANG_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${KEY}")==="bn")document.documentElement.lang="bn";}catch(e){}})();`;

/** Inline text in both languages. */
export function T({ en, bn }: { en: React.ReactNode; bn: React.ReactNode }) {
  return <>{useLang() === "bn" ? bn : en}</>;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Latin digits (and minus) to Bangla digits, for numbers inside Bangla sentences. */
export function bnNum(value: string | number): string {
  return String(value)
    .replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)])
    .replace(/-/g, "−");
}

/** A string in the current language (for attributes like aria-label and placeholder). */
export function useT() {
  const lang = useLang();
  return (en: string, bn: string) => (lang === "bn" ? bn : en);
}
