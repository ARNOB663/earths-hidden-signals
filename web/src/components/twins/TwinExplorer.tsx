"use client";

// Climate Twins explorer. Pick a South Asian hazard region; see which places elsewhere on Earth
// share its 1981–2025 trend fingerprint, how close each match is feature by feature, their rain
// records side by side, and what disasters those places have recorded. Everything shown comes
// from analysis/twins.py; this component only arranges and words it.

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { MapLoading } from "@/components/signal/MapLoading";
import { CONTROL } from "@/components/ui";
import { bnNum } from "@/lib/bn";
import { T, useLang } from "@/lib/i18n";
import { ZONE_BN } from "@/lib/names";
import {
  EVENT_WORDS,
  FEATURE_WORDS,
  featureValue,
  type Block,
  type EventType,
  type FeatureKey,
  type Region,
  type TwinSeries,
} from "@/lib/twins";
import type { TwinMapBlock } from "./TwinMap";

const TwinMap = dynamic(() => import("./TwinMap"), { ssr: false, loading: () => <MapLoading /> });

const KEYS: FeatureKey[] = ["warming", "rainTrend", "wetTrend", "wetness", "seasonality"];
const TRENDS = new Set<FeatureKey>(["warming", "rainTrend", "wetTrend"]);
const TYPES: EventType[] = ["flood", "landslide", "cyclone", "drought"];
const ALPHA = 0.05;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function matchWord(gap: number): { en: string; bn: string; tone: string } {
  if (gap < 0.35) return { en: "Close match", bn: "খুব মিল", tone: "text-accent" };
  if (gap < 0.8) return { en: "Similar", bn: "কাছাকাছি", tone: "text-ink-2" };
  return { en: "Differs", bn: "আলাদা", tone: "text-ink-3" };
}

const sig = (place: { tests: Block["tests"] }, key: FeatureKey) =>
  TRENDS.has(key) && (place.tests[key as "warming"]?.p ?? 1) < ALPHA;

export default function TwinExplorer({
  regions,
  twinBlocks,
  mapBlocks,
  series,
  years,
  eventYears,
}: {
  regions: Region[];
  twinBlocks: Record<string, Block>;
  mapBlocks: TwinMapBlock[];
  series: TwinSeries;
  years: [number, number];
  eventYears: [number, number];
}) {
  const bn = useLang() === "bn";
  const [regionId, setRegionId] = useState(regions[0]?.id ?? "");
  const region = regions.find((r) => r.id === regionId) ?? regions[0];
  const [picked, setPicked] = useState<string | null>(null);
  const activeId = picked && region.twins.some((t) => t.id === picked) ? picked : region.twins[0]?.id ?? null;
  const twin = activeId ? twinBlocks[activeId] : null;
  const twinMeta = region.twins.find((t) => t.id === activeId) ?? null;
  const regionName = bn ? (ZONE_BN[region.id]?.name ?? region.name) : region.name;
  const num = (s: string | number) => (bn ? bnNum(String(s)) : String(s));

  const chooseRegion = (id: string) => {
    setRegionId(id);
    setPicked(null);
  };

  const twinIds = useMemo(() => region.twins.map((t) => t.id), [region]);

  // The fingerprint headline for the chosen region, in words.
  const wt = region.tests.wetTrend;
  const lead = bn
    ? `${regionName}: প্রতি ১০ বছরে ${bnNum(featureValue("warming", region.features.warming))} °সে উষ্ণতা${sig(region, "warming") ? " (স্পষ্ট)" : ""}, বর্ষা মৌসুমের বৃষ্টি প্রতি ১০ বছরে ${bnNum(featureValue("wetTrend", region.features.wetTrend))}%${wt && wt.p < ALPHA ? " (স্পষ্ট)" : " (স্পষ্ট নয়)"}।`
    : `${regionName}: warming ${featureValue("warming", region.features.warming)} °C per decade${sig(region, "warming") ? " (clear)" : ""}, rainy-season rain ${featureValue("wetTrend", region.features.wetTrend)}% per decade${wt && wt.p < ALPHA ? " (clear)" : " (not clear)"}.`;

  return (
    <div>
      {/* ── Region picker ── */}
      <fieldset>
        <legend className="text-xs font-medium text-ink-3">
          <T en="Choose a South Asian region" bn="দক্ষিণ এশিয়ার একটি অঞ্চল বেছে নিন" />
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {regions.map((r) => {
            const on = r.id === region.id;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() => chooseRegion(r.id)}
                className={`${CONTROL.button} ${CONTROL.transition} ${CONTROL.focusRing} rounded-full border px-3.5 text-sm font-medium ${
                  on ? "border-transparent bg-accent-strong text-accent-ink" : "border-line bg-card text-ink-2 hover:text-ink"
                }`}
              >
                {bn ? (ZONE_BN[r.id]?.name ?? r.name) : r.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-4 text-base leading-relaxed text-ink">{lead}</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="relative isolate h-[320px] overflow-hidden rounded-2xl border border-line bg-sunken sm:h-[440px]">
            <TwinMap
              blocks={mapBlocks}
              similarity={region.similarity}
              region={{ name: region.name, bbox: region.bbox }}
              twins={twinIds}
              active={activeId}
              onSelect={setPicked}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
            {[
              ["--cool-4", "Top 1%", "শীর্ষ ১%"],
              ["--cool-3", "Top 5%", "শীর্ষ ৫%"],
              ["--cool-2", "Top 10%", "শীর্ষ ১০%"],
              ["--cool-1", "Top 20%", "শীর্ষ ২০%"],
            ].map(([tok, en, b]) => (
              <span key={tok} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: `var(${tok})` }} />
                <T en={en} bn={b} />
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-3.5 rounded-sm border-2" style={{ borderColor: "var(--warm-3)" }} />
              {regionName}
            </span>
            <span className="text-ink-3">
              <T en="Numbers = the closest twins, each in a different place." bn="সংখ্যা = সবচেয়ে কাছের যমজ, প্রতিটি আলাদা জায়গায়।" />
            </span>
          </div>
        </div>

        {/* ── Twin list ── */}
        <ol className="flex flex-col gap-2" aria-label={bn ? "যমজ স্থান" : "Twin places"}>
          {region.twins.map((t, n) => {
            const b = twinBlocks[t.id];
            if (!b) return null;
            const on = t.id === activeId;
            const severe = TYPES.reduce((s, k) => s + b.counts[k].severe, 0);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(t.id)}
                  className={`${CONTROL.transition} ${CONTROL.focusRing} flex w-full items-start gap-3 rounded-2xl border p-3 text-left ${
                    on ? "border-ink bg-card shadow-soft" : "border-line bg-card hover:border-ink-3"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-semibold ${on ? "bg-ink text-card" : "text-ink"}`}
                  >
                    {n + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{b.name}</span>
                    <span className="block text-xs text-ink-3">
                      <T
                        en={`Match #${t.rank} of ${mapBlocks.length} land blocks · ${severe} severe events recorded`}
                        bn={`${bnNum(mapBlocks.length)}টি স্থলখণ্ডের মধ্যে মিলে #${bnNum(t.rank)} · ${bnNum(severe)}টি গুরুতর ঘটনা নথিভুক্ত`}
                      />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {twin && twinMeta && (
        <section aria-live="polite" className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-soft sm:p-6">
          <h3 className="text-xl font-semibold tracking-tight text-ink">
            {regionName} <span className="text-ink-3">↔</span> {twin.name}
          </h3>
          <p className="mt-1 text-sm text-ink-3">
            <T
              en={`Twin block ${twin.bbox[0]}° to ${twin.bbox[1]}° latitude, ${twin.bbox[2]}° to ${twin.bbox[3]}° longitude · rainy season ${twin.wetMonths.map((m) => MONTHS[m - 1]).join("–")} (South Asia region: ${region.wetMonths.map((m) => MONTHS[m - 1]).join("–")})`}
              bn={`যমজ ব্লক অক্ষাংশ ${bnNum(twin.bbox[0])}° থেকে ${bnNum(twin.bbox[1])}°, দ্রাঘিমাংশ ${bnNum(twin.bbox[2])}° থেকে ${bnNum(twin.bbox[3])}° · বর্ষা মৌসুম মাস ${twin.wetMonths.map((m) => bnNum(m)).join("–")} (দক্ষিণ এশিয়ার অঞ্চল: ${region.wetMonths.map((m) => bnNum(m)).join("–")})`}
            />
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            {/* Fingerprint side by side */}
            <div>
              <h4 className="text-sm font-semibold text-ink">
                <T en="Trend fingerprint, 1981–2025" bn="প্রবণতার ছাপ, ১৯৮১–২০২৫" />
              </h4>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink-3">
                      <th scope="col" className="py-2 pr-2 font-medium">
                        <T en="Feature" bn="বৈশিষ্ট্য" />
                      </th>
                      <th scope="col" className="py-2 pr-2 text-right font-medium">
                        {regionName}
                      </th>
                      <th scope="col" className="py-2 pr-2 text-right font-medium">
                        <T en="Twin" bn="যমজ" />
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        <T en="Match" bn="মিল" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {KEYS.map((k) => {
                      const w = matchWord(twinMeta.gap[k]);
                      return (
                        <tr key={k} className="border-b border-line last:border-0">
                          <th scope="row" className="py-2 pr-2 text-left font-normal text-ink-2">
                            {bn ? FEATURE_WORDS[k].bn : FEATURE_WORDS[k].en}
                            <span className="block text-xs text-ink-3">{bn ? FEATURE_WORDS[k].unitBn : FEATURE_WORDS[k].unit}</span>
                          </th>
                          <Val v={featureValue(k, region.features[k])} clear={sig(region, k)} trendRow={TRENDS.has(k)} bn={bn} />
                          <Val v={featureValue(k, twin.features[k])} clear={sig(twin, k)} trendRow={TRENDS.has(k)} bn={bn} />
                          <td className={`py-2 text-right text-xs font-medium ${w.tone}`}>
                            <T en={w.en} bn={w.bn} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-ink-3">
                <T
                  en="● = statistically significant trend (Mann–Kendall, p < 0.05). Trend values without ● could be natural ups and downs."
                  bn="● = পরিসংখ্যানগতভাবে তাৎপর্যপূর্ণ প্রবণতা (ম্যান–কেন্ডাল, p < ০.০৫)। ● ছাড়া প্রবণতার মান স্বাভাবিক ওঠানামাও হতে পারে।"
                />
              </p>
            </div>

            {/* Rain records side by side */}
            <div>
              <h4 className="text-sm font-semibold text-ink">
                <T en="Yearly rain, as % of each place's 1981–2010 average" bn="বার্ষিক বৃষ্টি, প্রতিটি জায়গার ১৯৮১–২০১০ গড়ের % হিসেবে" />
              </h4>
              <RainIndexChart
                years={years}
                a={series[region.id]?.rain ?? []}
                b={series[twin.id]?.rain ?? []}
                aLabel={regionName}
                bLabel={twin.name}
              />
            </div>
          </div>

          {/* Disasters */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-ink">
              <T
                en={`Disasters recorded, ${eventYears[0]}–${eventYears[1]}`}
                bn={`নথিভুক্ত দুর্যোগ, ${bnNum(eventYears[0])}–${bnNum(eventYears[1])}`}
              />
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPES.map((k) => (
                <div key={k} className="rounded-xl border border-line p-3">
                  <p className="text-xs text-ink-3">
                    <T en={EVENT_WORDS[k].en} bn={EVENT_WORDS[k].bn} />
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    <span className="text-lg font-semibold tabular-nums">{num(twin.counts[k].severe)}</span>{" "}
                    <span className="text-ink-3">
                      <T en="severe in twin" bn="গুরুতর যমজে" />
                    </span>
                  </p>
                  <p className="text-xs tabular-nums text-ink-3">
                    <T
                      en={`${region.counts[k].severe} severe in ${region.name}`}
                      bn={`${regionName}-এ ${bnNum(region.counts[k].severe)}টি গুরুতর`}
                    />
                  </p>
                </div>
              ))}
            </div>
            <Outcome region={region} twin={twin} regionName={regionName} />
            {twin.notable.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {twin.notable.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.alert === "Red" ? "bg-alert" : "bg-watch"}`}
                      aria-hidden
                    />
                    <span className="text-ink-2">
                      <span className="tabular-nums text-ink-3">{e.date}</span> · <T en={EVENT_WORDS[e.type].en.slice(0, -1)} bn={EVENT_WORDS[e.type].bn} />
                      {" · "}
                      {e.title}
                      {e.deaths ? (
                        <span className="text-ink-3">
                          {" "}
                          <T en={`(${e.deaths} deaths)`} bn={`(${bnNum(e.deaths)} জনের মৃত্যু)`} />
                        </span>
                      ) : null}
                      <span className="sr-only">{e.alert === "Red" ? " (red alert)" : " (orange alert)"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Val({ v, clear, trendRow, bn }: { v: string; clear: boolean; trendRow: boolean; bn: boolean }) {
  return (
    <td className={`py-2 pr-2 text-right tabular-nums ${trendRow && !clear ? "text-ink-3" : "font-semibold text-ink"}`}>
      {clear && (
        <span aria-hidden className="mr-1 text-accent">
          ●
        </span>
      )}
      {bn ? bnNum(v) : v}
      {trendRow && <span className="sr-only">{clear ? " (significant)" : " (not significant)"}</span>}
    </td>
  );
}

/** What the two disaster records together suggest, worded carefully: shared trend, not shared fate. */
function Outcome({ region, twin, regionName }: { region: Region; twin: Block; regionName: string }) {
  const r = TYPES.reduce((s, k) => s + region.counts[k].severe, 0);
  const t = TYPES.reduce((s, k) => s + twin.counts[k].severe, 0);
  let en: string;
  let bn: string;
  if (t === 0 && r > 0) {
    en = `Same trend, no severe events recorded in the twin. What differs is terrain, rivers, how many people live in harm's way, and how well events are reported: a trend alone does not decide the damage.`;
    bn = `একই প্রবণতা, কিন্তু যমজে কোনো গুরুতর ঘটনা নথিভুক্ত নেই। পার্থক্য ভূপ্রকৃতি, নদী, কত মানুষ ঝুঁকিতে থাকে আর ঘটনা কতটা নথিভুক্ত হয় তাতে: প্রবণতা একা ক্ষতি ঠিক করে না।`;
  } else if (t < r / 2) {
    en = `The twin recorded far fewer severe events (${t} vs ${r}) under a similar trend. Exposure and preparedness matter as much as the climate signal.`;
    bn = `একই রকম প্রবণতায় যমজে অনেক কম গুরুতর ঘটনা (${bnNum(t)} বনাম ${bnNum(r)})। জলবায়ু সংকেতের মতোই গুরুত্বপূর্ণ ঝুঁকিতে থাকা মানুষ ও প্রস্তুতি।`;
  } else if (t > r * 2) {
    en = `The twin recorded more severe events (${t} vs ${r}) under a similar trend: a view of what this kind of change has come with elsewhere, and of lessons ${regionName} can borrow.`;
    bn = `একই রকম প্রবণতায় যমজে বেশি গুরুতর ঘটনা (${bnNum(t)} বনাম ${bnNum(r)}): অন্য জায়গায় এমন পরিবর্তনের সাথে কী এসেছে, আর ${regionName} কী শিখতে পারে তার একটি দৃশ্য।`;
  } else {
    en = `Both places recorded a similar number of severe events (${t} vs ${r}) under a similar trend.`;
    bn = `একই রকম প্রবণতায় দুই জায়গায় প্রায় সমান গুরুতর ঘটনা (${bnNum(t)} বনাম ${bnNum(r)})।`;
  }
  return (
    <p className="mt-3 rounded-lg border-l-2 border-accent bg-accent-soft px-3 py-2 text-sm leading-relaxed text-ink">
      <T en={en} bn={bn} />
    </p>
  );
}

/** Two yearly rain records as % of their own 1981–2010 mean, so a wet and a dry place compare fairly. */
function RainIndexChart({ years, a, b, aLabel, bLabel }: { years: [number, number]; a: number[]; b: number[]; aLabel: string; bLabel: string }) {
  const W = 480;
  const H = 220;
  const P = { t: 12, r: 12, b: 24, l: 40 };
  const idx = (s: number[]) => {
    const base = s.slice(0, 30);
    const m = base.reduce((x, y) => x + y, 0) / (base.length || 1);
    return s.map((v) => (m > 0 ? (v / m) * 100 : 0));
  };
  const A = idx(a);
  const B = idx(b);
  const all = [...A, ...B];
  if (all.length === 0) return null;
  const lo = Math.min(60, Math.floor(Math.min(...all) / 10) * 10);
  const hi = Math.max(140, Math.ceil(Math.max(...all) / 10) * 10);
  const n = Math.max(A.length, B.length);
  const x = (k: number) => P.l + (k / (n - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const path = (s: number[]) => s.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = [lo, 100, hi];
  const yearTicks = [1990, 2000, 2010, 2020].filter((t) => t >= years[0] && t <= years[1]);
  return (
    <figure className="m-0 mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${aLabel} and ${bLabel}: yearly rain as percent of the 1981–2010 average`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 100 ? undefined : "3 3"} />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
              {t}%
            </text>
          </g>
        ))}
        {yearTicks.map((t) => (
          <text key={t} x={x(t - years[0])} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
            {t}
          </text>
        ))}
        <path d={path(A)} fill="none" stroke="var(--warm-3)" strokeWidth="2" />
        <path d={path(B)} fill="none" stroke="var(--cool-3)" strokeWidth="2" strokeDasharray="5 3" />
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4" style={{ background: "var(--warm-3)" }} />
          {aLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--cool-3)" }} />
          {bLabel}
        </span>
      </figcaption>
    </figure>
  );
}
