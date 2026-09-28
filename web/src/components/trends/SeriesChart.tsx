"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { downloadCsv, slug } from "@/lib/download";
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
  /** 95% range of the trend, drawn as a shaded band around the trend line. */
  lowerPerDecade?: number | null;
  upperPerDecade?: number | null;
  /** Shown in the CSV file name and header, e.g. "Around Dhaka rain, rainy season". */
  title?: string;
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
export function SeriesChart({
  years,
  values,
  slopePerDecade,
  unit,
  decimals,
  axisLabel,
  zeroLine,
  lowerPerDecade = null,
  upperPerDecade = null,
  title,
}: Props) {
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

  if (points.length < 2) return <p className="text-sm text-ink-3">No data for this place.</p>;

  // The 95% range of the slope, pivoting on the middle of the record: a "bow-tie" of likely trend lines.
  const n = values.length;
  const mid = (n - 1) / 2;
  const band =
    trendAt && lowerPerDecade !== null && upperPerDecade !== null
      ? years.map((_, k) => {
          const a = trendAt(mid) + (lowerPerDecade / 10) * (k - mid);
          const b = trendAt(mid) + (upperPerDecade / 10) * (k - mid);
          return [Math.min(a, b), Math.max(a, b)] as const;
        })
      : null;

  const vals = points.map((p) => p.value);
  if (trendAt) vals.push(trendAt(0), trendAt(values.length - 1));
  if (band) vals.push(band[0][0], band[0][1], band[n - 1][0], band[n - 1][1]);
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
  const bandPath = band
    ? `M${band.map(([l], k) => `${x(k).toFixed(1)},${y(l).toFixed(1)}`).join("L")}L${[...band]
        .map(([, u], k) => `${x(k).toFixed(1)},${y(u).toFixed(1)}`)
        .reverse()
        .join("L")}Z`
    : null;

  const download = () =>
    downloadCsv(
      `${slug(title ?? axisLabel)}-${years[0]}-${years[n - 1]}`,
      ["year", `value (${unit})`, `trend line (${unit})`],
      years.map((yr, k) => [yr, values[k], trendAt ? Number(trendAt(k).toFixed(decimals + 2)) : null]),
      `${title ?? axisLabel}. Trend = Sen's slope${slopePerDecade !== null ? ` ${slopePerDecade} ${unit}/decade` : ""}.`,
    );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-ink" /> Each year
        </span>
        {trendAt && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-accent" /> Long-term trend
          </span>
        )}
        {band && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-accent/20" /> Likely range of the trend (95%)
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
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px]">
                {Number(t.toFixed(4))}
              </text>
            </g>
          ))}
          {zeroLine && lo < 0 && hi > 0 && (
            <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--ink-3)" />
          )}
          {xTicks.map((yr) => (
            <text
              key={yr}
              x={x(years.indexOf(yr))}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-ink-3 text-[11px]"
            >
              {yr}
            </text>
          ))}
          <text x={PAD.left} y={10} className="fill-ink-3 text-[11px]">
            {axisLabel}
          </text>

          {bandPath && <path d={bandPath} fill="var(--accent)" opacity={0.14} />}
          <path d={path} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
          {trendAt && (
            <line
              x1={x(0)}
              x2={x(values.length - 1)}
              y1={y(trendAt(0))}
              y2={y(trendAt(values.length - 1))}
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}

          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--ink-3)" />
              {hovered !== null && (
                <circle cx={x(hover)} cy={y(hovered)} r={4.5} fill="var(--ink)" stroke="var(--card)" strokeWidth={2} />
              )}
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-soft"
            style={{
              left: Math.min(Math.max(x(hover) + 10, 0), width - 160),
            }}
          >
            <div className="font-medium text-ink">{years[hover]}</div>
            <div className="text-ink-2">That year: {hovered !== null ? fmt(hovered) : "no data"}</div>
            {trendAt && <div className="text-ink-3">Trend line: {fmt(trendAt(hover))}</div>}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
        >
          <DownloadSimple size={14} /> Download the data (CSV)
        </button>
      </div>
      <details className="mt-1 text-xs text-ink-3">
        <summary className="cursor-pointer select-none hover:text-ink">Show the data as a table</summary>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-sunken text-ink-3">
              <tr>
                <th className="px-2 py-1 font-medium">Year</th>
                <th className="px-2 py-1 font-medium">Value ({unit})</th>
              </tr>
            </thead>
            <tbody>
              {years.map((yr, k) => (
                <tr key={yr} className="odd:bg-sunken/50 text-ink-2">
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
