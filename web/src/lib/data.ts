// Server-side readers for the precomputed JSON in public/data/ (built by the analysis/ pipeline).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { countriesFrom, type Country, type PlaceSignals } from "./countries";
import type { FireGrid, FloodEvent, HazardZone, LandslideEvent } from "./hazards";
import type { MapPlaceData } from "./mapPlaces";
import type { Crosscheck, Manifest, TrendGrid, Zone } from "./trends";

const cache = new Map<string, Promise<unknown>>();

/** Reads and parses a file under public/data/, caching it so a page build parses each file once. */
export function readData<T>(...parts: string[]): Promise<T> {
  const file = path.join(process.cwd(), "public", "data", ...parts);
  if (!cache.has(file)) cache.set(file, readFile(file, "utf-8").then((text) => JSON.parse(text) as T));
  return cache.get(file) as Promise<T>;
}

export const readManifest = () => readData<Manifest>("trends", "manifest.json");
export const readTrendZones = async () => (await readData<{ zones: Zone[] }>("trends", "zones.json")).zones;
export const readHazardZones = async () => (await readData<{ zones: HazardZone[] }>("hazards", "zones.json")).zones;
export const readLandslides = () => readData<LandslideEvent[]>("hazards", "landslides.json");
export const readFloods = () => readData<FloodEvent[]>("hazards", "floods.json");
export const readFireGrid = () => readData<FireGrid>("hazards", "fires_grid.json");

/** Area-weighted country series and country polygons (analysis/build_country_signals.py). */
export const readPlaceSignals = () => readData<PlaceSignals>("maps", "place-signals.json");
/** The same file as the map layers read it, with place bounds and geometry. */
export const readMapPlaces = () => readData<MapPlaceData>("maps", "place-signals.json");
export const readCountries = async (): Promise<Country[]> => countriesFrom(await readPlaceSignals());

export interface LatestMonth {
  temperature: { month: string; baseline: string; zones: Record<string, { anomaly: number; rank: number; of: number }> };
  rainfall: {
    month: string;
    baseline: string;
    zones: Record<string, { percentOfNormal: number; mm: number; rank: number; of: number }>;
  };
}

/** The most recent month compared with normal (analysis/latest.py). */
export const readLatest = () => readData<LatestMonth>("latest.json");

/** Trends repeated with an independent record, CRU TS (analysis/crosscheck.py). */
export const readCrosscheck = () => readData<Crosscheck>("trends", "crosscheck.json");

/** Per-cell trend results for one variable and season, e.g. "temperature_annual". */
export const readTrendGrid = (key: string) => readData<TrendGrid>("trends", `${key}.json`);
