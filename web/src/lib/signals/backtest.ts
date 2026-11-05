// Server-side reader for the committed backtest (scripts/signals/backtest.py). The Replay and
// Accuracy pages read these exact numbers; nothing is recomputed in TypeScript.

import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "data", "signals");

export interface Metric {
  value: number | null;
  n: number;
  low: number | null;
  high: number | null;
}

export interface Counts {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  tested: number;
}

export interface TestedYear {
  year: number;
  value: number | null;
  event: boolean;
  state: "tested" | "no-value" | "short-baseline";
  reason?: string;
  baselineYears?: number;
  baselineMedian?: number;
  threshold?: number;
  flagged?: boolean;
}

export interface SectionReplay {
  covers: string;
  source: string;
  sourceLabel: string;
  unit: string;
  series: { year: number; value: number | null }[];
  years: TestedYear[];
}

export interface Episode {
  id: string;
  lat: number;
  lon: number;
  start: string;
  end: string;
  alert: string | null;
  events: number;
  section: "pre-monsoon" | "monsoon";
  year: number;
  hit: boolean;
  lead: { issued: string; days: number; section: string } | null;
}

export interface TileReplay {
  tile: string;
  label: string;
  sections: Record<"pre-monsoon" | "monsoon", SectionReplay>;
  episodes: Episode[];
  leads: { days: number; hit: number; episodes: number; detectedShare: number | null }[];
  episodeTotal: number;
}

export interface Screen {
  id: string;
  tile: string;
  tileLabel: string;
  section: "pre-monsoon" | "monsoon";
  counts: Counts;
  details: {
    tp: number;
    fp: number;
    fn: number;
    tn: number;
    tested: number;
    flags: number;
    eventYears: number;
    hitRate: Metric;
    falseAlarmRate: Metric;
    precision: Metric;
    correctRejectionRate: Metric;
    baseRate: { value: number | null; n: number; low: number | null; high: number | null };
    lift: number | null;
    liftInterval: { low: number; high: number } | null;
    liftExcludesOne: boolean | null;
  };
  reliability: { band: string; value: number | null; n: number; low: number | null; high: number | null }[];
}

export interface Backtest {
  schema: string;
  generated: string;
  rule: string;
  window: [number, number];
  sources: { rain: { monsoon: string; "pre-monsoon": string; note: string }; events: string; episodeRule: string };
  episodeRadiusKm: number;
  episodeGapDays: number;
  baselineMinValues: number;
  percentile: number;
  scoringDays: number;
  tiles: { id: string; label: string; south: number; north: number; west: number; east: number }[];
  geometry: { grid: { lat0: number; dLat: number; nLat: number; lon0: number; dLon: number; nLon: number }; cells: Record<string, { label: string; cells: { lat: number; lon: number }[] }> };
  screens: Screen[];
  replay: TileReplay[];
  metrics: Counts & {
    flags: number;
    eventYears: number;
    hitRate: Metric;
    falseAlarmRate: Metric;
    precision: Metric;
    correctRejectionRate: Metric;
    baseRate: { value: number | null; n: number; low: number | null; high: number | null };
    lift: number | null;
    liftInterval: { low: number; high: number } | null;
    liftExcludesOne: boolean | null;
  };
  reliability: { band: string; value: number | null; n: number; low: number | null; high: number | null }[];
  totals: { episodes: number };
}

export interface AccuracyFile {
  schema: string;
  generated: string;
  source: string;
  rule: string;
  window: [number, number];
  metrics: Backtest["metrics"];
  bySection: Record<string, Counts>;
  reliability: Backtest["reliability"];
  totals: { episodes: number; tiles: number; testedYears: number; eventYears: number };
  outlookEligible: { eligible: boolean; checks: { id: string; pass: boolean; text: string }[]; verdict: string };
  missing: string[];
}

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(ROOT, name), "utf-8")) as T;
}

let audit: Promise<Backtest> | null = null;
export function readBacktest(): Promise<Backtest> {
  audit ??= readJson<Backtest>("backtest.json");
  return audit;
}

export function readAccuracyFile(): Promise<AccuracyFile> {
  return readJson<AccuracyFile>("accuracy.json");
}
