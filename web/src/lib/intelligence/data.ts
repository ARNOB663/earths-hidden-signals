// Server-side readers for web/public/data/intelligence/. Each reader checks the keys the pages rely
// on and throws during the build if one is missing: a broken dataset fails loudly instead of
// rendering guessed numbers.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  Alerts,
  Current,
  Evaluation,
  History,
  IndexEntry,
  Location,
  Sources,
  Thresholds,
} from "./types";

const DIR = path.join(process.cwd(), "public", "data", "intelligence");
const memo = new Map<string, Promise<unknown>>();

function read<T>(file: string): Promise<T> {
  if (!memo.has(file)) {
    memo.set(
      file,
      readFile(path.join(DIR, file), "utf-8").then((t) => JSON.parse(t) as T),
    );
  }
  return memo.get(file) as Promise<T>;
}

/** Throws if `obj` lacks any of `keys` (empty strings and null count as missing unless allowed). */
export function requireKeys(obj: unknown, keys: string[], where: string, nullable: string[] = []): void {
  if (!obj || typeof obj !== "object") throw new Error(`${where}: not an object`);
  const rec = obj as Record<string, unknown>;
  const missing = keys.filter((k) => !(k in rec) || ((rec[k] === null || rec[k] === "") && !nullable.includes(k)));
  if (missing.length) throw new Error(`${where}: missing ${missing.join(", ")}`);
}

const CONCLUSION_KEYS = ["level", "headline", "situation", "normality", "magnitude", "development", "hazards", "reliability", "actions", "evidenceIds", "thresholdsId"];

function checkLocation(l: Location): Location {
  requireKeys(l, ["id", "kind", "name", "nameBn", "geography", "conclusion", "hazards", "confidences", "validation", "asOf", "thresholdsId"], `location ${l?.id}`);
  requireKeys(l.conclusion, CONCLUSION_KEYS, `conclusion ${l.id}`);
  for (const f of ["headline", "situation", "normality", "magnitude", "development", "reliability"] as const) {
    requireKeys(l.conclusion[f], ["en", "bn"], `conclusion ${l.id}.${f}`);
  }
  requireKeys(l.confidences, ["observation", "anomaly", "hazard", "validation"], `confidences ${l.id}`);
  requireKeys(l.geography, ["kind", "sourceId", "spatialResolution", "coveragePct", "fallback"], `geography ${l.id}`);
  return l;
}

export async function readLocations(): Promise<Location[]> {
  const data = await read<{ schema: string; locations: Location[] }>("locations.json");
  requireKeys(data, ["schema", "locations"], "locations.json");
  return data.locations.map(checkLocation);
}

export async function readLocation(id: string): Promise<Location | undefined> {
  return (await readLocations()).find((l) => l.id === id);
}

export async function readIndex(): Promise<IndexEntry[]> {
  const data = await read<{ locations: IndexEntry[] }>("index.json");
  requireKeys(data, ["locations"], "index.json");
  for (const e of data.locations) requireKeys(e, ["id", "kind", "name", "level", "headline"], `index ${e.id}`);
  return data.locations;
}

export async function readCurrent(): Promise<Current> {
  const data = await read<Current>("current.json");
  requireKeys(data, ["schema", "asOf", "thresholdsId", "baselineId", "indicators", "composites"], "current.json");
  return data;
}

export async function readAlerts(): Promise<Alerts> {
  const data = await read<Alerts>("alerts.json");
  requireKeys(data, ["computed", "reconstructed", "official", "asOf"], "alerts.json");
  return data;
}

export async function readHistory(): Promise<History> {
  const data = await read<History>("history.json");
  requireKeys(data, ["runs", "periods"], "history.json");
  return data;
}

export async function readSources(): Promise<Sources> {
  const data = await read<Sources>("sources.json");
  requireKeys(data, ["asOf", "datasets", "lineage", "degraded"], "sources.json");
  return data;
}

export async function readThresholds(): Promise<Thresholds> {
  const data = await read<Thresholds>("thresholds.json");
  requireKeys(data, ["thresholdsId", "baseline", "classes", "composite", "alerts", "confidence"], "thresholds.json");
  if (data.baseline.length !== 30) throw new Error("thresholds.json: the baseline must be 30 years");
  return data;
}

export async function readEvaluation(): Promise<Evaluation> {
  const data = await read<Evaluation>("evaluation.json");
  requireKeys(data, ["metrics", "backtest", "eventDefinition"], "evaluation.json");
  requireKeys(
    data.metrics,
    ["anomalyDetectionAccuracy", "falseAlarmRate", "missedEvents", "leadTime", "confidenceCalibration", "geographicCoverage"],
    "evaluation.json metrics",
  );
  return data;
}
