"use client";

// A shareable evidence card for one location. It is rendered in the page and copied as text, so a
// shared message always carries the observation date, the Watch Level, the Data Trust Grade, the
// sample size and the standing "not a forecast / not an official warning" line.

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { T, useT } from "@/lib/i18n";
import type { SignalRow } from "@/lib/signals/model";

export function ShareCard({ row }: { row: SignalRow }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const card = useRef<HTMLDivElement | null>(null);
  const level = row.frequency.level;
  const levelWord =
    row.watch === "high" ? "Watch Level: High" : row.watch === "elevated" ? "Watch Level: Elevated" : row.watch === "none" ? "No elevated watch" : "Watch Level: Can't tell";
  const lines = [
    `Earth's Hidden Signals — ${row.name}, ${row.countryName}`,
    row.sample
      ? "SAMPLE READING — not a live observation (fixed sample clock, not NASA IMERG)"
      : row.observed
        ? `Observed: ${row.observed.slice(0, 10)} · NASA IMERG Late (0.5° grid)`
        : "Observed: no current reading",
    `${levelWord}`,
    `Data Trust Grade: ${row.trust === "high" ? "High" : row.trust === "medium" ? "Medium" : "Low"}`,
    level ? `Historical frequency: floods in ${level.floods} of ${level.cases} years at ≥${level.mm.toFixed(0)} mm (95% ${(level.low * 100).toFixed(0)}–${(level.high * 100).toFixed(0)}%)` : "Historical frequency: not enough historical evidence",
    "Observational screening. Not a forecast. Not an official warning.",
  ].filter(Boolean);

  const copy = async () => {
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("Copy this card", "এই কার্ড কপি করুন"), text);
    }
  };

  return (
    <section aria-labelledby="share" className="mt-6 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="share" className="text-base font-semibold text-ink">
          <T en="Share this evidence" bn="এই প্রমাণ শেয়ার করুন" />
        </h2>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm text-ink hover:bg-sunken"
        >
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          {copied ? t("Copied", "কপি হয়েছে") : t("Copy card", "কার্ড কপি করুন")}
        </button>
      </div>
      <div ref={card} className="mt-2 rounded-xl border border-line bg-sunken p-4">
        <p className="text-sm font-semibold text-ink">
          {row.name}, {row.countryName}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-ink-3"><T en="Observed" bn="পর্যবেক্ষণ" /></dt>
            <dd className="font-medium tabular-nums text-ink">
              {row.sample ? <T en="Sample" bn="নমুনা" /> : row.observed?.slice(0, 10) ?? "–"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3"><T en="Watch Level" bn="সতর্কতার মাত্রা" /></dt>
            <dd className="font-medium text-ink">{levelWord}</dd>
          </div>
          <div>
            <dt className="text-ink-3"><T en="Data Trust" bn="তথ্য-ভরসা" /></dt>
            <dd className="font-medium text-ink">{row.trust}</dd>
          </div>
          <div>
            <dt className="text-ink-3"><T en="Flood frequency" bn="বন্যা-ফ্রিকোয়েন্সি" /></dt>
            <dd className="font-medium tabular-nums text-ink">
              {level ? `${level.floods}/${level.cases}` : t("Not enough evidence", "যথেষ্ট প্রমাণ নেই")}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] text-ink-3">
          <T en="Observational screening. Not a forecast. Not an official warning." bn="পর্যবেক্ষণভিত্তিক স্ক্রিনিং। পূর্বাভাস নয়। সরকারি সতর্কবার্তা নয়।" />
        </p>
      </div>
    </section>
  );
}
