// Types and helpers for the precomputed trend results in public/data/trends/
// (produced by analysis/build.py from NASA GISTEMP temperature and GPCP rainfall).

export type VariableId = "temperature" | "rainfall";
export type SeasonId = "annual" | "pre-monsoon" | "monsoon";

export interface TrendSummary {
  slopePerDecade: number;
  lowerPerDecade: number;
  upperPerDecade: number;
  p: number;
}

export interface GridSpec {
  lat0: number;
  dLat: number;
  nLat: number;
  lon0: number;
  dLon: number;
  nLon: number;
}

export interface VariableMeta {
  label: string;
  dataset: string;
  datasetUrl: string;
  unit: string;
  decimals: number;
  increase: string;
  decrease: string;
  aggregate: "mean" | "total";
  /** Temperature is stored as anomalies relative to `baseline`. */
  anomaly: boolean;
  baseline: string | null;
}

export interface Manifest {
  generated: string;
  method: { test: string; slope: string; multipleTesting: string };
  years: number[];
  grids: Record<VariableId, GridSpec>;
  variables: Record<VariableId, VariableMeta>;
  seasons: Record<SeasonId, { label: string; months: number[] }>;
  summaries: Record<
    string,
    { cells: number; significantIncrease: number; significantDecrease: number; medianSlopePerDecade: number }
  >;
}

/** Per-cell results, flattened row-major (latitude ascending, then longitude). null = sea / no data. */
export interface TrendGrid {
  slopePerDecade: (number | null)[];
  lowerPerDecade: (number | null)[];
  upperPerDecade: (number | null)[];
  p: (number | null)[];
  significant: (0 | 1)[];
  mean: (number | null)[];
}

export type SeriesGrid = ((number | null)[] | null)[];

export interface Zone {
  id: string;
  name: string;
  hazard: "flood" | "landslide" | "wildfire" | null;
  bbox: [number, number, number, number];
  description: string;
  landCells: number;
  results: Record<string, { series: (number | null)[]; mean: number; trend: TrendSummary | null }>;
}

export const VARIABLE_ORDER: VariableId[] = ["temperature", "rainfall"];
export const SEASON_ORDER: SeasonId[] = ["annual", "pre-monsoon", "monsoon"];

export const resultKey = (v: VariableId, s: SeasonId) => `${v}_${s}`;

/** Single-location significance level; map-wide significance uses the FDR flag instead. */
export const ALPHA = 0.05;

export function cellAt(grid: GridSpec, lat: number, lon: number): { i: number; j: number } | null {
  const i = Math.round((lat - grid.lat0) / grid.dLat);
  const j = Math.round((lon - grid.lon0) / grid.dLon);
  if (i < 0 || j < 0 || i >= grid.nLat || j >= grid.nLon) return null;
  return { i, j };
}

export const cellCenter = (grid: GridSpec, i: number, j: number) => ({
  lat: grid.lat0 + i * grid.dLat,
  lon: grid.lon0 + j * grid.dLon,
});

// Diverging scale on the dark surface: a gray midpoint for "no change", growing
// brighter and more saturated toward each pole.
const MID: [number, number, number] = [56, 56, 53];
const BLUE_ARM: [number, number, number][] = [MID, [28, 92, 171], [57, 135, 229], [134, 182, 239]];
const RED_ARM: [number, number, number][] = [MID, [163, 45, 45], [227, 73, 72], [242, 160, 160]];

function sampleArm(arm: [number, number, number][], t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (arm.length - 1);
  const k = Math.min(arm.length - 2, Math.floor(x));
  const f = x - k;
  return [0, 1, 2].map((c) => Math.round(arm[k][c] + (arm[k + 1][c] - arm[k][c]) * f)) as [number, number, number];
}

/** Warming is red; for rainfall, drying is red and wetting is blue. */
export const increaseIsRed = (v: VariableId) => v === "temperature";

export function divergingColor(value: number, maxAbs: number, variable: VariableId): [number, number, number] {
  const t = Math.abs(value) / maxAbs;
  const redSide = value > 0 === increaseIsRed(variable);
  return sampleArm(redSide ? RED_ARM : BLUE_ARM, t);
}

export function divergingGradient(variable: VariableId): string {
  const neg = increaseIsRed(variable) ? BLUE_ARM : RED_ARM;
  const pos = increaseIsRed(variable) ? RED_ARM : BLUE_ARM;
  const stops = [...[...neg].reverse(), ...pos.slice(1)].map(
    (c, i, all) => `rgb(${c.join(",")}) ${((i / (all.length - 1)) * 100).toFixed(1)}%`,
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/** A round colour-scale limit: the 95th percentile of |trend|, so a few extremes don't wash out the map. */
export function colorLimit(values: (number | null)[]): number {
  const abs = values.filter((v): v is number => v !== null).map(Math.abs).sort((a, b) => a - b);
  if (abs.length === 0) return 1;
  const p95 = abs[Math.floor(abs.length * 0.95)] || abs[abs.length - 1] || 1;
  const mag = 10 ** Math.floor(Math.log10(p95));
  const nice = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * mag >= p95) ?? 10;
  return nice * mag;
}

export function formatSigned(value: number, decimals: number): string {
  const s = value.toFixed(decimals);
  return value > 0 ? `+${s}` : s.replace(/^-0(\.0+)?$/, "0$1");
}

export function formatP(p: number): string {
  if (p < 0.001) return "p < 0.001";
  return `p = ${p.toFixed(p < 0.01 ? 3 : 2)}`;
}

/** Sen's intercept: median of y - slope * x, so the trend line passes through the data. */
export function senIntercept(series: number[], slopePerYear: number): number {
  const r = series.map((y, x) => y - slopePerYear * x).sort((a, b) => a - b);
  const m = Math.floor(r.length / 2);
  return r.length % 2 ? r[m] : (r[m - 1] + r[m]) / 2;
}

export interface Verdict {
  headline: string;
  tone: "increase" | "decrease" | "none";
  explanation: string;
}

export function verdict(trend: TrendSummary, meta: VariableMeta, years: number[]): Verdict {
  const span = `${years[0]}–${years[years.length - 1]}`;
  if (trend.p >= ALPHA) {
    return {
      headline: "No statistically detectable trend",
      tone: "none",
      explanation: `Over ${span} the year-to-year ups and downs are too large to separate a real trend from natural variability (${formatP(
        trend.p,
      )}, needs p < ${ALPHA}). This does not prove nothing is changing, only that this record can't show it with confidence.`,
    };
  }
  const up = trend.slopePerDecade > 0;
  return {
    headline: `Significant ${up ? meta.increase : meta.decrease}`,
    tone: up ? "increase" : "decrease",
    explanation: `A trend this consistent is unlikely to come from chance year-to-year variation (${formatP(
      trend.p,
    )}, autocorrelation-corrected Mann-Kendall test).`,
  };
}
