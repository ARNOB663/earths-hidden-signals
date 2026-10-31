// Types for web/public/data/intelligence/*.json, written by analysis/intelligence.py and evaluate.py.
// The web app renders these values; it never recomputes a class, threshold or confidence grade.

export type Level = "quiet" | "notable" | "elevated" | "high";
export type Severity = "info" | "watch" | "warning";
export type Grade = "high" | "moderate" | "low" | "insufficient";
export type HazardKey = "heat" | "dry" | "flood" | "landslide" | "wildfire" | "cyclone";
export type LocationKind = "country" | "region" | "study-area" | "city";

export interface Bi {
  en: string;
  bn: string;
}

export interface Reason {
  code: string;
  textEn: string;
  textBn: string;
}

export interface Confidence {
  grade: Grade;
  reasons: Reason[];
}

export interface Freshness {
  observedThrough: string;
  ageDays: number;
  expectedLagDays: number | null;
  lateDays: number | null;
  stale: boolean;
}

export interface Indicator extends Freshness {
  id: string;
  schema: "indicator-v1";
  geographyId: string;
  variable: string;
  labelEn: string;
  labelBn: string;
  valueNoteEn: string;
  valueNoteBn: string;
  period: string;
  observedPeriod: string;
  year: number;
  observedAt: { start: string; end: string };
  retrievedAt: string;
  source: string;
  datasetId: string;
  baselineId: string;
  thresholdsId: string;
  unit: string;
  available: boolean;
  reason: string | null;
  coverage: { cellsUsed: number | null; coveragePct: number } | null;
  inputs: Record<string, unknown>[];
  confidence: { observation: Confidence; anomaly: Confidence };
  value?: number;
  baseline?: { n: number; mean: number; sd: number };
  percentile?: number;
  rankHigh?: number;
  rankOf?: number;
  zScore?: number | null;
  difference?: number;
  ratioPct?: number | null;
  class?: string | null;
  direction?: "high" | "low";
  level?: number;
  trigger?: "percentile" | "z" | null;
  duration: { periods: number; sinceYear: number | null };
}

export interface CompositeComponent {
  id: string;
  variable: string;
  period: string;
  counted: boolean;
  highSide: "wet" | "dry";
  indicatorId: string | null;
  available: boolean;
  class: string | null;
  level: number;
  direction: "high" | "low" | null;
  percentile: number | null;
  noteEn: string | null;
}

export interface Composite {
  id: string;
  schema: "composite-v1";
  period: string;
  year: number;
  available: boolean;
  class: string | null;
  level: number;
  side: "wet" | "dry" | null;
  direction: "high" | "low" | null;
  conflicting: boolean;
  conflictWith?: string[];
  corroboratedBy: string[];
  components: CompositeComponent[];
  unavailableComponents: { id: string; labelEn: string; reasonEn: string }[];
  dailyComponents: "available" | "unavailable";
  dailyComponentsReason: string | null;
  duration: { periods: number; sinceYear: number | null };
}

export interface Current {
  schema: "current-v1";
  asOf: string;
  pipelineRunId: string;
  thresholdsId: string;
  baselineId: string;
  dailyBaselineId: string;
  retrievedAt: string;
  indicators: Record<string, Record<string, Indicator>>;
  composites: Record<string, Record<string, Composite>>;
}

export interface HazardEvidence {
  variable: string;
  period: string;
  year: number;
  percentile: number | null;
  class: string | null;
  n: number | null;
}

export interface HazardScreen {
  hazard: HazardKey;
  severity: Severity | null;
  level: Level;
  period: string;
  year: number;
  evidence: HazardEvidence[];
  evidenceIds: string[];
  linkedDriver: boolean;
  hasRecord: boolean;
  regions: string[];
  confidence: Confidence;
  whyEn: string;
  whyBn: string;
  note: string | null;
  disclaimerEn: string;
  disclaimerBn: string;
}

export interface Conclusion {
  schema: "conclusion-v1";
  locationId: string;
  level: Level;
  headline: Bi;
  situation: Bi;
  normality: Bi;
  magnitude: Bi;
  development: Bi;
  hazards: (Bi & { hazard: HazardKey; level: Level })[];
  reliability: Bi & { weakest: keyof Confidences };
  actions: (Bi & { id: string })[];
  observedThrough: string | null;
  dataAgeDays: number | null;
  assessedAt: string;
  evidenceIds: string[];
  thresholdsId: string;
}

export interface Confidences {
  observation: Confidence;
  anomaly: Confidence;
  hazard: Confidence;
  validation: Confidence;
}

export interface Verdict {
  check: string;
  status: "agree" | "partly" | "disagree" | "unavailable";
  sources: string[];
  independence: "independent" | "same-input-family" | "consistency-check";
  detailEn: string;
  detailBn: string;
  limitationsEn: string;
  limitationsBn: string;
  countsAsValidation?: boolean;
}

export interface Resolution {
  latDeg: number;
  lonDeg: number;
  approxKmNS: number;
  approxKmEW: number;
  note: string;
}

export interface Geography {
  kind: LocationKind;
  sourceId: string;
  sourceKind: string;
  sourceNameEn: string;
  sourceNameBn: string;
  spatialResolution: Record<"temperature" | "rainfall" | "daily", Resolution>;
  resolutionLabelEn: string;
  resolutionLabelBn: string;
  cellsUsed: { temperature: number | null; rainfall: number | null };
  coveragePct: number;
  fallback: boolean;
  fallbackReasonEn: string | null;
  fallbackReasonBn: string | null;
  weighting: string;
}

export interface OfficialSource {
  name: string;
  nameBn: string;
  url: string;
}

export interface Location {
  id: string;
  schema: "location-v1";
  kind: LocationKind;
  name: string;
  nameBn: string;
  country?: string;
  countryBn?: string;
  countryCodes: string[];
  sourceId: string;
  sourceKind?: string;
  center: [number, number];
  bounds?: [[number, number], [number, number]];
  bbox?: [number, number, number, number];
  point?: [number, number];
  exposure: { hazard: HazardKey; regionId: string; sharePct: number | null }[];
  officialSources: OfficialSource[];
  geography: Geography;
  asOf: string;
  thresholdsId: string;
  conclusion: Conclusion;
  hazards: HazardScreen[];
  confidences: Confidences;
  validation: Verdict[];
  alertsFrom: string;
}

export interface IndexEntry {
  id: string;
  kind: LocationKind;
  name: string;
  nameBn: string;
  country: string | null;
  countryBn: string | null;
  countryCodes: string[];
  sourceId: string;
  center: [number, number];
  level: Level;
  headline: Bi;
  hazards: HazardKey[];
  flagged: HazardKey[];
  observedThrough: string | null;
}

export interface InternalAlert {
  id: string;
  kind: "internal";
  official: false;
  locationId: string;
  hazard: HazardKey;
  severity: Severity;
  status: "active" | "closed";
  firstPeriod: string;
  lastSeenPeriod: string;
  occurrences: string[];
  closedAt: string | null;
  closedReason: "superseded" | "eased" | "expired" | null;
  supersededBy: string | null;
  textEn: string;
  textBn: string;
  evidence: HazardEvidence[];
  reconstructed: boolean;
  noteEn?: string;
  noteBn?: string;
}

export interface OfficialAlert {
  id: string;
  kind: "official";
  official: true;
  provider: string;
  providerUrl: string;
  eventId: string | null;
  eventIdNote: string;
  hazard: "flood";
  alertLevel: string | null;
  date: string;
  end: string | null;
  title: string;
  country: string;
  locationId: string;
  textEn: string;
  textBn: string;
}

export interface Alerts {
  schema: "alerts-v1";
  asOf: string;
  noteEn: string;
  noteBn: string;
  computed: InternalAlert[];
  reconstructed: InternalAlert[];
  official: OfficialAlert[];
  officialWindowNoteEn: string;
}

export interface HistoryRow {
  period: string;
  year: number;
  indicators: {
    temperature_annual: { class: string | null; direction: string | null; percentile: number };
    rainfall_monsoon: { class: string | null; direction: string | null; conflicting: boolean | null };
  };
  conclusionLevel: Level;
  hazardLevels: Partial<Record<HazardKey, Level>>;
  confidences: { anomaly: Grade };
  alertsOpened: string[];
  alertsClosed: string[];
  reconstructed: boolean;
  changedSince: { field: string; from: string | null; to: string | null; reason: string }[];
}

export interface History {
  schema: "history-v1";
  runs: { asOf: string; pipelineRunId: string; inputsHash: string; levels: Record<string, Level> }[];
  periods: Record<string, HistoryRow[]>;
}

export interface DatasetFreshness {
  datasetId: string;
  name: string;
  version: string;
  use: string;
  expectedLagDays: number | null;
  products: (Freshness & { product: string })[];
  retrievedAt: string;
  checkedAt: string;
  stale: boolean;
}

export interface Sources {
  schema: "sources-v1";
  asOf: string;
  pipelineRunId: string;
  mode: "offline" | "refresh";
  datasets: DatasetFreshness[];
  lineage: { pair: string[]; independence: string; why: string }[];
  pipelineOrder: string[];
  degraded: string[];
  latestMonthNoteEn: string;
}

export interface Thresholds {
  schema: "thresholds-v1";
  thresholdsId: string;
  baseline: {
    id: string;
    years: [number, number];
    length: number;
    dailyId: string;
    dailyYears: [number, number];
    dailyLength: number;
    minValues: number;
    minCoveragePct: number;
    comparison: string;
  };
  classes: { class: string; level: number; rule: string; rationale: string }[];
  percentileMethod: string;
  composite: { id: string; rule: string };
  alerts: { id: string; rules: { hazard: string; severity: string; rule: string }[]; prefixEn: string; prefixBn: string };
  levels: { values: Level[]; rule: string };
  confidence: { id: string; coverageFullPct: number; lateDaysDegraded: number };
  freshness: { id: string; expectedLagDays: Record<string, number | null>; staleAfterDays: number };
  evaluation: { id: string; falseAlarmTolerance: number };
}

export interface RateBlock {
  agree: number;
  n: number;
  pct: number;
}

export interface Evaluation {
  schema: "evaluation-v1";
  asOf: string;
  eventDefinition: string;
  metrics: {
    anomalyDetectionAccuracy: { value: number | null; n: number; window: [number, number] | null; definition: string; byClass: Record<string, RateBlock> };
    falseAlarmRate: { value: number | null; byHazard: Record<string, number | null>; definition: string; reason: string | null };
    missedEvents: { value: number | null; definition: string; reason: string | null };
    leadTime: { value: number | null; reason: string };
    confidenceCalibration: { definition: string; byGrade: Record<string, RateBlock>; monotonic: boolean | null };
    geographicCoverage: { value: Record<string, { landCells: number; usableCells: number; pct: number | null }>; definition: string };
  };
  backtest: Record<
    string,
    {
      regionId: string;
      hazard: string;
      available: boolean;
      reason?: string;
      window?: [number, number] | null;
      hits?: number;
      misses?: number;
      falseAlarms?: number;
      correctNegatives?: number;
      falseAlarmRate?: number | null;
      missedEventRate?: number | null;
    }
  >;
  limitations: string[];
  regressionGate: { tolerance: number; regressions: string[] };
}
