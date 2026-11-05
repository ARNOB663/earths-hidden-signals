// Server-side readers for web/public/data/intelligence/. Each reader checks the keys the pages rely
// on and throws during the build if one is missing: a broken dataset fails loudly instead of
// rendering guessed numbers.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Evaluation, Sources, Thresholds } from "./types";

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
