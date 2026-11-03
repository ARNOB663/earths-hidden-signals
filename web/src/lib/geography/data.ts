// Server-side reader for the shared geography and Signals data. Runs at build time and throws
// when a required file or key is missing, so a broken pipeline never ships a half-empty page.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AdminCountryFile,
  AreaLevel,
  CoverageFile,
  DemoScoresFile,
  GeoCountrySummary,
  GeographyIndex,
  GeographyLicenseFile,
  SignalsSourcesFile,
} from "./types";

const DATA = path.join(process.cwd(), "public", "data");
const GEO = path.join(DATA, "geography");
const SIGNALS = path.join(DATA, "signals");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf-8")) as T;
}

function required<T extends object, K extends keyof T>(value: T, keys: K[], file: string): T {
  for (const key of keys) {
    if (value[key] === undefined || value[key] === null) {
      throw new Error(`geography data: ${file} is missing required key "${String(key)}"`);
    }
  }
  return value;
}

export async function readGeographyIndex(): Promise<GeographyIndex> {
  return required(await readJson<GeographyIndex>(path.join(GEO, "index.json")), ["countries", "source"], "geography/index.json");
}

export async function readGeographyLicense(): Promise<GeographyLicenseFile> {
  const license = await readJson<GeographyLicenseFile>(path.join(GEO, "license.json"));
  if (!Array.isArray(license.files)) throw new Error("geography data: geography/license.json has no files array");
  return license;
}

/** One country's admin file: boundaries as downloaded (not part of the page's data budget). */
export async function readAdminCountry(code: string): Promise<AdminCountryFile> {
  return required(
    await readJson<AdminCountryFile>(path.join(GEO, "admin", `${code}.json`)),
    ["levels", "name"],
    `geography/admin/${code}.json`,
  );
}

export async function readCoverage(): Promise<CoverageFile> {
  const coverage = await readJson<CoverageFile>(path.join(SIGNALS, "coverage.json"));
  if (!Array.isArray(coverage.areas)) throw new Error("signals data: coverage.json has no areas array");
  return coverage;
}

export async function readDemoScores(): Promise<DemoScoresFile> {
  const demo = await readJson<DemoScoresFile>(path.join(SIGNALS, "demo-scores.json"));
  if (!Array.isArray(demo.areas)) throw new Error("signals data: demo-scores.json has no areas array");
  return demo;
}

export async function readSignalsSources(): Promise<SignalsSourcesFile> {
  return required(await readJson<SignalsSourcesFile>(path.join(SIGNALS, "provenance.json")), ["geography", "data", "demo"], "signals/provenance.json");
}

/** One row per country, ADM1 and ADM2 area. A row is "no-data" without measured coverage. */
export interface SignalRowData {
  id: string;
  name: string;
  level: AreaLevel;
  signal: "green" | "yellow" | "red" | "no-data";
  probability: number | null;
  modelConfidence: number | null;
  /**
   * Measured NASA coverage, kept separate from the demo score. `layers` is how many of the
   * analysis variables have usable data for this area ("3 of 6 layers", not a distance or a
   * percent). `cellShare` is the share of those variables' grid cells inside the boundary that
   * carry a usable series — a real geographic percentage, used only when some layers exist.
   */
  coverage: {
    layers: number;
    totalLayers: number;
    cellShare: number | null;
    /** How many published child ADM1 areas carry data. Countries only; null elsewhere. */
    childAreasCovered?: number | null;
    childAreasTotal?: number | null;
  };
}

/**
 * A compact area row sent to the client. 52,000 areas cannot travel as full objects: each tuple is
 * [id, name, signal, probability, layers, cellShare], and the client expands it. "no-data" rows
 * carry null probability and null share.
 */
export type CompactAreaRow = [
  id: string,
  name: string,
  signal: "green" | "yellow" | "red" | "no-data",
  probability: number | null,
  layers: number,
  cellShare: number | null,
];

export function compactArea(row: SignalRowData): CompactAreaRow {
  return [row.id, row.name, row.signal, row.probability, row.coverage.layers, row.coverage.cellShare];
}

export interface SignalCountryData extends SignalRowData {
  code: string;
  nameBn: string;
  flag: string;
  areaName: string;
  areaNameBn: string;
  levels: GeoCountrySummary["levels"];
  areas: Partial<Record<"ADM1" | "ADM2", CompactAreaRow[]>>;
}

export interface SignalDirectory {
  countries: SignalCountryHeader[];
  demo: DemoScoresFile;
  coverage: CoverageFile;
  geography: GeographyIndex;
}

/** A country row with its level counts but no area rows: the page loads areas on expand. */
export interface SignalCountryHeader extends SignalRowData {
  code: string;
  nameBn: string;
  flag: string;
  areaName: string;
  areaNameBn: string;
  levels: GeoCountrySummary["levels"];
}

/** The per-country area file written by build_signal_scores.py. */
export interface CountryAreasFile {
  ADM1?: { name: string; nameBn: string; rows: CompactAreaRow[] };
  ADM2?: { name: string; nameBn: string; rows: CompactAreaRow[] };
}

/** Load one country's area rows from the committed per-country file. */
export async function readCountryAreas(iso: string): Promise<CountryAreasFile> {
  return readJson<CountryAreasFile>(path.join(SIGNALS, "areas", `${iso}.json`));
}

export async function loadSignalDirectory(): Promise<SignalDirectory> {
  const [index, coverage, demo] = await Promise.all([readGeographyIndex(), readCoverage(), readDemoScores()]);
  const coverageById = new Map(coverage.areas.map((area) => [area.id, area]));
  const demoById = new Map(demo.areas.map((area) => [area.id, area]));
  // The coverage file already applied the published rule (at least half of a variable's cells in
  // the area's bounding box inside the boundary, and at least one). The page must not add its own
  // cut-off on top, or it would contradict the measured coverage it displays.
  const totalLayers = Object.keys(coverage.variables).length;
  const counts = (cell: { areaCells: number; coveredCells: number; covered: boolean }) => cell.areaCells > 0;

  const row = (id: string, name: string, level: AreaLevel): SignalRowData => {
    const cells = coverageById.get(id)?.cells ?? {};
    const layers = Object.keys(cells).filter((key) => cells[key].covered).length;
    // The geographic share uses every variable that has at least one cell inside the area, so a
    // coarse layer that misses the area entirely does not drag the percentage down.
    const countedCells = Object.values(cells).filter(counts).reduce((sum, cell) => sum + cell.areaCells, 0);
    const countedCovered = Object.values(cells).filter(counts).reduce((sum, cell) => sum + cell.coveredCells, 0);
    const score = demoById.get(id);
    const scored = layers > 0 && score !== undefined;
    return {
      id,
      name,
      level,
      signal: scored ? score.signal : "no-data",
      probability: scored ? score.probability : null,
      modelConfidence: scored ? score.modelConfidence : null,
      coverage: {
        layers,
        totalLayers,
        cellShare: countedCells > 0 ? countedCovered / countedCells : null,
      },
    };
  };

  // Country rows only. The 52,000 area rows live in per-country files and are loaded when a
  // country is opened, so the server never has to serialise the whole directory to the client.
  const countries: SignalCountryHeader[] = index.countries.map((country) => {
    const adm0 = row(`${country.code.toLowerCase()}-adm0`, country.name, "country");
    const adm1Units = country.areas.ADM1 ?? [];
    if (adm1Units.length > 0) {
      // Count ADM1 areas with measured coverage straight from the coverage file.
      const areasWithData = adm1Units.filter((unit) => row(unit.id, unit.name, "ADM1").coverage.layers > 0).length;
      adm0.coverage.childAreasCovered = areasWithData;
      adm0.coverage.childAreasTotal = adm1Units.length;
      adm0.coverage.layers = areasWithData;
      if (areasWithData === 0) {
        adm0.signal = "no-data";
        adm0.probability = null;
        adm0.modelConfidence = null;
      }
    }
    return {
      ...adm0,
      code: country.code,
      nameBn: country.nameBn,
      flag: country.flag,
      areaName: country.areaName,
      areaNameBn: country.areaNameBn,
      levels: country.levels,
    };
  });
  return { countries, demo, coverage, geography: index };
}

/**
 * The GYR totals the page header quotes. They are counted from the same coverage + demo files the
 * rows and per-country area files use, so a total can never disagree with the list.
 */
export function countSignalRows(directory: SignalDirectory) {
  const { countries, coverage, demo } = directory;
  const coverageById = new Map(coverage.areas.map((area) => [area.id, area]));
  const demoById = new Map(demo.areas.map((area) => [area.id, area]));
  const counts = { green: 0, yellow: 0, red: 0, "no-data": 0 };
  const levels: Record<string, number> = { country: countries.length, ADM1: 0, ADM2: 0 };

  // Each participant is either a country (ADM0) or an area with a coverage row (ADM1).
  const scoreFor = (id: string) => {
    const layers = Object.values(coverageById.get(id)?.cells ?? {}).filter((cell) => cell.covered).length;
    const score = demoById.get(id);
    return layers > 0 && score ? score.signal : "no-data";
  };

  for (const country of countries) {
    const adm1 = country.levels.ADM1?.count ?? 0;
    const adm2 = country.levels.ADM2?.count ?? 0;
    levels.ADM1 += adm1;
    levels.ADM2 += adm2;
    const countrySignal = country.coverage.childAreasCovered === 0 ? "no-data" : scoreFor(country.id);
    counts[countrySignal] += 1;
  }
  for (const area of coverage.areas) {
    if (area.level !== "ADM1") continue;
    counts[scoreFor(area.id)] += 1;
  }
  // ADM2 has no published coverage, so every ADM2 row is No data.
  counts["no-data"] += levels.ADM2;
  return { counts, levels };
}

/** How many areas of each level have real measured coverage, for the coverage line. */
export function coverageSummary(countries: SignalCountryHeader[]) {
  const levels: Record<string, { total: number; withData: number }> = { country: { total: 0, withData: 0 }, ADM1: { total: 0, withData: 0 }, ADM2: { total: 0, withData: 0 } };
  for (const country of countries) {
    levels.country.total += 1;
    if ((country.coverage.childAreasCovered ?? 0) > 0 || country.coverage.layers > 0) levels.country.withData += 1;
    // Area totals come from the boundary index, not from rows that are no longer loaded here.
    const adm1 = country.levels.ADM1?.count ?? 0;
    const adm2 = country.levels.ADM2?.count ?? 0;
    levels.ADM1.total += adm1;
    levels.ADM2.total += adm2;
    levels.ADM1.withData += country.coverage.childAreasCovered ?? 0;
  }
  return levels;
}

/** A full area row rebuilt from its compact form; the level and layer total come from the caller. */
export function expandArea(
  row: CompactAreaRow,
  level: AreaLevel,
  totalLayers: number,
  modelConfidence: number | null = null,
): SignalRowData {
  const [id, name, signal, probability, layers, cellShare] = row;
  return {
    id,
    name,
    level,
    signal,
    probability,
    modelConfidence,
    coverage: { layers, totalLayers, cellShare },
  };
}

/**
 * Look up one area by the shared identifier every page uses, e.g. "bgd-adm2-dhaka" or
 * "bgd-adm0". Watch, Accuracy, Hazards, Trends and Map can resolve the same IDs through this.
 */
export async function findArea(id: string): Promise<{ country: SignalCountryHeader; area: SignalRowData } | null> {
  const { countries, coverage } = await loadSignalDirectory();
  const totalLayers = Object.keys(coverage.variables).length;
  for (const country of countries) {
    if (country.id === id) return { country, area: country };
    const areasFile = await readCountryAreas(country.code);
    for (const level of ["ADM1", "ADM2"] as const) {
      const found = areasFile[level]?.rows.find((candidate) => candidate[0] === id);
      if (found) return { country, area: expandArea(found, level, totalLayers) };
    }
  }
  return null;
}

