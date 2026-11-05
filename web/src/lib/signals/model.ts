// The Signal page's model, built from committed JSON once per request.
//
// This is presentation, not science: the coverage state, Watch Level and Data Trust Grade are
// *derived* from values the Python pipeline already computed (cell status, Sen-slope intervals,
// observation age, case-set size). The rules are restated from scripts/signals/level.py and
// config.json; no threshold, probability or interval is invented here. Missing data produces a
// stated reason, never a zero and never "normal".

import { readFile } from "node:fs/promises";
import path from "node:path";
import { FREQUENCY_UNKNOWN, type CoverageState, type TrustGrade, type WatchLevel } from "./level";
import type { PlaceArea, Status } from "./types";

const DATA = path.join(process.cwd(), "public", "data", "signals");

export interface BriefTile {
  id: string;
  label: string;
  south: number;
  north: number;
  west: number;
  east: number;
  gridDeg: number;
  rainProduct: string;
}

export interface Brief {
  schema: string;
  sample: boolean;
  official: { wmo: string; line: string; name?: string };
  outlook: { days: number; provider: string; enabled: boolean; label: string };
  staleHours: number;
  episodeRadiusKm: number;
  intervalCases: number;
  tiles: BriefTile[];
  latest: { month: string; baseline: string; zones: Record<string, { anomaly: number; rank: number; of: number }> } | null;
  latestRain: { month: string; baseline: string; zones: Record<string, { percentOfNormal: number; mm: number; rank: number; of: number }> } | null;
  trends: { updated: string; firstYear: number; lastYear: number; sources: string[] } | null;
}

export interface FrequencyLevel {
  mm: number;
  year?: number;
  flood?: boolean;
  cases: number;
  floods: number;
  low: number;
  high: number;
}

export interface FrequencyCase {
  year: number;
  mm: number;
  flood: boolean;
  near?: { id: string; start: string; km: number }[];
  nearCount?: number;
}

export interface FrequencyFile {
  state?: "ok" | "insufficient" | "unavailable";
  reason?: string;
  minYears?: number;
  intervalCases?: number;
  radiusKm?: number;
  levels?: FrequencyLevel[];
  floodsAtLeast?: FrequencyLevel[];
  cases?: FrequencyCase[];
  counts?: { cases: number; floods: number | null; catalogued: number };
  product?: string | null;
  note?: string | null;
  floodNote?: string | null;
  fetchedAt?: string | null;
}

export interface FrequencySummary {
  state: "ok" | "insufficient" | "unavailable";
  reason: string;
  minCases: number;
  /** Levels at or below the observation; the row itself for "at this rainfall level". */
  level: FrequencyLevel | null;
  floodsAtLeast: FrequencyLevel[];
  cases: FrequencyCase[];
  counts: { cases: number; floods: number | null };
  radiusKm: number;
  product: string | null;
  note: string | null;
  fetchedAt: string | null;
}

export interface ReasonCode {
  key: string;
  en: string;
  bn: string;
}

export interface TrustFactor {
  key: string;
  ok: boolean;
  en: string;
  bn: string;
}

export interface SignalRow {
  id: string;
  name: string;
  country: string;
  countryName: string;
  countryBn: string;
  level: "ADM1" | "ADM2";
  centre: [number, number];
  tile: string;
  tileLabel: string;
  coverage: CoverageState;
  watch: WatchLevel;
  trust: TrustGrade;
  observed: string | null;
  daysOld: number | null;
  watchReasons: ReasonCode[];
  trustFactors: TrustFactor[];
  coverageReason: ReasonCode;
  rain: { day1: number | null; day3: number | null; day7: number | null };
  ratio: number | null;
  percentile: number | null;
  windowDays: number | null;
  /** True when the reading behind this row is a fixed sample, not a real IMERG observation. */
  sample: boolean;
  cells: { lat: number; lon: number; status: Status; reasonText: string; ratio: number | null; percentile: number | null }[];
  before: { variable: string; label: string; slope: number | null; lower: number | null; upper: number | null; consistent: boolean; dataset: string; unit: string; firstYear: number | null; lastYear: number | null }[];
  spanYears: number;
  frequency: FrequencySummary;
}

export interface Model {
  rows: SignalRow[];
  brief: Brief;
  sample: boolean;
  generatedAt: string;
  countries: { code: string; name: string; nameBn: string }[];
  counts: { places: number; live: number; seasonal: number; cantTell: number; adm1: number; adm2: number; countries: number };
}

let cached: Promise<Model> | null = null;

async function readJson<T>(...parts: string[]): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA, ...parts), "utf-8")) as T;
}

async function optionalJson<T>(...parts: string[]): Promise<T | null> {
  try {
    return await readJson<T>(...parts);
  } catch {
    return null;
  }
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const stamp = Date.parse(value);
  return Number.isNaN(stamp) ? null : stamp;
}

function daysBetween(from: number | null, to: number): number | null {
  return from === null ? null : Math.max(0, Math.floor((to - from) / 86_400_000));
}

export function ageWords(days: number | null): { en: string; bn: string } {
  if (days === null) return { en: "no dated observation", bn: "তারিখযুক্ত পর্যবেক্ষণ নেই" };
  if (days === 0) return { en: "today", bn: "আজ" };
  if (days === 1) return { en: "1 day old", bn: "১ দিন পুরোনো" };
  return { en: `${days} days old`, bn: `${days} দিন পুরোনো` };
}

/** The threshold the pipeline used: a reading <= this many days old is current. */
function freshnessDays(brief: Brief): number {
  // config.json keeps hours (forecast-oriented); a daily rain reading is current for 7 days.
  return Math.max(7, Math.round(brief.staleHours / 24));
}

function coverageFor(
  area: PlaceArea,
  now: number,
  brief: Brief,
): { state: CoverageState; reason: ReasonCode; days: number | null } {
  const limit = freshnessDays(brief);
  if (area.now.state !== "measured" || area.now.cells.length === 0) {
    const noHistory = area.before.firstYear === null;
    return {
      state: "seasonal",
      reason: {
        key: "no-now",
        en: noHistory
          ? "No current rain observation covers this area, and its historical climate record is missing too, so neither a Watch Level nor a climate baseline can be shown."
          : `No current rain observation covers this area: none of the ${area.tileLabel} rain cells falls inside its boundary. Its ${area.before.spanYears}-year climate record still applies, so the page shows seasonal context only.`,
        bn: noHistory
          ? "এই এলাকাকে কোনো সাম্প্রতিক বৃষ্টির পাঠ ঢাকে না, আর এর ঐতিহাসিক জলবায়ু-রেকর্ডও অনুপস্থিত, তাই সতর্কতার মাত্রা বা জলবায়ু-ভিত্তি কোনোটিই দেখানো যায় না।"
          : `এই এলাকাকে কোনো সাম্প্রতিক বৃষ্টির পাঠ ঢাকে না: ${area.tileLabel} বৃষ্টি-কোষের কোনোটি এর সীমানার ভেতরে পড়ে না। এর ${area.before.spanYears} বছরের জলবায়ু-রেকর্ড এখনো প্রযোজ্য, তাই পাতাটি কেবল মৌসুমি প্রেক্ষাপট দেখায়।`,
      },
      days: null,
    };
  }
  const usable = area.now.cells.filter((cell) => cell.status !== "grey");
  if (usable.length === 0) {
    return {
      state: "seasonal",
      reason: {
        key: "cells-unusable",
        en: "The nearest rain cells are marked unusable (too short a baseline or too many missing days), so no current Watch Level can be set. The historical climate record still applies.",
        bn: "নিকটতম বৃষ্টি-কোষগুলো অব্যবহারযোগ্য (তুলনার ভিত্তি খুব ছোট বা অনেক দিন অনুপস্থিত), তাই এখনকার সতর্কতার মাত্রা নির্ধারণ করা যায় না। ঐতিহাসিক জলবায়ু-রেকর্ড এখনো প্রযোজ্য।",
      },
      days: null,
    };
  }
  const observed = parseDate(area.now.clock);
  const days = daysBetween(observed, now);
  if (days !== null && days > limit) {
    return {
      state: "cant-tell",
      reason: {
        key: "stale",
        en: `The newest rain observation for this area is from ${area.now.clock?.slice(0, 10)}, older than the ${limit}-day freshness limit. An old reading is not presented as current.`,
        bn: `এই এলাকার সর্বশেষ বৃষ্টির পাঠ ${area.now.clock?.slice(0, 10)} তারিখের, যা ${limit} দিনের সতেজতা-সীমার চেয়ে পুরোনো। পুরোনো পাঠকে বর্তমান হিসেবে দেখানো হয় না।`,
      },
      days,
    };
  }
  return {
    state: "live",
    reason: {
      key: "live",
      en: "A current rain observation covers this area: the nearest satellite cell inside its boundary.",
      bn: "এই এলাকাকে একটি সাম্প্রতিক বৃষ্টির পাঠ ঢাকে: সীমানার ভেতরের নিকটতম স্যাটেলাইট কোষটি।",
    },
    days,
  };
}

const STATUS_RANK: Record<Status, number> = { red: 3, yellow: 2, green: 1, grey: 0 };

/** The strongest reading decides the level; "can't tell" only when every reading is grey. */
function watchFor(area: PlaceArea): { level: WatchLevel; reasons: ReasonCode[]; lead: PlaceArea["now"]["cells"][number] | null } {
  const ranked = [...area.now.cells].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  const lead = ranked[0] ?? null;
  if (!lead) {
    return { level: "unknown", reasons: [{ key: "no-readings", en: "No reading exists for this area.", bn: "এই এলাকার কোনো পাঠ নেই।" }], lead: null };
  }
  if (lead.status === "grey") {
    return {
      level: "unknown",
      reasons: [{ key: "grey", en: lead.reasonText, bn: lead.reasonTextBn ?? lead.reasonText }],
      lead,
    };
  }
  const reasons = ranked
    .filter((cell) => cell.status === lead.status)
    .map((cell) => ({
      key: `${cell.lat},${cell.lon}`,
      en: cell.reasonText,
      bn: cell.reasonTextBn ?? cell.reasonText,
    }));
  return { level: lead.status === "red" ? "high" : lead.status === "yellow" ? "elevated" : "none", reasons, lead };
}

function trustFor(
  area: PlaceArea,
  coverage: CoverageState,
  days: number | null,
  freq: FrequencyFile | null,
  brief: Brief,
): { grade: TrustGrade; factors: TrustFactor[] } {
  const variables = area.before.variables;
  const measured = variables.filter((v) => v.slopePerDecade !== null);
  const consistent = measured.filter((v) => v.ciConsistent);
  const cellCounts = variables.filter((v) => v.cells > 0).map((v) => v.cells);
  const minCells = cellCounts.length ? Math.min(...cellCounts) : null;
  const limit = freshnessDays(brief);
  const caseCount = freq?.counts?.cases ?? 0;
  const factors: TrustFactor[] = [
    {
      key: "baseline",
      ok: area.before.spanYears >= 30,
      en: `Baseline length: ${area.before.spanYears} years (${area.before.firstYear ?? "—"}–${area.before.lastYear ?? "—"}).${area.before.spanYears >= 30 ? "" : " Thirty years is the usual climate normal."}`,
      bn: `ভিত্তি-রেকর্ডের দৈর্ঘ্য: ${area.before.spanYears} বছর (${area.before.firstYear ?? "—"}–${area.before.lastYear ?? "—"})।${area.before.spanYears >= 30 ? "" : " সাধারণ জলবায়ু-স্বাভাবিক ৩০ বছর।"}`,
    },
    {
      key: "cells",
      ok: minCells !== null && minCells >= 2,
      en:
        minCells === null
          ? "Geographic coverage: no analysis cell falls inside this boundary."
          : `Geographic coverage: ${minCells} analysis cell${minCells === 1 ? "" : "s"} at the finest grid inside the boundary${minCells === 1 ? "; a single pixel stands for the whole area." : "."}`,
      bn:
        minCells === null
          ? "ভৌগোলিক আচ্ছাদন: এই সীমানার ভেতরে কোনো বিশ্লেষণ-কোষ নেই।"
          : `ভৌগোলিক আচ্ছাদন: সীমানার ভেতরে সবচেয়ে সূক্ষ্ম গ্রিডে ${minCells}টি বিশ্লেষণ-কোষ${minCells === 1 ? "; একটি পিক্সেল পুরো এলাকার প্রতিনিধিত্ব করে।" : "।"}`,
    },
    {
      key: "age",
      ok: coverage === "live",
      en:
        coverage === "live"
          ? `Observation age: ${ageWords(days).en}; inside the ${limit}-day freshness limit.`
          : coverage === "seasonal"
            ? "Observation age: no current rain reading, so freshness cannot be graded."
            : `Observation age: ${ageWords(days).en}; older than the ${limit}-day limit.`,
      bn:
        coverage === "live"
          ? `পর্যবেক্ষণের বয়স: ${ageWords(days).bn}; ${limit} দিনের সতেজতা-সীমার ভেতরে।`
          : coverage === "seasonal"
            ? "পর্যবেক্ষণের বয়স: সাম্প্রতিক বৃষ্টির পাঠ নেই, তাই সতেজতা গ্রেড করা যায় না।"
            : `পর্যবেক্ষণের বয়স: ${ageWords(days).bn}; ${limit} দিনের সীমার চেয়ে পুরোনো।`,
    },
    {
      key: "cases",
      ok: caseCount >= 10,
      en:
        caseCount >= 10
          ? `Historical case set: ${caseCount} years with both a rain total and a catalogue query.`
          : caseCount > 0
            ? `Historical case set: ${caseCount} years; fewer than 10, so a frequency cannot stand on its own.`
            : "Historical case set: not enough historical evidence to calculate a reliable frequency.",
      bn:
        caseCount >= 10
          ? `ঐতিহাসিক নমুনা: বৃষ্টির মোট ও ক্যাটালগ-অনুসন্ধান দুটোই আছে এমন ${caseCount} বছর।`
          : caseCount > 0
            ? `ঐতিহাসিক নমুনা: ${caseCount} বছর; ১০-এর কম, তাই ফ্রিকোয়েন্সি একা দাঁড়াতে পারে না।`
            : "ঐতিহাসিক নমুনা: নির্ভরযোগ্য ফ্রিকোয়েন্সি গণনার জন্য যথেষ্ট ঐতিহাসিক প্রমাণ নেই।",
    },
    {
      key: "trend",
      ok: measured.length > 0,
      en: measured.length
        ? `Trends measurable: ${measured.length} of ${variables.length} variables${consistent.length ? `; ${consistent.length} separated from year-to-year noise.` : "; none separated from year-to-year noise, so a change cannot be told from normal variation here."}`
        : "Trends measurable: none; too few usable years inside this boundary.",
      bn: measured.length
        ? `প্রবণতা মাপা যায়: ${variables.length}টির মধ্যে ${measured.length}টি${consistent.length ? `; ${consistent.length}টি বছরে-বছরে ওঠানামা থেকে আলাদা।` : "; কোনোটি ওঠানামা থেকে আলাদা নয়, তাই পরিবর্তনকে স্বাভাবিক ওঠানামা থেকে আলাদা করা যায় না।"}`
        : "প্রবণতা মাপা যায়: কোনোটি নয়; এই সীমানার ভেতরে ব্যবহারযোগ্য বছর অল্প।",
    },
  ];
  const weak = factors.filter((factor) => !factor.ok).length;
  const grade: TrustGrade = weak === 0 ? "high" : weak === 1 ? "medium" : "low";
  return { grade, factors };
}

function frequencyFor(freq: FrequencyFile | null, observedMm: number | null): FrequencySummary {
  const minCases = freq?.intervalCases ?? 10;
  if (!freq || freq.state !== "ok" || !freq.floodsAtLeast?.length) {
    return {
      state: freq?.state === "insufficient" ? "insufficient" : "unavailable",
      reason: freq?.reason || FREQUENCY_UNKNOWN.en,
      minCases,
      level: null,
      floodsAtLeast: [],
      cases: [],
      counts: { cases: freq?.counts?.cases ?? 0, floods: freq?.counts?.floods ?? null },
      radiusKm: freq?.radiusKm ?? 150,
      product: freq?.product ?? null,
      note: freq?.note ?? null,
      fetchedAt: freq?.fetchedAt ?? null,
    };
  }
  const floodsAtLeast = freq.floodsAtLeast;
  const level =
    observedMm === null
      ? (floodsAtLeast.find((entry) => entry.cases >= minCases) ?? floodsAtLeast.at(-1) ?? null)
      : (floodsAtLeast.filter((entry) => entry.mm <= observedMm).at(0) ?? floodsAtLeast.at(-1) ?? null);
  return {
    state: "ok",
    reason: "",
    minCases,
    level,
    floodsAtLeast,
    cases: freq.cases ?? [],
    counts: { cases: freq.counts?.cases ?? 0, floods: freq.counts?.floods ?? null },
    radiusKm: freq.radiusKm ?? 150,
    product: freq.product ?? null,
    note: freq.note ?? null,
    fetchedAt: freq.fetchedAt ?? null,
  };
}

/** Country names come from the geography index; a code with no entry is shown as the code. */
function countryName(countries: { code: string; name: string; nameBn: string }[], iso: string) {
  return countries.find((country) => country.code === iso) ?? { code: iso, name: iso, nameBn: iso };
}

export function loadModel(): Promise<Model> {
  cached ??= build().catch((error) => {
    cached = null;
    throw error;
  });
  return cached;
}

async function build(): Promise<Model> {
  const [places, meta, briefFile, geography, frequencyFiles, latest] = await Promise.all([
    readJson<{ areas: PlaceArea[]; sample: boolean; generated: string }>("places.json"),
    readJson<{ measurementTime: string; generatedAt: string; product: string; sampleData: boolean }>("meta.json"),
    readJson<Omit<Brief, "sample">>("brief.json"),
    readJson<{ countries: { code: string; name: string; nameBn: string }[] }>(path.join("..", "geography", "index.json")),
    Promise.all(
      (
        await readJson<{ areas: PlaceArea[] }>("places.json")
      ).areas.map((area) => optionalJson<FrequencyFile>("frequency", `${area.id}.json`)),
    ),
    optionalJson<{ temperature?: Brief["latest"]; rainfall?: Brief["latestRain"] }>(path.join("..", "latest.json")),
  ]);
  // The readings' own `sample` flags are the source of truth. meta.json can be stale after a
  // rebuild, so take sample from the data that carries it (places + meta) rather than meta alone.
  const anySampleCell = places.areas.some((area) => area.now.cells.some((cell) => cell.sample));
  const sampleData = places.sample || meta.sampleData || anySampleCell;
  const brief: Brief = {
    ...briefFile,
    sample: sampleData,
    latest: latest?.temperature ?? briefFile.latest ?? null,
    latestRain: latest?.rainfall ?? briefFile.latestRain ?? null,
  };
  const now = Date.now();
  const frequency = new Map<string, FrequencyFile | null>();
  places.areas.forEach((area, index) => frequency.set(area.id, frequencyFiles[index]));
  const rows = places.areas.map((area) => rowFor(area, now, brief, geography.countries, frequency.get(area.id) ?? null));
  return {
    rows,
    brief,
    sample: sampleData,
    generatedAt: meta.generatedAt ?? meta.measurementTime,
    countries: geography.countries.map(({ code, name, nameBn }) => ({ code, name, nameBn })),
    counts: {
      places: rows.length,
      live: rows.filter((row) => row.coverage === "live").length,
      seasonal: rows.filter((row) => row.coverage === "seasonal").length,
      cantTell: rows.filter((row) => row.coverage === "cant-tell").length,
      adm1: rows.filter((row) => row.level === "ADM1").length,
      adm2: rows.filter((row) => row.level === "ADM2").length,
      countries: new Set(rows.map((row) => row.country)).size,
    },
  };
}

function rowFor(area: PlaceArea, now: number, brief: Brief, countries: { code: string; name: string; nameBn: string }[], freq: FrequencyFile | null): SignalRow {
  const coverage = coverageFor(area, now, brief);
  const watch = watchFor(area);
  const trust = trustFor(area, coverage.state, coverage.days, freq, brief);
  const freqSummary = frequencyFor(freq, watch.lead?.day1 ?? null);
  const country = countryName(countries, area.country);
  return {
    id: area.id,
    name: area.name,
    country: area.country,
    countryName: area.countryName,
    countryBn: country.nameBn,
    level: area.level,
    centre: area.centre,
    tile: area.tile,
    tileLabel: area.tileLabel,
    coverage: coverage.state,
    watch: coverage.state === "live" ? watch.level : "unknown",
    trust: trust.grade,
    observed: area.now.clock ?? null,
    daysOld: coverage.days,
    watchReasons: watch.reasons,
    trustFactors: trust.factors,
    coverageReason: coverage.reason,
    rain: { day1: watch.lead?.day1 ?? null, day3: watch.lead?.day3 ?? null, day7: watch.lead?.day7 ?? null },
    ratio: watch.lead?.ratio ?? null,
    percentile: watch.lead?.percentile ?? null,
    windowDays: watch.lead?.windowDays ?? null,
    sample: area.now.sample === true || area.now.cells.some((cell) => cell.sample === true),
    cells: area.now.cells.map((cell) => ({
      lat: cell.lat,
      lon: cell.lon,
      status: cell.status,
      reasonText: cell.reasonText,
      ratio: cell.ratio,
      percentile: cell.percentile,
    })),
    before: area.before.variables.map((variable) => ({
      variable: variable.variable,
      label: variable.label,
      slope: variable.slopePerDecade,
      lower: variable.lowerPerDecade,
      upper: variable.upperPerDecade,
      consistent: variable.ciConsistent,
      dataset: variable.dataset,
      unit: variable.unit,
      firstYear: area.before.firstYear,
      lastYear: area.before.lastYear,
    })),
    spanYears: area.before.spanYears,
    frequency: freqSummary,
  };
}

export function findRow(model: Model, id: string | null | undefined): SignalRow | null {
  if (!id) return null;
  return model.rows.find((row) => row.id === id) ?? null;
}

/** The area index for one country: [id, name, level, lat, lon]. No weather, no score. */
export async function readCountryIndex(iso: string): Promise<[string, string, string, number, number][] | null> {
  if (!/^[A-Z]{3}$/.test(iso)) return null;
  const payload = await optionalJson<{ areas: [string, string, string, number, number][] }>("areas", `${iso}.json`);
  return payload?.areas ?? null;
}
