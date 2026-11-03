// Shared geography identifiers for Signals, Watch, Accuracy, Hazards, Trends and Map.
// Mirrors analysis/build_geography.py output (web/public/data/geography/) and the Signals
// coverage and demo-score files written by analysis/build_signal_scores.py.

export type AdminLevel = "ADM0" | "ADM1" | "ADM2";

/** ADM0 is the country itself; ADM1 and ADM2 are its published sub-national levels. */
export type AreaLevel = "country" | "ADM1" | "ADM2";

export interface GeoLevelSummary {
  /** The level's own name in the source (e.g. "Division", "district", "District"). */
  name: string;
  nameBn: string;
  /** Units actually listed for this level, from the boundary attribute table. */
  count: number;
  /** Units geoBoundaries reports for the file; differs from count on a few files (e.g. IND ADM2). */
  sourceCount?: number;
}

export interface GeoCountrySummary {
  code: string;
  name: string;
  nameBn: string;
  flag: string;
  /** The local name of the deepest published level ("district", "Gewog", "District"…). */
  areaName: string;
  areaNameBn: string;
  levels: Partial<Record<AdminLevel, GeoLevelSummary>>;
}

export interface GeographyCounts {
  countries: number;
  /** Countries/territories that publish ADM1 / ADM2, and their total areas. */
  ADM1: number;
  ADM2: number;
  ADM1Areas: number;
  ADM2Areas: number;
}

export interface GeographyIndex {
  schema: string;
  release: string;
  /** Totals recomputed from the loaded boundary files, not hardcoded. */
  counts?: GeographyCounts;
  /** ISO codes with some levels but no ADM0 (PRI), so they are not listed as countries. */
  skipped?: { iso: string; levels: AdminLevel[]; reason: string }[];
  source: {
    name: string;
    url: string;
    dataset: string;
    citation: string;
    doi: string;
    note: string;
  };
  countries: GeoCountryEntry[];
}

export interface AdminUnit {
  /** Stable identifier shared by every page, e.g. "bgd-adm2-dhaka". */
  id: string;
  name: string;
  shapeISO: string | null;
}

export interface AdminLevelFile {
  code: AdminLevel;
  name: string;
  nameBn: string;
  canonical: string | null;
  count: number;
  representedYear: string | null;
  units: AdminUnit[];
}

export interface GeoCountryEntry extends GeoCountrySummary {
  areas: Partial<Record<"ADM1" | "ADM2", AdminUnit[]>>;
}

export interface AdminCountryFile {
  code: string;
  name: string;
  nameBn: string;
  flag: string;
  levels: Partial<Record<AdminLevel, AdminLevelFile>>;
}

export interface GeographyLicenseFile {
  schema: string;
  source: string;
  licenseUrl: string;
  note: string;
  files: {
    iso: string;
    level: AdminLevel;
    boundaryId: string;
    levelName: string;
    units: number;
    license: string;
    licenseSource: string;
    boundarySource: string;
    sourceURL: string;
    representedYear: string | null;
    buildDate: string;
    download: string;
  }[];
}

export type SignalLevel = "green" | "yellow" | "red";
export type NoData = "no-data";

export interface CoverageVariable {
  name: string;
  nameBn: string;
  dataset: string;
  file: string;
  gridDegrees: number;
  analysisCells: number;
  letter: string;
  years: [number, number];
  observedThrough: number | null;
  unit: string | null;
  rule: string;
  unusableRows: number;
}

export interface AreaCoverage {
  id: string;
  country: string;
  level: AreaLevel;
  cells: Record<string, { areaCells: number; coveredCells: number; covered: boolean }>;
}

export interface CoverageFile {
  schema: string;
  generatedFrom: { trends: string };
  /** ISO codes whose boundaries overlap the NASA grids and were measured. */
  measuredCountries?: string[];
  /** Extent of the analysis grids in degrees, so the page can say where coverage stops. */
  gridExtent?: { lon: [number, number]; lat: [number, number] };
  method: string;
  variables: Record<string, CoverageVariable>;
  areas: AreaCoverage[];
}

export interface DemoScore {
  id: string;
  signal: SignalLevel;
  probability: number;
  modelConfidence: number;
}

export interface DemoScoresFile {
  schema: string;
  status: "demo";
  notReal: true;
  event: string;
  eventPeriod: string;
  scoreField: "probability";
  scoreMeaning: string;
  modelConfidenceMeaning: string;
  /** Illustrative demo cuts only; never an official risk scale. Each band is [min, max). */
  bandMeaning?: string;
  signalBands: { signal: SignalLevel; min: number; max?: number }[];
  generator: string;
  areas: DemoScore[];
}

export interface SignalsSourcesFile {
  schema: string;
  geography: {
    name: string;
    url: string;
    dataset: string;
    licenseUrl: string;
    citation: string;
    doi: string;
    licenseFile: string;
    indexFile: string;
    use: string;
  };
  data: { variable: string; name: string; dataset: string; use: string; file: string }[];
  demo: { file: string; status: string; replacedBy: string };
}

/** One row the Signals page renders: an area with its demo score and measured coverage. */
export interface SignalRow {
  id: string;
  name: string;
  level: AreaLevel;
  signal: SignalLevel | NoData;
  probability: number | null;
  modelConfidence: number | null;
  covered: string[];
  areaCells: number;
  coveredCells: number;
}

export interface SignalCountry extends SignalRow {
  code: string;
  nameBn: string;
  flag: string;
  levels: Partial<Record<AdminLevel, GeoLevelSummary>>;
  areas: Partial<Record<"ADM1" | "ADM2", SignalRow[]>>;
}
