// Server-side readers for the precomputed JSON in public/data/ (built by the analysis/ pipeline).

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { HazardZone } from "./hazards";
import type { Crosscheck, Manifest, TrendGrid, Zone } from "./trends";

async function readData<T>(...parts: string[]): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), "public", "data", ...parts), "utf-8")) as T;
}

export const readManifest = () => readData<Manifest>("trends", "manifest.json");
export const readTrendZones = async () => (await readData<{ zones: Zone[] }>("trends", "zones.json")).zones;
export const readHazardZones = async () => (await readData<{ zones: HazardZone[] }>("hazards", "zones.json")).zones;

export interface LatestMonth {
  temperature: { month: string; baseline: string; zones: Record<string, { anomaly: number; rank: number; of: number }> };
  rainfall: {
    month: string;
    baseline: string;
    zones: Record<string, { percentOfNormal: number; mm: number; rank: number; of: number }>;
  };
}

/** Trends repeated with an independent record, CRU TS (analysis/crosscheck.py). */
export const readCrosscheck = () => readData<Crosscheck>("trends", "crosscheck.json");

/** The most recent month compared with normal (analysis/latest.py). */
export const readLatest = () => readData<LatestMonth>("latest.json");

/** Per-cell trend results for one variable and season, e.g. "temperature_annual". */
export const readTrendGrid = (key: string) => readData<TrendGrid>("trends", `${key}.json`);
