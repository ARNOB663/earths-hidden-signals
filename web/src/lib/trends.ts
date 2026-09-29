// Types and helpers for the precomputed trend results in public/data/trends/
// (produced by analysis/build.py from NASA GISTEMP temperature and GPCP rainfall).

export type VariableId = "temperature" | "rainfall" | "hot-months" | "heavy-rain" | "wettest-day" | "dry-spell";
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
  /** "average" = seasonal mean/total; "extreme" = a count or maximum, whole year only. */
  kind?: "average" | "extreme";
  definition?: string;
  /** Years and seasons available for this variable (defaults: the manifest's years, all seasons). */
  years?: number[];
  seasons?: SeasonId[];
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

/** Our trend and the same trend from CRU TS, per region and result key. */
export interface Crosscheck {
  dataset: string;
  zones: Record<string, Record<string, { ours: TrendSummary | null; cru: TrendSummary | null }>>;
}

export type Agreement = "agree" | "partly" | "disagree";

/** Do two records tell the same story? Same direction and both clear (or both unclear) = agree. */
export function agreement(a: TrendSummary, b: TrendSummary): Agreement {
  const clearA = a.p < ALPHA;
  const clearB = b.p < ALPHA;
  const same = Math.sign(a.slopePerDecade) === Math.sign(b.slopePerDecade);
  if (clearA && clearB) return same ? "agree" : "disagree";
  if (!clearA && !clearB) return "agree";
  return "partly";
}

export const AGREEMENT_TEXT: Record<Agreement, string> = {
  agree: "An independent record agrees",
  partly: "An independent record only partly agrees",
  disagree: "An independent record disagrees",
};

export interface Zone {
  id: string;
  name: string;
  hazard: "flood" | "landslide" | "wildfire" | null;
  bbox: [number, number, number, number];
  description: string;
  landCells: number;
  results: Record<string, { series: (number | null)[]; mean: number; trend: TrendSummary | null }>;
}

export const VARIABLE_ORDER: VariableId[] = [
  "temperature",
  "rainfall",
  "hot-months",
  "heavy-rain",
  "wettest-day",
  "dry-spell",
];
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

/** Warming is shown warm (red); for rainfall, drying is red and wetting is blue. */
// Red marks the direction that means more heat or more drought.
export const increaseIsRed = (v: VariableId) => v === "temperature" || v === "hot-months" || v === "dry-spell";

/**
 * Colour token for a trend value: a neutral middle for "about no change", then four
 * steps toward each side. Steps are CSS variables, so maps and charts follow the theme.
 */
export function trendToken(value: number, limit: number, variable: VariableId): string {
  const t = Math.min(1, Math.abs(value) / limit);
  const step = t < 0.125 ? 0 : t < 0.375 ? 1 : t < 0.625 ? 2 : t < 0.875 ? 3 : 4;
  if (step === 0) return "--mid";
  const warm = value > 0 === increaseIsRed(variable);
  return `--${warm ? "warm" : "cool"}-${step}`;
}

/** The nine legend steps from "decrease" (left) to "increase" (right). */
export function trendLegendTokens(variable: VariableId): string[] {
  const dec = increaseIsRed(variable) ? "cool" : "warm";
  const inc = increaseIsRed(variable) ? "warm" : "cool";
  return [4, 3, 2, 1].map((k) => `--${dec}-${k}`).concat("--mid", [1, 2, 3, 4].map((k) => `--${inc}-${k}`));
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
  const s = Math.abs(value).toFixed(decimals);
  if (Number(s) === 0) return s;
  return `${value > 0 ? "+" : "−"}${s}`;
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
