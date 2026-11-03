"use client";

// "Why": the NASA evidence behind the status, in millimetres and in plain words, plus the labelled
// external outlook. Nothing here can change the status.

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { SignalCell } from "@/lib/signals/types";

interface OutlookDay {
  date: string;
  mm: number | null;
}

// Word boundaries are the engine's own Red and Yellow percentile thresholds, passed in from
// config by the server page. Nothing here decides a status; it only describes the percentile.
function percentileWords(percentile: number | null, red: number, yellow: number): { en: string; bn: string } | null {
  if (percentile === null) return null;
  if (percentile >= red) return { en: "among the wettest days in the record", bn: "রেকর্ডের সবচেয়ে ভেজা দিনগুলোর একটি" };
  if (percentile >= yellow) return { en: "wetter than most days for this date", bn: "এই তারিখের বেশিরভাগ দিনের চেয়ে বেশি ভেজা" };
  if (percentile >= 50) return { en: "around normal for this date", bn: "এই তারিখের স্বাভাবিকের কাছাকাছি" };
  return { en: "drier than usual for this date", bn: "এই তারিখের স্বাভাবিকের চেয়ে শুকনো" };
}

export function WhyBox({
  cell,
  sampleData,
  lat,
  lon,
  percentileCutoffs,
}: {
  cell: SignalCell;
  sampleData: boolean;
  lat: number;
  lon: number;
  percentileCutoffs: { red: number; yellow: number };
}) {
  const t = useT();
  const [outlook, setOutlook] = useState<OutlookDay[] | null | "unavailable">(null);
  const words = percentileWords(cell.percentile, percentileCutoffs.red, percentileCutoffs.yellow);

  useEffect(() => {
    if (sampleData) return;
    let cancelled = false;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("daily", "precipitation_sum");
    url.searchParams.set("forecast_days", "7");
    url.searchParams.set("timezone", "GMT");
    fetch(url, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("status"))))
      .then((payload: { daily?: { time?: string[]; precipitation_sum?: (number | null)[] } }) => {
        if (cancelled) return;
        const times = payload.daily?.time ?? [];
        const sums = payload.daily?.precipitation_sum ?? [];
        setOutlook(times.map((date, index) => ({ date, mm: sums[index] ?? null })));
      })
      .catch(() => !cancelled && setOutlook("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [lat, lon, sampleData]);

  return (
    <section aria-labelledby="why" className="mt-4 rounded-2xl border border-line bg-card p-4">
      <h2 id="why" className="text-base font-semibold text-ink">
        {t("Why", "কেন")}
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        {(
          [
            ["1 day", cell.day1],
            ["3 days", cell.day3],
            ["7 days", cell.day7],
          ] as const
        ).map(([label, mm]) => (
          <div key={label} className="rounded-xl bg-sunken p-3">
            <dt className="text-xs text-ink-3">{t(label, label === "1 day" ? "১ দিন" : label === "3 days" ? "৩ দিন" : "৭ দিন")}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{mm === null ? "—" : `${mm} mm`}</dd>
          </div>
        ))}
      </dl>
      {cell.ratio !== null && (
        <p className="mt-3 text-sm text-ink">
          {t(
            `${cell.windowDays ?? 1}-day rain was ${cell.ratio.toFixed(1)} times normal for this date.`,
            `${cell.windowDays ?? 1}-দিনের বৃষ্টি এই তারিখের স্বাভাবিকের ${cell.ratio.toFixed(1)} গুণ ছিল।`,
          )}
        </p>
      )}
      {words && (
        <p className="mt-1 text-sm text-ink-2">
          {t("In words:", "কথায়:")} {t(words.en, words.bn)}
        </p>
      )}
      <p className="mt-3 text-sm text-ink-3">
        {t(
          "Soil-moisture context is coarse (about 36 km) and never changes the status.",
          "মাটির আর্দ্রতার তথ্য মোটামুটি (প্রায় ৩৬ কিমি) এবং অবস্থা বদলায় না।",
        )}
      </p>

      <div className="mt-4 border-t border-line pt-3">
        <h3 className="text-sm font-semibold text-ink">{t("Next 7 days (external outlook)", "আগামী ৭ দিন (বাইরের পূর্বাভাস)")}</h3>
        {sampleData ? (
          <p className="mt-1 text-sm text-ink-3">{t("Outlook is off in sample mode.", "নমুনা মোডে পূর্বাভাস বন্ধ।")}</p>
        ) : outlook === null ? (
          <p className="mt-1 text-sm text-ink-3">{t("Loading outlook", "পূর্বাভাস লোড হচ্ছে")}</p>
        ) : outlook === "unavailable" ? (
          <p className="mt-1 text-sm text-ink-3">{t("Outlook unavailable right now.", "পূর্বাভাস এখন পাওয়া যাচ্ছে না।")}</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-2 text-sm text-ink-2">
            {outlook.map((day) => (
              <li key={day.date} className="rounded-lg bg-sunken px-2 py-1 tabular-nums">
                {day.date.slice(5)} · {day.mm === null ? "—" : `${day.mm} mm`}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-3">
          {t(
            "Outlook from an external public source, not our signal and not an official warning.",
            "পূর্বাভাস একটি বাইরের উন্মুক্ত উৎস থেকে, আমাদের সংকেত নয় এবং সরকারি সতর্কবার্তাও নয়।",
          )}
        </p>
      </div>
    </section>
  );
}
