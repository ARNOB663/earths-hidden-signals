// Server-side readers for the precomputed JSON in public/data/ (built by the analysis/ pipeline).

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { HazardZone } from "./hazards";
import type { Manifest, TrendGrid, Zone } from "./trends";

async function readData<T>(...parts: string[]): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), "public", "data", ...parts), "utf-8")) as T;
}

export const readManifest = () => readData<Manifest>("trends", "manifest.json");
export const readTrendZones = async () => (await readData<{ zones: Zone[] }>("trends", "zones.json")).zones;
export const readHazardZones = async () => (await readData<{ zones: HazardZone[] }>("hazards", "zones.json")).zones;

/** Per-cell trend results for one variable and season, e.g. "temperature_annual". */
export const readTrendGrid = (key: string) => readData<TrendGrid>("trends", `${key}.json`);
