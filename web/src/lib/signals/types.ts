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

// --- /signals/place: the five strips (Before / Now / Next / Trust / Action) ---------------------
// Mirrors scripts/signals/place.py (places.json) and places_network.py (places/{id}.json).

export type TrustState = "detectable" | "blind-spot" | "no-data";

export interface BeforeVariable {
  key: string;
  title?: string;
  titleBn?: string;
  variable: string;
  label: string;
  unit: string;
  per: "decade";
  dataset: string;
  cells: number;
  cellsSignificant: number;
  slopePerDecade: number | null;
  lowerPerDecade: number | null;
  upperPerDecade: number | null;
  /** The area-mean 95% CI excludes zero: the readable signal for a place. */
  ciConsistent: boolean;
  years: number[];
  series: (number | null)[];
}

export interface BeforeStrip {
  years: number[];
  spanYears: number;
  firstYear: number | null;
  lastYear: number | null;
  variables: BeforeVariable[];
}

export interface PlaceNowCell extends Pick<
  SignalCell,
  | "lat"
  | "lon"
  | "status"
  | "confidence"
  | "reasonText"
  | "windowDays"
  | "percentile"
  | "ratio"
  | "day1"
  | "day3"
  | "day7"
  | "sample"
> {
  reasonTextBn?: string;
}

export interface PlaceNow {
  state: "measured" | "no-data";
  tile: string | null;
  tileLabel?: string;
  sample?: boolean;
  clock?: string;
  cells: PlaceNowCell[];
  measuredCells?: number;
  screenedCells?: number;
}

export interface TrustStrip {
  state: TrustState;
  label: string;
  text: string;
  variables: string[];
  variablesEn?: string[];
  measuredVariables?: number;
  measuredVariablesEn?: string[];
  measured?: string[];
  rule?: string;
}

export interface ActionStrip {
  en: string;
  bn: string;
  source: string;
}

export interface PlaceArea {
  id: string;
  name: string;
  country: string;
  countryName: string;
  level: "ADM1" | "ADM2";
  /** [lat, lon] of the boundary centroid. */
  centre: [number, number];
  areaKm2: number;
  tile: string;
  tileLabel: string;
  before: BeforeStrip;
  now: PlaceNow;
  trust: TrustStrip;
  /** The one-line Action strip, written here so it ships beside the record it describes. */
  action: ActionStrip;
}

export interface PlacesFile {
  schema: string;
  generated: string;
  generatedAt: string | null;
  sample: boolean;
  tiles: string[];
  levels: ("ADM1" | "ADM2")[];
  note: string;
  areas: PlaceArea[];
}

export interface OutlookDay {
  date: string;
  mm: number | null;
}

export interface PlaceExtras {
  schema: string;
  id: string;
  name: string;
  country: string;
  fetchedAt: string;
  next: {
    provider: string;
    fetchedAt: string;
    days: OutlookDay[];
    totalMm: number | null;
    label: string;
    usedInStatus: false;
  } | null;
  nextNote: string | null;
  evidence: {
    product: string;
    note: string;
    years: { year: number; mm: number | null }[];
    gaps: number[];
    floodYears: number[];
    floodEvents: { id: string; start: string; lat: number; lon: number; tile: string }[];
    floodNote: string;
  };
}
