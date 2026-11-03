// Colour legend and the DEMO notice. Colour is never the only cue: each state also carries its
// word. The band cuts come from demo-scores.json, so changing the demo generator never leaves
// this legend describing bands the data does not use.

import { FlaskConical } from "lucide-react";
import { T } from "@/lib/i18n";
import { ROW_STATE, type RowSignal } from "@/lib/signals/states";

const ORDER: RowSignal[] = ["green", "yellow", "red", "no-data"];

const MEANING: Record<RowSignal, { en: string; bn: string }> = {
  green: {
    en: "Demo score below the yellow cut. Not an all-clear.",
    bn: "হলুদ সীমার নিচের ডেমো স্কোর। নিরাপত্তার নিশ্চয়তা নয়।",
  },
  yellow: {
    en: "Demo score at or above the yellow cut.",
    bn: "হলুদ সীমায় বা তার উপরে ডেমো স্কোর।",
  },
  red: {
    en: "Demo score at or above the red cut.",
    bn: "লাল সীমায় বা তার উপরে ডেমো স্কোর।",
  },
  "no-data": {
    en: "No usable NASA data for this area — a gap, never a safe area.",
    bn: "এই এলাকার ব্যবহারযোগ্য নাসা তথ্য নেই — ফাঁক, কখনো নিরাপদ এলাকা নয়।",
  },
};

function bandText(bands: { signal: RowSignal; min: number }[], state: RowSignal): { en: string; bn: string } | null {
  if (state === "no-data") return null;
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  const index = sorted.findIndex((band) => band.signal === state);
  if (index < 0) return null;
  const min = sorted[index].min;
  const lower = sorted[index + 1]?.min ?? 0;
  if (state === "red") {
    const value = `${Math.round(min * 100)}%+`;
    return { en: value, bn: `${value} এর বেশি` };
  }
  if (state === "green") {
    const value = `below ${Math.round(lower * 100)}%`;
    return { en: value, bn: `${Math.round(lower * 100)}% এর নিচে` };
  }
  const value = `${Math.round(min * 100)}–${Math.round(sorted[index - 1].min * 100)}%`;
  return { en: value, bn: value };
}

export function SignalLegend({ bands }: { bands: { signal: RowSignal; min: number }[] }) {
  return (
    <section aria-labelledby="legend" className="rounded-2xl border border-line bg-card p-4">
      <h2 id="legend" className="text-sm font-semibold text-ink">
        <T en="Legend" bn="নির্দেশিকা" />
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {ORDER.map((state) => {
          const style = ROW_STATE[state];
          const band = bandText(bands, state);
          return (
            <div key={state} className="flex gap-2.5">
              <span
                aria-hidden
                className={`mt-0.5 h-4 w-4 shrink-0 rounded-full ${
                  state === "no-data" ? "border-2 border-ink-3" : ""
                }`}
                style={
                  state === "no-data"
                    ? undefined
                    : { background: `var(--${state === "green" ? "good" : state === "yellow" ? "watch" : "alert"})` }
                }
              />
              <div className="min-w-0">
                <dt className={`text-sm font-medium ${style.className}`}>
                  <T en={style.word.en} bn={style.word.bn} />
                  {band && (
                    <span className="ml-1.5 font-normal text-ink-3">
                      <T en={band.en} bn={band.bn} />
                    </span>
                  )}
                </dt>
                <dd className="text-xs text-ink-2">
                  <T en={MEANING[state].en} bn={MEANING[state].bn} />
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export function DemoNotice({ event, eventPeriod }: { event: string; eventPeriod: string }) {
  return (
    <div
      role="note"
      aria-labelledby="demo-notice"
      className="rounded-2xl border border-dashed border-watch bg-watch-soft p-4 text-watch"
    >
      <p id="demo-notice" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-watch px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-page">
          <FlaskConical size={12} aria-hidden />
          <T en="Demo data" bn="ডেমো তথ্য" />
        </span>
        <T en="Sample scores — not predictions, measurements or alerts" bn="নমুনা স্কোর — পূর্বাভাস, পরিমাপ বা সতর্কবার্তা নয়" />
      </p>
      <p className="mt-2 text-sm text-ink-2">
        <T
          en={`The percentage is a fixed sample number for “${event}”, ${eventPeriod.toLowerCase()}. It is not computed from NASA data and has not been compared with anything that happened. NASA-derived coverage under each area is real and is labelled separately.`}
          bn={`শতাংশটি “${event}” (${eventPeriod}) এর জন্য একটি নির্দিষ্ট নমুনা সংখ্যা। এটি নাসা তথ্য থেকে হিসাব করা নয় এবং ঘটে যাওয়া কিছুর সাথে মেলানো হয়নি। প্রতিটি এলাকার নিচের নাসা-ভিত্তিক আচ্ছাদন প্রকৃত এবং আলাদাভাবে চিহ্নিত।`}
        />
      </p>
    </div>
  );
}
