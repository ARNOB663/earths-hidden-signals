// Server-side reader for the committed signals data. Validates the keys the pages need and throws
// at build time when one is missing — a missing key is a pipeline bug, not a data-age problem.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AccuracyPayload, PlaceExtras, PlacesFile, SignalsConfig, SignalsMeta, SourcesFile, WatchPayload } from "./types";

const ROOT = path.join(process.cwd(), "public", "data", "signals");

function assertKeys<T extends object>(value: T, keys: (keyof T)[], file: string): T {
  for (const key of keys) {
    if (value[key] === undefined || value[key] === null) {
      throw new Error(`signals data: ${file} is missing required key "${String(key)}"`);
    }
  }
  return value;
}

async function readJson<T>(...parts: string[]): Promise<T> {
  const file = path.join(ROOT, ...parts);
  return JSON.parse(await readFile(file, "utf-8")) as T;
}

export async function readSignalsMeta(): Promise<SignalsMeta> {
  return assertKeys(
    await readJson<SignalsMeta>("meta.json"),
    ["sampleData", "basis", "measurementTime", "tiles", "tileLabels"],
    "meta.json",
  );
}

export async function readSignalsConfig(): Promise<SignalsConfig> {
  return assertKeys(
    await readJson<SignalsConfig>("config.json"),
    ["gridDeg", "enabledTiles", "staleHours", "official", "yellow", "red", "doyHalfWindow", "baselineCountMin", "baselineYearsMin"],
    "config.json",
  );
}

export async function readSources(): Promise<SourcesFile> {
  return readJson<SourcesFile>("sources.json");
}

export async function readWatch(): Promise<WatchPayload> {
  const watch = await assertKeys(await readJson<WatchPayload>("watch.json"), ["entries", "rises", "sample"], "watch.json");
  if (!Array.isArray(watch.rises)) throw new Error("signals data: watch.json has no rises array");
  return watch;
}

export async function readAccuracy(): Promise<AccuracyPayload> {
  // Hits/misses/unmatched are deliberately null (not missing) until the replay set is large.
  const accuracy = await assertKeys(await readJson<AccuracyPayload>("accuracy.json"), ["events", "notEnough"], "accuracy.json");
  if (!Array.isArray(accuracy.events)) throw new Error("signals data: accuracy.json has no events array");
  return accuracy;
}

export async function readPlaces(): Promise<PlacesFile> {
  return assertKeys(
    await readJson<PlacesFile>("places.json"),
    ["areas", "levels", "sample", "tiles"],
    "places.json",
  );
}

/** Optional per-place extras (Next outlook, Evidence years). Absent until `place.py --refresh` runs. */
export async function readPlaceExtras(id: string): Promise<PlaceExtras | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    return await readJson<PlaceExtras>("places", `${id}.json`);
  } catch {
    // The refresh step is optional; without it the Next and Evidence strips are omitted.
    return null;
  }
}
