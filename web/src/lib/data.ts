// Server-side readers for the precomputed JSON in public/data/ (built by the analysis/ pipeline).

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MapPlaceData } from "./mapPlaces";
import type { Crosscheck, Manifest, Zone } from "./trends";

const cache = new Map<string, Promise<unknown>>();

/** Reads and parses a file under public/data/, caching it so a page build parses each file once. */
export function readData<T>(...parts: string[]): Promise<T> {
  const file = path.join(process.cwd(), "public", "data", ...parts);
  if (!cache.has(file)) cache.set(file, readFile(file, "utf-8").then((text) => JSON.parse(text) as T));
  return cache.get(file) as Promise<T>;
}

export const readManifest = () => readData<Manifest>("trends", "manifest.json");
export const readTrendZones = async () => (await readData<{ zones: Zone[] }>("trends", "zones.json")).zones;

/** Trends repeated with an independent record, CRU TS (analysis/crosscheck.py). */
export const readCrosscheck = () => readData<Crosscheck>("trends", "crosscheck.json");

/** Climate context for map places (built by analysis/build_country_signals.py). */
export const readMapPlaces = () => readData<MapPlaceData>("maps", "place-signals.json");
