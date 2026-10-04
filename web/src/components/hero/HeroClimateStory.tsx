"use client";

import { ArrowRight, ChartLineUp, DownloadSimple, Table } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { T } from "@/lib/i18n";
import { formatSigned, senIntercept, type Zone } from "@/lib/trends";

const CHART = { width: 640, height: 280, left: 48, right: 16, top: 28, bottom: 48 };

function pointsFor(values: number[], min: number, max: number) {
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  return values.map((value, index) => ({
    x: CHART.left + (index / Math.max(1, values.length - 1)) * plotWidth,
    y: CHART.top + ((max - value) / (max - min)) * plotHeight,
  }));
}

function pathFrom(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

export default function HeroClimateStory({ zones }: { zones: Zone[] }) {
  const study = zones.find((zone) => zone.id === "study-area");
  const result = study?.results.temperature_annual;
  const values = result?.series.filter((value): value is number => value !== null) ?? [];
  const trend = result?.trend;
  const years = values.length;
  const firstYear = 1981;
  const lastYear = firstYear + Math.max(0, years - 1);
  const [hovered, setHovered] = useState<number | null>(null);

  if (!result || !trend || values.length < 2) return null;

  const slopePerYear = trend.slopePerDecade / 10;
  const intercept = senIntercept(values, slopePerYear);
  const trendValues = values.map((_, index) => intercept + slopePerYear * index);
  const padding = 0.18;
  const min = Math.min(...values, ...trendValues) - padding;
  const max = Math.max(...values, ...trendValues) + padding;
  const points = pointsFor(values, min, max);
  const trendPoints = pointsFor(trendValues, min, max);
  const hoveredValue = hovered === null ? null : values[hovered];
  const warmed = trend.slopePerDecade * (lastYear - firstYear) / 10;
  const yTicks = [0, 0.5, 1, 1.5].filter((tick) => tick >= min && tick <= max);

  return (
    <div className="relative z-10 mt-14 w-full max-w-xl text-white lg:absolute lg:right-10 lg:top-1/2 lg:mt-0 lg:w-[min(37rem,44vw)] lg:-translate-y-1/2 xl:right-14">
      <div className="rounded-3xl border border-white/20 bg-[rgba(8,12,18,0.62)] p-5 shadow-[0_18px_70px_rgba(2,6,23,0.18)] backdrop-blur-md sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
              <T en="45 years of change · 1981–2025" bn="৪৫ বছরের পরিবর্তন · ১৯৮১–২০২৫" />
            </p>
            <h2 className="mt-2 text-xl font-medium leading-tight text-white/95 sm:text-2xl">
              <T en="How much warmer each year was than normal" bn="প্রতি বছর স্বাভাবিকের চেয়ে কতটা উষ্ণ ছিল" />
            </h2>
          </div>
          <ChartLineUp size={21} className="mt-1 shrink-0 text-[#58A6FF]" aria-hidden />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-white/75">
          <span className="inline-flex items-center gap-1.5"><span className="h-px w-4 bg-white/90" /><T en="Each year" bn="প্রতি বছর" /></span>
          <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-[#58A6FF]" /><T en="Long-term trend" bn="দীর্ঘমেয়াদি প্রবণতা" /></span>
          <span className="text-white/70">°C warmer than the long-term average</span>
        </div>

        <div className="relative mt-2 overflow-hidden rounded-2xl bg-black/10">
          <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="block h-auto w-full" role="img" aria-label="Annual South Asia temperature anomalies from 1981 to 2025 with a rising long-term trend">
            {yTicks.map((tick) => {
              const y = pointsFor([tick], min, max)[0].y;
              return (
                <g key={tick}>
                  <line x1={CHART.left} x2={CHART.width - CHART.right} y1={y} y2={y} stroke="rgba(255,255,255,.11)" />
                  <text x={CHART.left - 10} y={y + 4} textAnchor="end" fill="rgba(255,255,255,.62)" fontSize="12">{tick}</text>
                </g>
              );
            })}
            <line x1={CHART.left} x2={CHART.width - CHART.right} y1={CHART.height - CHART.bottom} y2={CHART.height - CHART.bottom} stroke="rgba(255,255,255,.56)" />
            <path d={pathFrom(trendPoints)} fill="none" stroke="#58A6FF" strokeWidth="2.5" strokeDasharray="8 7" />
            <path d={pathFrom(points)} fill="none" stroke="rgba(255,255,255,.92)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={hovered === index ? 5 : 2.5}
                fill={hovered === index ? "var(--accent)" : "rgba(255,255,255,.9)"}
                stroke={hovered === index ? "white" : "none"}
                strokeWidth="1.5"
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                tabIndex={0}
              />
            ))}
            {[firstYear, 1990, 2000, 2010, 2020, lastYear].map((year) => {
              const index = Math.min(years - 1, Math.max(0, year - firstYear));
              return <text key={year} x={points[index].x} y={CHART.height - 16} textAnchor="middle" fill="rgba(255,255,255,.62)" fontSize="12">{year}</text>;
            })}
            {hovered !== null && <line x1={points[hovered].x} x2={points[hovered].x} y1={CHART.top} y2={CHART.height - CHART.bottom} stroke="rgba(80,152,234,.5)" strokeDasharray="3 4" />}
          </svg>
          {hovered !== null && (
            <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-white/15 bg-[rgba(5,7,10,0.92)] px-3 py-2 text-xs text-white shadow-lg">
              <strong>{firstYear + hovered}</strong>
              <span className="ml-2 text-white/85">{formatSigned(hoveredValue ?? 0, 2)}°C</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/70">
          <span className="font-medium text-[#FFC078]">{formatSigned(warmed, 1)}°C warmer since {firstYear}</span>
          <span className="text-white/70">{years} annual observations</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#58A6FF]">
          <span className="inline-flex items-center gap-1"><DownloadSimple size={14} aria-hidden /> Download data</span>
          <span className="inline-flex items-center gap-1"><Table size={14} aria-hidden /> Show as a table</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/85">
          <T en="The year-to-year swings are real, but the long-term direction is clear: South Asia is getting warmer." bn="বছরভেদে ওঠানামা বাস্তব, কিন্তু দীর্ঘমেয়াদি দিক স্পষ্ট: দক্ষিণ এশিয়া উষ্ণ হচ্ছে।" />
        </p>
        <Link href="/trends?var=temperature&season=annual&zone=study-area" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#58A6FF] hover:text-[#8CC4FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8CC4FF]">
          <T en="Explore the full trend" bn="সম্পূর্ণ প্রবণতা দেখুন" />
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
