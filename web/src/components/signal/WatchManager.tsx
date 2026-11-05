"use client";

// Saved locations and their preferences, kept in this browser's localStorage only. The preference
// controls are labelled as planned: they record what the reader wants, but nothing is delivered.

import { CalendarPlus, Check, MapPin, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { T, useT } from "@/lib/i18n";
import type { CoverageState, WatchLevel } from "@/lib/signals/level";
import { CoverageBadge, Pill, TrustBadge, WatchBadge } from "./levels";

export interface WatchLocation {
  id: string;
  name: string;
  countryName: string;
  coverage: CoverageState;
  watch: WatchLevel;
  trust: "high" | "medium" | "low";
  tileLabel: string;
}

interface Saved {
  id: string;
  levels: WatchLevel[];
  contacts: boolean;
  reminderAt: string;
}

const KEY = "ehs-watch-v1";

function load(): Saved[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Saved[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: Saved[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked (private mode): the list lasts for this visit only.
  }
}

const LEVELS: WatchLevel[] = ["high", "elevated", "none", "unknown"];

const LEVEL_WORD: Record<WatchLevel, { en: string; bn: string }> = {
  high: { en: "High only", bn: "কেবল উচ্চ" },
  elevated: { en: "Elevated and High", bn: "বর্ধিত ও উচ্চ" },
  none: { en: "Any level, including not elevated", bn: "যেকোনো মাত্রা, উচ্চতর নয় সহ" },
  unknown: { en: "Also when it cannot tell", bn: "যখন বলা যায় না তখনও" },
};

export function WatchManager({ locations }: { locations: WatchLocation[] }) {
  const t = useT();
  const searchId = useId();
  const [saved, setSaved] = useState<Saved[]>([]);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Read the saved list after hydration; the page itself renders server-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(load());
    setReady(true);
  }, []);

  const byId = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);
  const results = useMemo(() => {
    const needle = deferred.trim().toLocaleLowerCase();
    if (needle.length < 2) return [];
    return locations
      .filter((location) => `${location.name} ${location.countryName}`.toLocaleLowerCase().includes(needle))
      .slice(0, 8);
  }, [locations, deferred]);

  const update = (next: Saved[]) => {
    setSaved(next);
    save(next);
  };

  const add = (id: string) => {
    if (saved.some((entry) => entry.id === id)) return;
    update([...saved, { id, levels: ["high"], contacts: false, reminderAt: "" }]);
    setQuery("");
  };

  const setLevels = (id: string, levels: WatchLevel[]) => update(saved.map((entry) => (entry.id === id ? { ...entry, levels } : entry)));

  const downloadCalendar = () => {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Earth's Hidden Signals//Watch//EN",
      ...saved.flatMap((entry, index) => {
        const location = byId.get(entry.id);
        if (!location) return [];
        const when = entry.reminderAt || nextWeekday();
        const compact = when.replace(/-/g, "");
        return [
          "BEGIN:VEVENT",
          `UID:${entry.id}-${compact}@earths-hidden-signals`,
          `DTSTAMP:${compact}T090000Z`,
          `DTSTART:${compact}T090000Z`,
          `DTEND:${compact}T093000Z`,
          `SUMMARY:Check the Signal for ${location.name}`,
          `DESCRIPTION:Open the Signal page for ${location.name}, ${location.countryName}. Observational screening, not an official warning.`,
          `SEQUENCE:${index}`,
          "END:VEVENT",
        ];
      }),
      "END:VCALENDAR",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "earth-hidden-signals-watch.ics";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return (
    <section aria-labelledby="saved" className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="saved" className="text-lg font-semibold text-ink">
          <T en="Saved locations" bn="সংরক্ষিত স্থান" />
        </h2>
        <p className="text-xs text-ink-3">
          <T en="Stored in this browser only." bn="কেবল এই ব্রাউজারে সংরক্ষিত।" />
        </p>
      </div>

      <div className="relative mt-2 max-w-md">
        <label htmlFor={searchId} className="sr-only">
          {t("Add a location", "একটি স্থান যোগ করুন")}
        </label>
        <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search a covered district or state", "আচ্ছাদিত জেলা বা রাজ্য খুঁজুন")}
          className="min-h-11 w-full rounded-full border border-line bg-card pl-10 pr-4 text-sm text-ink placeholder:text-ink-3"
        />
        {results.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-card p-1 shadow-soft">
            {results.map((location) => (
              <li key={location.id}>
                <button
                  type="button"
                  onClick={() => add(location.id)}
                  className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm text-ink hover:bg-sunken"
                >
                  <span className="truncate">
                    {location.name} <span className="text-ink-3">· {location.countryName}</span>
                  </span>
                  <Plus size={15} aria-hidden className="shrink-0 text-ink-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ready && saved.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-sunken p-4 text-sm text-ink-2">
          <T en="No saved locations yet. Search above to add one." bn="এখনো কোনো সংরক্ষিত স্থান নেই। যোগ করতে উপরে খুঁজুন।" />
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {saved.map((entry) => {
            const location = byId.get(entry.id);
            if (!location) return null;
            return (
              <li key={entry.id} className="rounded-xl border border-line bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/signal/${location.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-current">
                    <MapPin size={14} aria-hidden />
                    {location.name}, {location.countryName}
                  </Link>
                  <button
                    type="button"
                    onClick={() => update(saved.filter((item) => item.id !== entry.id))}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs text-ink-3 hover:text-ink"
                    aria-label={t(`Remove ${location.name}`, `${location.name} সরান`)}
                  >
                    <Trash2 size={14} aria-hidden />
                    <T en="Remove" bn="সরান" />
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <CoverageBadge state={location.coverage} />
                  <WatchBadge level={location.watch} compact />
                  <TrustBadge grade={location.trust} />
                </div>

                <fieldset className="mt-2">
                  <legend className="flex items-center gap-1.5 text-xs text-ink-3">
                    <T en="Tell me about" bn="জানতে চাই" />
                    <Pill tone="muted">
                      <T en="Planned · not delivered" bn="পরিকল্পিত · পৌঁছায় না" />
                    </Pill>
                  </legend>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {LEVELS.map((level) => {
                      const on = entry.levels.includes(level);
                      return (
                        <button
                          key={level}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setLevels(entry.id, on ? entry.levels.filter((value) => value !== level) : [...entry.levels, level])}
                          className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs ${on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2"}`}
                        >
                          {on && <Check size={11} aria-hidden />}
                          <T en={LEVEL_WORD[level].en} bn={LEVEL_WORD[level].bn} />
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <T en="Calendar reminder for" bn="ক্যালেন্ডার রিমাইন্ডার" />
                  <input
                    type="date"
                    value={entry.reminderAt}
                    onChange={(event) => update(saved.map((item) => (item.id === entry.id ? { ...item, reminderAt: event.target.value } : item)))}
                    className="min-h-8 rounded-lg border border-line bg-card px-2 text-sm text-ink"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {saved.length > 0 && (
        <button
          type="button"
          onClick={downloadCalendar}
          className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent-strong px-4 text-sm font-medium text-accent-ink hover:bg-accent-hover"
        >
          <CalendarPlus size={15} aria-hidden />
          <T en="Download calendar reminders (.ics)" bn="ক্যালেন্ডার রিমাইন্ডার ডাউনলোড (.ics)" />
        </button>
      )}
      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-3">
        <X size={12} aria-hidden className="mt-0.5 shrink-0" />
        <T
          en="Notification choices are saved as a preference for a future feature. No alert is sent from this site today."
          bn="বিজ্ঞপ্তি-পছন্দ ভবিষ্যতের সুবিধার জন্য সংরক্ষিত। আজ এই সাইট থেকে কোনো সতর্কতা পাঠানো হয় না।"
        />
      </p>
    </section>
  );
}

function nextWeekday(): string {
  const date = new Date();
  date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
  return date.toISOString().slice(0, 10);
}
