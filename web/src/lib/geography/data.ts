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
  country: string;
  countryName: string;
  areaCells: number;
  coveredCells: number;
  covered: string[];
  signal: "green" | "yellow" | "red" | "no-data";
  probability: number | null;
  modelConfidence: number | null;
}

export interface SignalCountryData extends SignalRowData {
  code: string;
  nameBn: string;
  flag: string;
  areaName: string;
  areaNameBn: string;
  levels: GeoCountrySummary["levels"];
  areas: Partial<Record<"ADM1" | "ADM2", SignalRowData[]>>;
}

export interface SignalDirectory {
  countries: SignalCountryData[];
  demo: DemoScoresFile;
  coverage: CoverageFile;
  geography: GeographyIndex;
}

export async function loadSignalDirectory(): Promise<SignalDirectory> {
  const [index, coverage, demo] = await Promise.all([readGeographyIndex(), readCoverage(), readDemoScores()]);
  const coverageById = new Map(coverage.areas.map((area) => [area.id, area]));
  const demoById = new Map(demo.areas.map((area) => [area.id, area]));
  // A variable counts only when its grid is fine enough to say anything about the area: a 2°
  // cell larger than the whole district is not district-level evidence.
  const minCells = Math.max(1, ...Object.values(coverage.variables).map((variable) => Math.min(3, variable.analysisCells)));

  const row = (id: string, name: string, level: AreaLevel, country: string, countryName: string): SignalRowData => {
    const cells = coverageById.get(id)?.cells ?? {};
    const covered = Object.keys(cells)
      .filter((key) => cells[key].covered && cells[key].areaCells >= minCells)
      .sort();
    const areaCells = Object.values(cells).reduce((sum, cell) => sum + cell.areaCells, 0);
    const coveredCells = Object.values(cells).reduce((sum, cell) => sum + cell.coveredCells, 0);
    const score = demoById.get(id);
    const scored = covered.length > 0 && score !== undefined;
    return {
      id,
      name,
      level,
      country,
      countryName,
      areaCells,
      coveredCells,
      covered,
      signal: scored ? score.signal : "no-data",
      probability: scored ? score.probability : null,
      modelConfidence: scored ? score.modelConfidence : null,
    };
  };

  const countries: SignalCountryData[] = [];
  for (const country of index.countries) {
    const areas: SignalCountryData["areas"] = {};
    for (const level of ["ADM1", "ADM2"] as const) {
      const units = country.areas[level];
      if (!units || units.length === 0) continue;
      areas[level] = units
        .map((unit) => row(unit.id, unit.name, level, country.code, country.name))
        .sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id));
    }
    countries.push({
      ...row(`${country.code.toLowerCase()}-adm0`, country.name, "country", country.code, country.name),
      code: country.code,
      nameBn: country.nameBn,
      flag: country.flag,
      areaName: country.areaName,
      areaNameBn: country.areaNameBn,
      levels: country.levels,
      areas,
    });
  }
  return { countries, demo, coverage, geography: index };
}

/** The area-level totals the page header and legend quote, computed from the same rows. */
export function countSignalRows(countries: SignalCountryData[]) {
  const counts = { green: 0, yellow: 0, red: 0, "no-data": 0 };
  const levels: Record<string, number> = {};
  for (const country of countries) {
    counts[country.signal] += 1;
    levels.country = (levels.country ?? 0) + 1;
    for (const level of ["ADM1", "ADM2"] as const) {
      const rows = country.areas[level] ?? [];
      if (rows.length > 0) levels[level] = (levels[level] ?? 0) + rows.length;
      for (const area of rows) counts[area.signal] += 1;
    }
  }
  return { counts, levels };
}

/** Look up one area by its shared identifier, e.g. "bgd-adm2-dhaka". */
export async function findArea(id: string): Promise<{ country: SignalCountryData; area: SignalRowData } | null> {
  const { countries } = await loadSignalDirectory();
  for (const country of countries) {
    if (country.id === id) return { country, area: country };
    for (const level of ["ADM1", "ADM2"] as const) {
      const area = country.areas[level]?.find((candidate) => candidate.id === id);
      if (area) return { country, area };
    }
  }
  return null;
}

