"use client";

import { ArrowDown, ArrowRight, ChartLineUp, CloudRain, Fire, Mountains } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { T } from "@/lib/i18n";
import { HAZARD_META, type HazardZone } from "@/lib/hazards";
import { formatSigned, senIntercept, type TrendGrid, type Zone } from "@/lib/trends";

const CHART = { width: 720, height: 260, left: 42, right: 14, top: 18, bottom: 34 };

type Point = { x: number; y: number };

function plotPoints(values: number[], min: number, max: number): Point[] {
  const width = CHART.width - CHART.left - CHART.right;
  const height = CHART.height - CHART.top - CHART.bottom;
  return values.map((value, index) => ({
    x: CHART.left + (index / Math.max(1, values.length - 1)) * width,
    y: CHART.top + ((max - value) / (max - min)) * height,
  }));
}

function linePath(points: Point[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function rainfallCounts(grid: TrendGrid) {
  return grid.slopePerDecade.reduce(
    (counts, slope, index) => {
      if (slope === null) return counts;
      if (grid.significant[index] === 1 && slope > 0) counts.wetter += 1;
      else if (grid.significant[index] === 1 && slope < 0) counts.drier += 1;
      else counts.unclear += 1;
      return counts;
    },
    { wetter: 0, drier: 0, unclear: 0, total: 0 },
  );
}

function rainfallSummary(grid: TrendGrid) {
  const counts = rainfallCounts(grid);
  return { ...counts, total: counts.wetter + counts.drier + counts.unclear };
}

const HAZARD_ICONS = { wildfire: Fire, landslide: Mountains, flood: CloudRain, cyclone: CloudRain } as const;

export default function EvidenceStory({ zones, rainfallGrid, hazardZones, warmingCells, first, last }: { zones: Zone[]; rainfallGrid: TrendGrid; hazardZones: HazardZone[]; warmingCells: number; first: number; last: number }) {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const study = zones.find((zone) => zone.id === "study-area");
  const temp = study?.results.temperature_annual;
  const values = temp?.series.filter((value): value is number => value !== null) ?? [];
  const trend = temp?.trend;
  const counts = rainfallSummary(rainfallGrid);
  const examples = ["indus-plain", "bengal-delta"].map((id) => zones.find((zone) => zone.id === id)).filter((zone): zone is Zone => Boolean(zone));
  const impactIds = ["indus-plain", "western-himalaya", "central-india-forests"];
  const impacts = impactIds.map((id) => hazardZones.find((zone) => zone.id === id)).filter((zone): zone is HazardZone => Boolean(zone));

  if (!temp || !trend || values.length < 2) return null;

  const slopePerYear = trend.slopePerDecade / 10;
  const trendStart = senIntercept(values, slopePerYear);
  const trendValues = values.map((_, index) => trendStart + slopePerYear * index);
  const min = Math.min(...values, ...trendValues) - 0.18;
  const max = Math.max(...values, ...trendValues) + 0.18;
  const points = plotPoints(values, min, max);
  const trendPoints = plotPoints(trendValues, min, max);
  const warming = trend.slopePerDecade * (last - first) / 10;
  const hoveredValue = hoveredYear === null ? null : values[hoveredYear];

  return (
    <>
      <section className="py-20 md:py-28" aria-labelledby="signal-hdg">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="signal-hdg" className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            <T en="45 years of Earth data reveal signals we normally cannot see." bn="পৃথিবীর ৪৫ বছরের তথ্য এমন সংকেত প্রকাশ করে যা আমরা সাধারণত দেখতে পাই না।" />
          </h2>
          <p className="mt-4 text-lg text-ink-2"><T en="What changed — and why it matters." bn="কী বদলেছে — এবং কেন তা গুরুত্বপূর্ণ।" /></p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
          {[
            ["NASA Data", "45 years of Earth observations", "নাসা ডেটা", "পৃথিবীর ৪৫ বছরের পর্যবেক্ষণ", "planet"],
            ["Long-term Trends", "See what changed and where", "দীর্ঘমেয়াদি প্রবণতা", "কী বদলেছে ও কোথায় দেখুন", "chart"],
            ["Hazard Signals", "Connect change with past events", "বিপদ সংকেত", "পরিবর্তনকে অতীত ঘটনার সাথে মিলান", "warning"],
            ["Preparedness", "Turn signals into useful context", "প্রস্তুতি", "সংকেতকে দরকারি প্রেক্ষাপটে দেখুন", "book"],
          ].map(([en, sub, bn, subBn, key], index, items) => (
            <div key={key} className="relative flex flex-col items-center text-center">
              {index < items.length - 1 && <ArrowRight size={18} className="absolute -right-5 top-3.5 hidden text-ink-3 lg:block" aria-hidden />}
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent ring-4 ring-page">
                {key === "planet" ? <span aria-hidden>◌</span> : key === "chart" ? <ChartLineUp size={22} aria-hidden /> : key === "warning" ? <span aria-hidden>!</span> : <span aria-hidden>▣</span>}
              </div>
              <div className="mt-3 font-semibold text-ink"><T en={en} bn={bn} /></div>
              <p className="mt-1 text-sm leading-snug text-ink-2"><T en={sub} bn={subBn} /></p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-24" aria-labelledby="evidence-heading">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent"><T en="What changed?" bn="কী বদলেছে?" /></p>
          <h2 id="evidence-heading" className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl"><T en="The evidence is not one number." bn="প্রমাণ শুধু একটি সংখ্যা নয়।" /></h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
          <article className="rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-3"><T en="Temperature" bn="তাপমাত্রা" /></p>
                <h3 className="mt-2 text-xl font-semibold text-ink"><T en="Is South Asia getting hotter?" bn="দক্ষিণ এশিয়া কি উষ্ণ হচ্ছে?" /></h3>
              </div>
              <span className="text-right text-3xl font-semibold tabular-nums text-[var(--warm-3)]">{formatSigned(warming, 1)}°C<span className="block text-xs font-medium text-ink-2">since {first}</span></span>
            </div>
            <div className="relative mt-6 overflow-hidden rounded-2xl bg-sunken/60 p-2">
              <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="block h-auto w-full" role="img" aria-label="Annual South Asia temperature trend from 1981 to 2025">
                {[0, 0.5, 1, 1.5].map((tick) => {
                  if (tick < min || tick > max) return null;
                  const y = plotPoints([tick], min, max)[0].y;
                  return <g key={tick}><line x1={CHART.left} x2={CHART.width - CHART.right} y1={y} y2={y} stroke="var(--line)" /><text x={CHART.left - 8} y={y + 4} textAnchor="end" fill="var(--ink-3)" fontSize="12">{tick}</text></g>;
                })}
                <path d={linePath(trendPoints)} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeDasharray="8 7" />
                <path d={linePath(points)} fill="none" stroke="var(--warm-3)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={hoveredYear === index ? 5 : 2.5} fill={hoveredYear === index ? "var(--accent)" : "var(--warm-3)"} onMouseEnter={() => setHoveredYear(index)} onFocus={() => setHoveredYear(index)} tabIndex={0} />)}
                {[first, 1990, 2000, 2010, 2020, last].map((year) => { const index = Math.min(values.length - 1, Math.max(0, year - first)); return <text key={year} x={points[index].x} y={CHART.height - 10} textAnchor="middle" fill="var(--ink-3)" fontSize="12">{year}</text>; })}
                {hoveredYear !== null && <line x1={points[hoveredYear].x} x2={points[hoveredYear].x} y1={CHART.top} y2={CHART.height - CHART.bottom} stroke="var(--accent)" strokeDasharray="3 4" />}
              </svg>
              {hoveredYear !== null && <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink shadow-soft"><strong>{first + hoveredYear}</strong><span className="ml-2 text-ink-2">{formatSigned(hoveredValue ?? 0, 2)}°C</span></div>}
            </div>
            <p className="mt-5 leading-relaxed text-ink-2"><T en={`The year-to-year temperature moves up and down, but the long-term direction is clear: South Asia is getting warmer. Every area we analyzed warmed (${warmingCells} of ${warmingCells}).`} bn={`বছরভেদে তাপমাত্রা ওঠানামা করে, কিন্তু দীর্ঘমেয়াদি দিক স্পষ্ট: দক্ষিণ এশিয়া উষ্ণ হচ্ছে। আমরা যে প্রতিটি এলাকা বিশ্লেষণ করেছি, সবগুলোই উষ্ণ হয়েছে।`} /></p>
            <Link href="/trends?var=temperature&season=annual&zone=study-area" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"><T en="Explore climate trends" bn="জলবায়ুর প্রবণতা দেখুন" /><ArrowRight size={15} aria-hidden /></Link>
          </article>

          <article className="rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-3"><T en="Rainfall" bn="বৃষ্টিপাত" /></p>
            <h3 className="mt-2 text-xl font-semibold text-ink"><T en="Is rainfall changing the same way everywhere?" bn="সব জায়গায় কি বৃষ্টির পরিবর্তন একই?" /></h3>
            <div className="mt-7 space-y-4">
              <RainBar label="Getting wetter" count={counts.wetter} total={counts.total} color="var(--cool-3)" />
              <RainBar label="Getting drier" count={counts.drier} total={counts.total} color="var(--warm-3)" />
              <RainBar label="No clear trend" count={counts.unclear} total={counts.total} color="var(--mid)" />
            </div>
            <div className="mt-7 space-y-3 border-t border-line pt-5 text-sm">
              {examples.map((zone) => <RainExample key={zone.id} zone={zone} />)}
            </div>
            <p className="mt-5 leading-relaxed text-ink-2"><T en="Rainfall is not changing uniformly — some places are getting wetter while others are getting drier." bn="বৃষ্টিপাত একইভাবে বদলাচ্ছে না — কিছু জায়গায় বৃষ্টি বাড়ছে, অন্য জায়গায় কমছে।" /></p>
            <Link href="/trends?var=rainfall&season=monsoon" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"><T en="See where rainfall is changing" bn="বৃষ্টি কোথায় বদলাচ্ছে দেখুন" /><ArrowRight size={15} aria-hidden /></Link>
          </article>
        </div>

        <article className="mt-5 rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-3"><T en="Why it matters" bn="কেন গুরুত্বপূর্ণ" /></p>
              <h3 className="mt-2 text-xl font-semibold text-ink"><T en="Different signals can mean different local concerns." bn="ভিন্ন সংকেত ভিন্ন স্থানীয় উদ্বেগ বোঝাতে পারে।" /></h3>
            </div>
            <span className="rounded-full bg-sunken px-3 py-1.5 text-xs font-medium text-ink-2"><T en="Preparedness signal — not a prediction" bn="প্রস্তুতির সংকেত — পূর্বাভাস নয়" /></span>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {impacts.map((zone) => <ImpactSignal key={zone.id} zone={zone} />)}
          </div>
          <p className="mt-6 max-w-3xl leading-relaxed text-ink-2"><T en="These changes do not predict disasters, but they can show where preparedness deserves attention." bn="এই পরিবর্তন দুর্যোগের পূর্বাভাস দেয় না, তবে কোথায় প্রস্তুতিতে মনোযোগ দেওয়া দরকার তা দেখাতে পারে।" /></p>
          <Link href="/hazards" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"><T en="Explore disaster risk" bn="দুর্যোগের ঝুঁকি দেখুন" /><ArrowRight size={15} aria-hidden /></Link>
        </article>
      </section>
    </>
  );
}

function RainBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  return <div><div className="flex justify-between gap-3 text-sm"><span className="text-ink-2">{label}</span><strong className="tabular-nums text-ink">{count}</strong></div><div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full" style={{ width: `${total ? (count / total) * 100 : 0}%`, background: color }} /></div></div>;
}

function RainExample({ zone }: { zone: Zone }) {
  const rain = zone.results.rainfall_monsoon;
  const value = rain.trend && rain.mean ? (rain.trend.slopePerDecade / rain.mean) * 100 : 0;
  const wetter = value > 0;
  return <Link href={`/trends?var=rainfall&season=monsoon&zone=${zone.id}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-sunken"><span className="font-medium text-ink">{zone.name}</span><span className={wetter ? "text-[var(--cool-4)]" : "text-[var(--warm-4)]"}>{wetter ? "↑ Wetter" : "↓ Drier"} <span className="text-ink-3">{formatSigned(value, 0)}%</span></span></Link>;
}

function ImpactSignal({ zone }: { zone: HazardZone }) {
  const driver = zone.drivers.find((item) => item.linked) ?? zone.drivers[0];
  const Icon = HAZARD_ICONS[zone.hazard];
  return <div className="rounded-2xl bg-sunken/65 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-ink"><Icon size={18} className="text-accent" aria-hidden />{zone.name}</div><p className="mt-3 text-sm text-ink-2">{driver?.label ?? "Environmental conditions"}</p><div className="mt-2 flex items-center gap-2 text-sm font-medium text-[var(--warm-4)]"><ArrowDown size={15} aria-hidden />{HAZARD_META[zone.hazard].label} concern</div></div>;
}
