"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { senIntercept } from "@/lib/trends";

interface Props {
  years: number[];
  values: (number | null)[];
  slopePerDecade: number | null;
  unit: string;
  decimals: number;
  /** e.g. "°C vs 1951–1980 average" */
  axisLabel: string;
  /** Draw a zero line (anomaly series). */
  zeroLine: boolean;
}

const HEIGHT = 230;
const PAD = { top: 16, right: 12, bottom: 26, left: 44 };

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(360);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Yearly series with its Sen's-slope trend line and a crosshair readout. */
export function SeriesChart({ years, values, slopePerDecade, unit, decimals, axisLabel, zeroLine }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo(
    () => values.map((v, k) => (v === null ? null : { year: years[k], value: v, k })).filter((p) => p !== null),
    [values, years],
  );

  const trendAt = useMemo(() => {
    if (slopePerDecade === null || points.length !== values.length) return null;
    const perYear = slopePerDecade / 10;
    const b = senIntercept(
      points.map((p) => p.value),
      perYear,
    );
    return (k: number) => b + perYear * k;
  }, [slopePerDecade, points, values.length]);

  if (points.length < 2) return <p className="text-sm text-slate-500">No data for this location.</p>;

  const vals = points.map((p) => p.value);
  if (trendAt) vals.push(trendAt(0), trendAt(values.length - 1));
  if (zeroLine) vals.push(0);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const padY = (hi - lo) * 0.08 || 1;
  lo -= padY;
  hi += padY;
  const yTicks = niceTicks(lo, hi);

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (k: number) => PAD.left + (k / (years.length - 1)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
  const path = points.map((p, n) => `${n ? "L" : "M"}${x(p.k).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const xTicks = years.filter((yr) => yr % 10 === 0);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const k = Math.round(((e.clientX - rect.left - PAD.left) / plotW) * (years.length - 1));
    setHover(Math.min(years.length - 1, Math.max(0, k)));
  };

  const hovered = hover !== null ? values[hover] : null;
  const fmt = (v: number) => `${v.toFixed(decimals)} ${unit}`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-slate-200" /> Yearly value
        </span>
        {trendAt && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-sky-400" /> Trend (Sen&apos;s slope)
          </span>
        )}
      </div>
      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          className="block touch-none select-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Yearly ${axisLabel}, ${years[0]} to ${years[years.length - 1]}`}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#ffffff" strokeOpacity={0.07} />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px]">
                {Number(t.toFixed(4))}
              </text>
            </g>
          ))}
          {zeroLine && lo < 0 && hi > 0 && (
            <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="#ffffff" strokeOpacity={0.3} />
          )}
          {xTicks.map((yr) => (
            <text
              key={yr}
              x={x(years.indexOf(yr))}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {yr}
            </text>
          ))}
          <text x={PAD.left} y={10} className="fill-slate-500 text-[10px]">
            {axisLabel}
          </text>

          <path d={path} fill="none" stroke="#e2e8f0" strokeWidth={2} strokeLinejoin="round" />
          {trendAt && (
            <line
              x1={x(0)}
              x2={x(values.length - 1)}
              y1={y(trendAt(0))}
              y2={y(trendAt(values.length - 1))}
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}

          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#ffffff" strokeOpacity={0.35} />
              {hovered !== null && (
                <circle cx={x(hover)} cy={y(hovered)} r={4} fill="#e2e8f0" stroke="#0e141b" strokeWidth={2} />
              )}
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-md bg-[#0b0f14]/95 px-2.5 py-1.5 text-xs ring-1 ring-white/15"
            style={{
              left: Math.min(Math.max(x(hover) + 10, 0), width - 160),
            }}
          >
            <div className="font-medium text-white">{years[hover]}</div>
            <div className="text-slate-300">Value: {hovered !== null ? fmt(hovered) : "no data"}</div>
            {trendAt && <div className="text-slate-400">Trend line: {fmt(trendAt(hover))}</div>}
          </div>
        )}
      </div>

      <details className="mt-2 text-xs text-slate-400">
        <summary className="cursor-pointer select-none hover:text-slate-200">Show data table</summary>
        <div className="mt-2 max-h-48 overflow-y-auto rounded ring-1 ring-white/10">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-[#0e141b] text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Year</th>
                <th className="px-2 py-1 font-medium">Value ({unit})</th>
              </tr>
            </thead>
            <tbody>
              {years.map((yr, k) => (
                <tr key={yr} className="odd:bg-white/[0.02]">
                  <td className="px-2 py-0.5">{yr}</td>
                  <td className="px-2 py-0.5">{values[k] === null ? "—" : values[k]!.toFixed(decimals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
