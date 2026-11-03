// Shared types for the Signals pages. Mirrors scripts/signals/build.py output exactly.

export type Status = "green" | "yellow" | "red" | "grey";
export type Confidence = "low" | "medium" | "high";

export interface SignalCell {
  lat: number;
  lon: number;
  status: Status;
  confidence: Confidence;
  reason: string;
  reasonText: string;
  windowDays: number | null;
  percentile: number | null;
  ratio: number | null;
  day1: number | null;
  day3: number | null;
  day7: number | null;
  sample?: boolean;
}

export interface SignalsMeta {
  sampleData: boolean;
  basis: "sample" | "real";
  clock: string;
  measurementTime: string;
  tiles: string[];
  tileLabels: Record<string, string>;
  generatedAt: string;
  product: string;
  note: string;
}

export interface TileConfig {
  id: string;
  label: string;
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface StatusRule {
  percentile: number;
  ratio: number;
  mm: number;
}

export interface SignalsConfig {
  gridDeg: number;
  tileDeg: number;
  enabledTiles: TileConfig[];
  staleHours: number;
  maxAbsLat: number;
  /** The engine's thresholds, served from config.json: the UI reads them, never repeats them. */
  yellow: StatusRule;
  red: StatusRule;
  official: { wmo: string; line: string };
  outlook: { days: number; label: string };
  budgets: Record<string, number>;
  doyHalfWindow: number;
  wetDayMinMm: number;
  baselineCountMin: number;
  baselineYearsMin: number;
  baselineProduct: string;
  baselineNote: string;
}

export interface WatchRise {
  lat: number;
  lon: number;
  date: string;
  status: Status;
  from: Status;
}

export interface WatchPayload {
  entries: number;
  latest: string | null;
  previous: string | null;
  rises: WatchRise[];
  sample: boolean;
}

export interface AccuracyEvent {
  id: string;
  gdacsId: number;
  lat: number;
  lon: number;
  start: string;
  status: string;
  hit: boolean | null;
  inCoverage: boolean;
}

export interface AccuracyPayload {
  label: string;
  reportingEvents: number;
  measuredEvents: number;
  /** Null (never zero) until the replay set is large enough: an empty replay has no accuracy. */
  hits: number | null;
  misses: number | null;
  unmatched: number | null;
  satelliteConfirmed: number | null;
  notEnough: boolean;
  notEnoughText: string;
  unmatchedText: string;
  product: string;
  radiusKm: number;
  leadDays: number;
  events: AccuracyEvent[];
}

export interface SourceStatus {
  /** Free-form so a source can record "reachable from the pipeline host only" etc. */
  status: string;
  checkedOn?: string;
  sample?: boolean;
}

export type SourcesFile = Record<string, SourceStatus>;
