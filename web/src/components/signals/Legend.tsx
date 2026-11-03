// Colour legend and the DEMO notice. Colour is never the only cue: each state also carries its
// word. Any lower cut is inclusive, so the bands tile 0–100% with no gap and no overlap. The cuts
// come from demo-scores.json and are labelled illustrative: they are not calibrated.

import { FlaskConical } from "lucide-react";
import { T } from "@/lib/i18n";
import { ROW_STATE, type RowSignal } from "@/lib/signals/states";

export interface Band {
  signal: RowSignal;
  min: number;
  max?: number;
}

type Range = { lo: number; hi: number; text: (lo: number, hi: number) => string };

// Green [0,50), Yellow [50,75), Red [75,100]. Built from the file's cuts so the legend can never
// describe bands the data does not use.
function bandRange(bands: Band[], state: RowSignal): Range | null {
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  const index = sorted.findIndex((band) => band.signal === state);
  if (index < 0) return null;
  const lo = sorted[index].min;
  const hi = sorted[index + 1]?.min ?? sorted[index].max ?? 1;
  return { lo, hi, text: (from, to) => `${Math.round(from * 100)}% – below ${Math.round(to * 100)}%` };
}

function rangeLabel(range: Range, state: RowSignal): { en: string; bn: string } {
  const lo = Math.round(range.lo * 100);
  const hi = Math.round(range.hi * 100);
  if (state === "green") return { en: `below ${hi}%`, bn: `${hi}% এর নিচে` };
  if (state === "red") return { en: `${lo}% and above`, bn: `${lo}% ও তার বেশি` };
  return { en: `${lo}% – below ${hi}%`, bn: `${lo}% – ${hi}% এর নিচে` };
}

const MEANING: Record<RowSignal, { en: string; bn: string }> = {
  green: {
    en: "Demo score below the yellow cut. Not an all-clear.",
    bn: "হলুদ সীমার নিচের ডেমো স্কোর। নিরাপত্তার নিশ্চয়তা নয়।",
  },
  yellow: {
    en: "Demo score at or above the yellow cut, below the red cut.",
    bn: "হলুদ সীমায় বা তার উপরে, লাল সীমার নিচে ডেমো স্কোর।",
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

const ORDER: RowSignal[] = ["green", "yellow", "red", "no-data"];

export function SignalLegend({ bands }: { bands: Band[] }) {
  return (
    <section aria-labelledby="legend" className="rounded-2xl border border-line bg-card p-4">
      <h2 id="legend" className="text-sm font-semibold text-ink">
        <T en="Legend" bn="নির্দেশিকা" />
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {ORDER.map((state) => {
          const style = ROW_STATE[state];
          const range = bandRange(bands, state);
          const label = range ? rangeLabel(range, state) : null;
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
                  {label && (
                    <span className="ml-1.5 font-normal tabular-nums text-ink-3">
                      <T en={label.en} bn={label.bn} />
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
      <div aria-hidden className="mt-3 flex h-2 overflow-hidden rounded-full">
        <span className="flex-[50]" style={{ background: "var(--good)" }} />
        <span className="flex-[25]" style={{ background: "var(--watch)" }} />
        <span className="flex-[25]" style={{ background: "var(--alert)" }} />
      </div>
      <p className="mt-2 text-xs text-ink-3">
        <T
          en="Bands run Green, Yellow, Red across the whole 0–100% range: these cut points are illustrative demo thresholds, not a calibrated or official risk scale. A Green colour is a low demo score, never a statement that an area is safe."
          bn="সীমাগুলো পুরো ০–১০০% জুড়ে সবুজ, হলুদ, লাল: এই ছেদবিন্দুগুলো নমুনামূলক ডেমো সীমা, সুনির্দিষ্ট বা সরকারি ঝুঁকি-স্কেল নয়। সবুজ রং কেবল কম ডেমো স্কোর, এলাকা নিরাপদ — এমন নয়।"
        />
      </p>
    </section>
  );
}

export function DemoNotice({
  event,
  eventPeriod,
  coverageText,
}: {
  event: string;
  eventPeriod: string;
  coverageText?: { en: string; bn: string };
}) {
  return (
    <div
      role="note"
      aria-labelledby="demo-notice"
      className="rounded-2xl border border-dashed border-watch bg-watch-soft p-4 text-watch"
    >
      <p id="demo-notice" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-watch px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-page">
          <FlaskConical size={12} aria-hidden />
          <T en="Demo · simulated" bn="ডেমো · অনুকরণ" />
        </span>
        <T en="Sample scores — not predictions, measurements or alerts" bn="নমুনা স্কোর — পূর্বাভাস, পরিমাপ বা সতর্কবার্তা নয়" />
      </p>
      <p className="mt-2 text-sm text-ink-2">
        <T
          en={`Each percentage is a fixed sample probability for the event “${event}”, ${eventPeriod.toLowerCase()}. It is not computed from NASA data and has not been compared with anything that happened; model confidence is a separate sample number, not accuracy.`}
          bn={`প্রতিটি শতাংশ “${event}” (${eventPeriod}) ঘটনার একটি নির্দিষ্ট নমুনা সম্ভাবনা। এটি নাসা তথ্য থেকে হিসাব করা নয় এবং ঘটে যাওয়া কিছুর সাথে মেলানো হয়নি; মডেল আত্মবিশ্বাস আলাদা একটি নমুনা সংখ্যা, নির্ভুলতা নয়।`}
        />
      </p>
      {coverageText && (
        <p className="mt-2 text-sm text-ink-2">
          <T en={coverageText.en} bn={coverageText.bn} />
        </p>
      )}
    </div>
  );
}
