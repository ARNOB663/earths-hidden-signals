"use client";

// Future Outlook explorer: what six NASA-downscaled climate models say about 2041–2060 for each
// region, under two emissions pathways. Leads with "today's 1-in-10" events (how often they would
// happen), then every change with its model range and agreement, then whether the observed
// 1981–2025 trend points the same way. All numbers come from analysis/future.py.

import { useState } from "react";
import { CONTROL } from "@/components/ui";
import { bnNum } from "@/lib/bn";
import { T, useLang } from "@/lib/i18n";
import { ZONE_BN } from "@/lib/names";
import {
  EXCEED_ORDER,
  EXCEED_WORDS,
  METRIC_BN,
  METRIC_ORDER,
  oneIn,
  SCENARIO_WORDS,
  signedChange,
  type ExceedKey,
  type MetricKey,
  type Outlook,
  type ScenarioKey,
} from "@/lib/future";
import type { TrendSummary } from "@/lib/trends";

export interface ObservedTrends {
  temperature: TrendSummary | null;
  monsoon: TrendSummary | null;
  monsoonMean: number | null;
}

const ALPHA = 0.05;

export default function FutureExplorer({ outlook, observed }: { outlook: Outlook; observed: Record<string, ObservedTrends> }) {
  const bn = useLang() === "bn";
  const [scenario, setScenario] = useState<ScenarioKey>("ssp585");
  const [regionId, setRegionId] = useState(outlook.regions.find((r) => r.id === "bengal-delta")?.id ?? outlook.regions[0].id);
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const region = outlook.regions.find((r) => r.id === regionId) ?? outlook.regions[0];
  const sc = region.scenarios[scenario];
  const n = outlook.models.length;
  const name = (id: string, en: string) => (bn ? (ZONE_BN[id]?.name ?? en) : en);
  const activeMetric = metric ?? region.focus[0];

  // Risk cards: the region's hazard decides which come first.
  const focusFirst: ExceedKey[] =
    region.hazard === "wildfire" ? ["hotYear", "dryMonsoon", "wetMonsoon", "heavyYear"] : EXCEED_ORDER;

  return (
    <div>
      {/* ── Controls ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <fieldset>
          <legend className="text-xs font-medium text-ink-3">
            <T en="Region" bn="অঞ্চল" />
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {outlook.regions.map((r) => {
              const on = r.id === region.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setRegionId(r.id);
                    setMetric(null);
                  }}
                  className={`${CONTROL.button} ${CONTROL.transition} ${CONTROL.focusRing} rounded-full border px-3.5 text-sm font-medium ${
                    on ? "border-transparent bg-accent-strong text-accent-ink" : "border-line bg-card text-ink-2 hover:text-ink"
                  }`}
                >
                  {name(r.id, r.id === "study-area" ? "All of South Asia" : r.name)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-xs font-medium text-ink-3">
            <T en="Emissions pathway" bn="নিঃসরণের পথ" />
          </legend>
          <div className="mt-1.5 inline-flex rounded-full border border-line bg-card p-1">
            {(Object.keys(SCENARIO_WORDS) as ScenarioKey[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === scenario}
                onClick={() => setScenario(s)}
                title={bn ? SCENARIO_WORDS[s].hintBn : SCENARIO_WORDS[s].hint}
                className={`${CONTROL.segment} ${CONTROL.transition} ${CONTROL.focusRing} whitespace-nowrap rounded-full px-3 text-sm font-medium ${
                  s === scenario ? "bg-accent-strong text-accent-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {bn ? SCENARIO_WORDS[s].bn : SCENARIO_WORDS[s].en}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        <T
          en={`${SCENARIO_WORDS[scenario].hint}. ${outlook.future[0]}–${outlook.future[1]} compared with ${outlook.present[0]}–${outlook.present[1]}, ${n} climate models.`}
          bn={`${SCENARIO_WORDS[scenario].hintBn}। ${bnNum(outlook.future[0])}–${bnNum(outlook.future[1])}, ${bnNum(outlook.present[0])}–${bnNum(outlook.present[1])}-এর তুলনায়, ${bnNum(n)}টি জলবায়ু মডেল।`}
        />
      </p>

      {/* ── Today's 1-in-10 events ── */}
      <h3 className="mt-8 text-lg font-semibold text-ink">
        <T en="How often would today's rare years happen?" bn="আজকের বিরল বছরগুলো কত ঘন ঘন হবে?" />
      </h3>
      <p className="mt-1 max-w-[72ch] text-sm text-ink-2">
        <T
          en="Each model's own 1-in-10 year today (its 2 most extreme years out of 20), and how often the same model reaches that level in 2041–2060. The middle model is shown; the range covers all models."
          bn="প্রতিটি মডেলের আজকের ১০ বছরে ১ বারের বছর (২০ বছরের মধ্যে তার সবচেয়ে চরম ২টি), আর ২০৪১–২০৬০ সালে একই মডেল কত ঘন ঘন সেই মাত্রায় পৌঁছায়। মাঝের মডেলটি দেখানো হয়েছে; পরিসর সব মডেলের।"
        />
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {focusFirst.map((k) => {
          const e = sc.exceedance[k];
          const fut = oneIn(e.median);
          const lo = oneIn(e.min);
          const hi = oneIn(e.max);
          const filled = Math.round(e.median * 10);
          return (
            <article key={k} className="rounded-2xl border border-line bg-card p-4 shadow-soft">
              <p className="text-sm font-semibold text-ink">
                <T en={EXCEED_WORDS[k].en} bn={EXCEED_WORDS[k].bn} />
              </p>
              <dl className="mt-3 grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-2 text-sm">
                <dt className="text-ink-3">
                  <T en="Today" bn="আজ" />
                </dt>
                <dd className="flex items-center gap-3">
                  <Dots filled={1} />
                  <span className="text-ink-2">
                    <T en="1 in 10 years" bn="১০ বছরে ১ বার" />
                  </span>
                </dd>
                <dt className="text-ink-3">
                  {bnOr(bn, `${outlook.future[0]}–${String(outlook.future[1]).slice(2)}`)}
                </dt>
                <dd className="flex items-center gap-3">
                  <Dots filled={filled} strong />
                  <span className="font-semibold text-ink">
                    <T en={fut.en} bn={fut.bn} />
                  </span>
                </dd>
              </dl>
              <p className="mt-2 text-xs text-ink-3">
                <T
                  en={`Across the ${n} models: from ${lo.en} to ${hi.en}.`}
                  bn={`${bnNum(n)}টি মডেলে: ${lo.bn} থেকে ${hi.bn}।`}
                />
              </p>
            </article>
          );
        })}
      </div>

      {/* ── All changes ── */}
      <h3 className="mt-10 text-lg font-semibold text-ink">
        <T en="Every change, with how many models agree" bn="প্রতিটি পরিবর্তন, কতগুলো মডেল একমত তা সহ" />
      </h3>
      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th scope="col" className="px-4 py-3 font-medium">
                  <T en="Measure" bn="পরিমাপ" />
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  <T en={`Today (${outlook.present[0]}–${String(outlook.present[1]).slice(2)})`} bn="আজ" />
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  <T en="Change" bn="পরিবর্তন" />
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  <T en="Model range" bn="মডেলের পরিসর" />
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <T en="Agree" bn="একমত" />
                </th>
              </tr>
            </thead>
            <tbody>
              {METRIC_ORDER.map((k) => {
                const meta = outlook.metrics[k];
                const m = sc.metrics[k];
                const strong = m.agree >= Math.ceil((2 * n) / 3);
                const on = k === activeMetric;
                return (
                  <tr
                    key={k}
                    className={`border-b border-line last:border-0 ${on ? "bg-accent-soft" : ""}`}
                  >
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <button
                        type="button"
                        onClick={() => setMetric(k)}
                        aria-pressed={on}
                        className={`${CONTROL.focusRing} text-left text-ink underline decoration-line underline-offset-2 hover:decoration-current`}
                      >
                        {bn ? METRIC_BN[k] : meta.label}
                      </button>
                      {region.focus.includes(k) && (
                        <span className="ml-1.5 rounded-full bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-2">
                          <T en="key for this hazard" bn="এই দুর্যোগে গুরুত্বপূর্ণ" />
                        </span>
                      )}
                    </th>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">
                      {bnOr(bn, region.present[k].toLocaleString("en-US", { maximumFractionDigits: meta.decimals }))}{" "}
                      <span className="text-xs text-ink-3">{meta.unit}</span>
                    </td>
                    <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${strong ? "text-ink" : "text-ink-3"}`}>
                      {bnOr(bn, signedChange(m.median, meta.kind, meta.decimals))}
                      {meta.kind === "abs" && <span className="ml-1 text-xs font-normal text-ink-3">{meta.unit}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-ink-3">
                      {bnOr(bn, `${signedChange(m.min, meta.kind, meta.decimals)} … ${signedChange(m.max, meta.kind, meta.decimals)}`)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${strong ? "text-ink" : "text-ink-3"}`}>
                      <T en={`${m.agree} of ${n}`} bn={`${bnNum(n)}টির ${bnNum(m.agree)}টি`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-sm font-semibold text-ink">
            {bn ? METRIC_BN[activeMetric] : outlook.metrics[activeMetric].label}
            <span className="font-normal text-ink-3">
              {" · "}
              <T en="each model" bn="প্রতিটি মডেল" />
            </span>
          </p>
          <ModelStrip
            values={sc.metrics[activeMetric].perModel}
            median={sc.metrics[activeMetric].median}
            kind={outlook.metrics[activeMetric].kind}
            decimals={outlook.metrics[activeMetric].decimals}
            unit={outlook.metrics[activeMetric].unit}
          />
          <p className="mt-2 text-xs text-ink-3">
            <T
              en="Dots far apart = the models disagree; the bold line is the middle model. Grey numbers in the table mean fewer than two-thirds of models agree on the direction."
              bn="বিন্দুগুলো দূরে দূরে = মডেলগুলো একমত নয়; গাঢ় রেখা মাঝের মডেল। সারণিতে ধূসর সংখ্যা মানে দুই-তৃতীয়াংশের কম মডেল দিক নিয়ে একমত।"
            />
          </p>
        </div>
      </div>

      {/* ── Past vs future ── */}
      <PastVsFuture
        observed={observed[region.id]}
        monsoon={sc.metrics.monsoonRain}
        temp={sc.metrics.tMean}
        n={n}
        regionName={name(region.id, region.id === "study-area" ? "South Asia" : region.name)}
      />
    </div>
  );
}

const bnOr = (bn: boolean, s: string) => (bn ? bnNum(s) : s);

function Dots({ filled, strong }: { filled: number; strong?: boolean }) {
  return (
    <span aria-hidden className="flex gap-1">
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${i < filled ? (strong ? "bg-alert" : "bg-ink-2") : "border border-line bg-sunken"}`}
        />
      ))}
    </span>
  );
}

function ModelStrip({
  values,
  median,
  kind,
  decimals,
  unit,
}: {
  values: Record<string, number>;
  median: number;
  kind: "abs" | "pct";
  decimals: number;
  unit: string;
}) {
  const entries = Object.entries(values).sort((a, b) => a[1] - b[1]);
  const all = [...entries.map(([, v]) => v), 0, median];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo || 1) * 0.12;
  const W = 420;
  const rowH = 22;
  const H = entries.length * rowH + 30;
  const x = (v: number) => 120 + ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (W - 140);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={`Change per model, middle ${signedChange(median, kind, decimals)}`}>
      <line x1={x(0)} x2={x(0)} y1={4} y2={H - 22} stroke="var(--ink-3)" strokeDasharray="3 3" />
      <text x={x(0)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
        0
      </text>
      <line x1={x(median)} x2={x(median)} y1={4} y2={H - 22} stroke="var(--ink)" strokeWidth="2" />
      <text x={x(median)} y={H - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">
        {signedChange(median, kind, decimals)}
        {kind === "abs" ? ` ${unit}` : ""}
      </text>
      {entries.map(([m, v], i) => (
        <g key={m}>
          <text x={0} y={14 + i * rowH} fontSize="11" fill="var(--ink-2)">
            {m}
          </text>
          <line x1={120} x2={W - 20} y1={10 + i * rowH} y2={10 + i * rowH} stroke="var(--line)" />
          <circle cx={x(v)} cy={10 + i * rowH} r={5} fill={v >= 0 ? "var(--cool-3)" : "var(--warm-3)"} />
        </g>
      ))}
    </svg>
  );
}

/** Does the observed 1981–2025 trend point the same way as the projections? Worded with care. */
function PastVsFuture({
  observed,
  monsoon,
  temp,
  n,
  regionName,
}: {
  observed: ObservedTrends | undefined;
  monsoon: { median: number; agree: number };
  temp: { median: number; agree: number };
  n: number;
  regionName: string;
}) {
  if (!observed) return null;
  const needed = Math.ceil((2 * n) / 3);
  const rows: { en: string; bn: string; verdict: { en: string; bn: string } }[] = [];

  const t = observed.temperature;
  if (t) {
    const same = t.p < ALPHA && t.slopePerDecade > 0 && temp.median > 0 && temp.agree >= needed;
    rows.push({
      en: `Temperature: observed ${t.slopePerDecade > 0 ? "+" : ""}${t.slopePerDecade.toFixed(2)} °C per decade${t.p < ALPHA ? " (clear)" : ""}; models: ${temp.median > 0 ? "+" : ""}${temp.median.toFixed(1)} °C by mid-century (${temp.agree} of ${n} agree).`,
      bn: `তাপমাত্রা: পর্যবেক্ষিত প্রতি দশকে ${bnNum(t.slopePerDecade.toFixed(2))} °সে${t.p < ALPHA ? " (স্পষ্ট)" : ""}; মডেল: শতাব্দীর মাঝামাঝি ${bnNum(temp.median.toFixed(1))} °সে (${bnNum(n)}টির ${bnNum(temp.agree)}টি একমত)।`,
      verdict: same ? { en: "Same direction", bn: "একই দিক" } : { en: "Check", bn: "যাচাই করুন" },
    });
  }
  const m = observed.monsoon;
  if (m && observed.monsoonMean) {
    const obsPct = (m.slopePerDecade / observed.monsoonMean) * 100;
    const clear = m.p < ALPHA;
    const modelsAgree = monsoon.agree >= needed;
    let verdict: { en: string; bn: string };
    if (!modelsAgree) verdict = { en: "Models split", bn: "মডেলে মতভেদ" };
    else if (!clear) verdict = { en: "No clear past trend", bn: "অতীতে স্পষ্ট প্রবণতা নেই" };
    else if (Math.sign(obsPct) === Math.sign(monsoon.median)) verdict = { en: "Same direction", bn: "একই দিক" };
    else verdict = { en: "Opposite directions", bn: "বিপরীত দিক" };
    rows.push({
      en: `Monsoon rain: observed ${obsPct > 0 ? "+" : ""}${obsPct.toFixed(1)}% per decade${clear ? " (clear)" : " (not clear)"}; models: ${monsoon.median > 0 ? "+" : ""}${monsoon.median.toFixed(0)}% by mid-century (${monsoon.agree} of ${n} agree on the direction).`,
      bn: `বর্ষার বৃষ্টি: পর্যবেক্ষিত প্রতি দশকে ${bnNum(obsPct.toFixed(1))}%${clear ? " (স্পষ্ট)" : " (স্পষ্ট নয়)"}; মডেল: শতাব্দীর মাঝামাঝি ${bnNum(monsoon.median.toFixed(0))}% (${bnNum(n)}টির ${bnNum(monsoon.agree)}টি দিক নিয়ে একমত)।`,
      verdict,
    });
  }
  const opposite = rows.some((r) => r.verdict.en === "Opposite directions");

  return (
    <section className="mt-10 rounded-2xl border border-line bg-card p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-ink">
        <T en={`Past trend vs projection: ${regionName}`} bn={`অতীতের প্রবণতা বনাম অনুমান: ${regionName}`} />
      </h3>
      <ul className="mt-3 space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
            <span className="w-fit shrink-0 rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-ink">
              <T en={r.verdict.en} bn={r.verdict.bn} />
            </span>
            <span className="text-sm leading-relaxed text-ink-2">
              <T en={r.en} bn={r.bn} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-ink-2">
        {opposite ? (
          <T
            en="The observed trend runs against what most models project. That is a real finding, not an error: 45 years can be dominated by natural swings or by local causes the global models handle poorly, such as air pollution dimming the sun or large-scale irrigation. Treat both the trend and the projection with care here."
            bn="পর্যবেক্ষিত প্রবণতা বেশিরভাগ মডেলের অনুমানের বিপরীত। এটি ভুল নয়, একটি সত্যিকারের ফলাফল: ৪৫ বছরে প্রাকৃতিক ওঠানামা বা স্থানীয় কারণ (যেমন বায়ুদূষণে সূর্যালোক কমা বা ব্যাপক সেচ) প্রাধান্য পেতে পারে, যা বৈশ্বিক মডেল ভালো ধরতে পারে না। এখানে প্রবণতা ও অনুমান দুটোই সাবধানে দেখুন।"
          />
        ) : (
          <T
            en="Where the past trend and the models point the same way, the evidence is strongest. Where the models split, the honest answer is that the direction of change is not yet known."
            bn="যেখানে অতীতের প্রবণতা ও মডেল একই দিকে, সেখানে প্রমাণ সবচেয়ে শক্ত। যেখানে মডেলে মতভেদ, সেখানে সৎ উত্তর হলো পরিবর্তনের দিক এখনো জানা নেই।"
          />
        )}
      </p>
    </section>
  );
}
