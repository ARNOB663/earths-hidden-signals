"use client";

// Three short questions that start an investigation on the Climate trends page (the challenge asks for
// "a short series of questions about what or where they would like to investigate"). Shown once per
// visit on the World view; every answer is also reachable from the page's own controls.

import { X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { T, useT } from "@/lib/i18n";

export type What = "temperature" | "wet-season" | "rainfall";
type Where = "world" | "south-asia" | "town";
type When = "past" | "future";

const WHAT: [What, string, string][] = [
  ["temperature", "Temperature", "তাপমাত্রা"],
  ["wet-season", "Rainy-season rain", "বর্ষার বৃষ্টি"],
  ["rainfall", "Yearly rain", "বার্ষিক বৃষ্টি"],
];
const WHERE: [Where, string, string][] = [
  ["world", "The whole world", "পুরো পৃথিবী"],
  ["south-asia", "South Asia", "দক্ষিণ এশিয়া"],
  ["town", "My town", "আমার শহর"],
];
const WHEN: [When, string, string][] = [
  ["past", "Since 1981", "১৯৮১ থেকে"],
  ["future", "By 2041–2060", "২০৪১–২০৬০ সালে"],
];

const KEY = "trends-start-seen";

export function TrendsStart({ onWorld }: { onWorld: (measure: What | "future") => void }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState<What>("temperature");
  const [where, setWhere] = useState<Where>("world");
  const [when, setWhen] = useState<When>("past");
  const first = useRef<HTMLButtonElement>(null);

  // Once per visit: storage can be blocked, in which case the card simply shows.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage once after mount
    if (!seen) setOpen(true);
  }, []);

  const close = () => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = () => {
    close();
    if (where === "town") return router.push("/your-place");
    if (where === "south-asia") {
      // The South Asia explorer reads its variable and season from the address.
      const q = what === "temperature" ? "var=temperature&season=annual" : what === "wet-season" ? "var=rainfall&season=monsoon" : "var=rainfall&season=annual";
      window.location.assign(`/trends?${q}`);
      return;
    }
    onWorld(when === "future" ? "future" : what);
  };

  if (!open) return null;

  const Row = <V extends string>({ label, options, value, set }: { label: [string, string]; options: [V, string, string][]; value: V; set: (v: V) => void }) => (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold text-ink">
        <T en={label[0]} bn={label[1]} />
      </legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map(([id, en, bn], i) => (
          <button
            key={id}
            ref={i === 0 && label[0].startsWith("1") ? first : undefined}
            type="button"
            aria-pressed={value === id}
            onClick={() => set(id)}
            className={`min-h-9 rounded-full border px-3.5 text-sm transition-colors ${value === id ? "border-transparent bg-accent-strong text-accent-ink" : "border-line text-ink-2 hover:text-ink"}`}
          >
            <T en={en} bn={bn} />
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="absolute inset-0 z-[900] grid place-items-center bg-[color-mix(in_srgb,var(--page)_55%,transparent)] p-3">
      <div role="dialog" aria-labelledby="start-title" className="w-full max-w-md rounded-2xl bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <h2 id="start-title" className="text-lg font-semibold text-ink">
            <T en="What would you like to investigate?" bn="আপনি কী খুঁজে দেখতে চান?" />
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={t("Skip", "বাদ দিন")}
            className="-m-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {Row({ label: ["1. What?", "১. কী?"], options: WHAT, value: what, set: setWhat })}
        {Row({ label: ["2. Where?", "২. কোথায়?"], options: WHERE, value: where, set: setWhere })}
        {where !== "south-asia" && where !== "town" && Row({ label: ["3. When?", "৩. কখন?"], options: WHEN, value: when, set: setWhen })}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={go}
            className="min-h-11 flex-1 rounded-full bg-accent-strong px-5 font-medium text-accent-ink transition-colors hover:bg-accent-hover"
          >
            <T en="Show me" bn="দেখান" />
          </button>
          <button type="button" onClick={close} className="min-h-11 rounded-full px-4 text-sm text-ink-2 hover:text-ink">
            <T en="Just explore" bn="নিজে ঘুরে দেখি" />
          </button>
        </div>
      </div>
    </div>
  );
}
