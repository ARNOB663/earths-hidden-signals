// Builds a country dashboard from the committed JSON: area-weighted country series from
// analysis/build_country_signals.py, hazard-region results from build_hazards.py, and the
// event records the site already shows. Runs on the server at build time.
//
// Nothing here estimates a value that is not in the data. A section whose dataset does not
// cover the country reports "not available" rather than a placeholder number.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { boxOverlap, pointInCountry } from "./geo";
import {
  type CycloneTrack,
  type FireGrid,
  type FloodEvent,
  type HazardId,
  type HazardZone,
  type LandslideEvent,
} from "./hazards";
import type { Country, CountrySignal } from "./countries";
import { PLACES, type Place } from "./places";
import { formatSigned, type TrendSummary } from "./trends";

const cache = new Map<string, Promise<unknown>>();
function readData<T>(...parts: string[]): Promise<T> {
  const file = path.join(process.cwd(), "public", "data", ...parts);
  if (!cache.has(file)) cache.set(file, readFile(file, "utf-8").then((t) => JSON.parse(t)));
  return cache.get(file) as Promise<T>;
}

/** How much of the country a hazard region must cover to count as part of it. */
const REGION_SHARE = 0.02;
/** Marine regions are listed only when they touch a sizeable part of the country. */
const SEA_REGION_SHARE = 0.1;
const SEA_REGIONS = new Set(["bay-of-bengal", "arabian-sea"]);

export interface CountryRegion {
  zone: HazardZone;
  /** Share of the country's area inside the region (0–1). */
  countryShare: number;
  trends: Record<string, TrendSummary | null>;
  cities: Place[];
}

export interface CountryHazard {
  id: HazardId;
  zones: CountryRegion[];
  events: {
    label: string;
    source: string;
    period: string;
    count: number | null;
    severe?: number;
    deaths?: number;
    latest: string | null;
    unit: string;
  };
}

export interface CountryCity {
  place: Place;
  temperature: CountrySignal | null;
  rainfall: CountrySignal | null;
}

export interface CountryReport {
  country: Country;
  generated: string;
  years: [number, number];
  temperature: CountrySignal | null;
  rainfall: CountrySignal | null;
  signals: Record<string, CountrySignal | null>;
  hazards: CountryHazard[];
  regions: CountryRegion[];
  cities: CountryCity[];
  extremes: { hottestYear: [number, number] | null; wettestYear: [number, number] | null };
  fires: { perYear: number; period: [number, number] } | null;
  findings: string[];
}

const hazardZoneOf = (z: HazardZone) => z.hazard;

function inCountry(country: Country, lat: number, lon: number): boolean {
  return pointInCountry(country.geometry, lat, lon);
}

/** Year of the largest (or smallest) value in a country series. */
function extremeYear(signal: CountrySignal | null, pick: "max" | "min"): [number, number] | null {
  if (!signal) return null;
  let best: [number, number] | null = null;
  signal.series.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    if (!best || (pick === "max" ? v > best[1] : v < best[1])) best = [signal.years[i], v];
  });
  return best;
}

export async function buildCountryReport(country: Country): Promise<CountryReport> {
  const [hazardZones, trendZones, manifest, landslides, floods, cyclones, fires] = await Promise.all([
    readData<{ zones: HazardZone[] }>("hazards", "zones.json").then((d) => d.zones),
    readData<{ zones: { id: string; results: Record<string, { series: number[]; mean: number; trend: TrendSummary | null }> }[] }>(
      "trends",
      "zones.json",
    ),
    readData<{ generated: string }>("trends", "manifest.json"),
    readData<LandslideEvent[]>("hazards", "landslides.json"),
    readData<FloodEvent[]>("hazards", "floods.json"),
    readData<CycloneTrack[]>("hazards", "cyclones.json"),
    readData<FireGrid>("hazards", "fires_grid.json"),
  ]);
  const generated = manifest.generated;

  const temperature = country.signals["temperature_annual"] ?? null;
  const rainfall = country.signals["rainfall_annual"] ?? null;
  const years = (temperature ?? rainfall)?.years ?? [];

  // Cities: listed places inside the country polygon.
  const citiesOfCountry = PLACES.filter((p) => inCountry(country, p.lat, p.lon));

  // Regions: the ecological hazard boxes that overlap this country.
  const regions: CountryRegion[] = hazardZones
    .filter((z) => z.id !== "study-area")
    .map((z) => ({ z, share: boxOverlap(country.geometry, z.bbox) }))
    .filter((x) => x.share >= (SEA_REGIONS.has(x.z.id) ? SEA_REGION_SHARE : REGION_SHARE))
    .map(({ z, share }) => ({
      zone: z,
      countryShare: share,
      // Region trends are the region's own published results (build.py), not the country's.
      trends: Object.fromEntries(
        Object.entries(trendZones.zones.find((t) => t.id === z.id)?.results ?? {}).map(([k, r]) => [k, r.trend]),
      ),
      cities: citiesOfCountry.filter(
        (p) => p.lat >= z.bbox[0] && p.lat <= z.bbox[1] && p.lon >= z.bbox[2] && p.lon <= z.bbox[3],
      ),
    }))
    .sort((a, b) => b.countryShare - a.countryShare);

  const zonesOf = (hazard: HazardId) => regions.filter((r) => hazardZoneOf(r.zone) === hazard);

  // Event records, counted inside the country polygon (not a bounding box).
  const floodEvents = floods.filter((e) => inCountry(country, e.lat, e.lon));
  const slideEvents = landslides.filter((e) => inCountry(country, e.lat, e.lon));
  // A cyclone belongs to a country when its track passes over or very near the land.
  const nearCoast = (lat: number, lon: number) => {
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) if (inCountry(country, lat + i * 0.75, lon + j * 0.75)) return true;
    }
    return false;
  };
  const cycloneEvents = cyclones.filter((c) => c.points.some(([lat, lon]) => nearCoast(lat, lon)));
  const fireCells = fires.cells.filter(([lat, lon]) => inCountry(country, lat, lon));
  const fireYears = fires.years;
  const firePerYear = fireCells.length
    ? fireCells.reduce((a, [, , v]) => a + v, 0) / (fireYears[1] - fireYears[0] + 1)
    : null;

  const fatal = slideEvents.reduce((a, e) => a + (e.fatalities ?? 0), 0);
  const latestOf = (dates: string[]) => (dates.length ? dates.sort().at(-1)! : null);

  const hazards: CountryHazard[] = [
    {
      id: "flood",
      zones: zonesOf("flood"),
      events: {
        label: "Flood alerts",
        source: "GDACS flood alerts (UN/EU), all months",
        period: "2000–2025",
        count: floodEvents.length,
        severe: floodEvents.filter((e) => e.alert === "Red").length,
        latest: latestOf(floodEvents.map((e) => e.date)),
        unit: "alerts",
      },
    },
    {
      id: "cyclone",
      zones: zonesOf("cyclone"),
      events: {
        label: "Cyclone tracks passing the country",
        source: "IBTrACS/WMO best-track archive, via the project's cyclone data",
        period: "1981–2025",
        count: cycloneEvents.length,
        severe: cycloneEvents.filter((c) => c.maxWind >= 64).length,
        latest: latestOf(cycloneEvents.map((c) => String(c.year))),
        unit: "cyclones",
      },
    },
    {
      id: "landslide",
      zones: zonesOf("landslide"),
      events: {
        label: "Reported landslides",
        source: "NASA Global Landslide Catalog",
        period: "2007–2017",
        count: slideEvents.length,
        deaths: fatal,
        latest: latestOf(slideEvents.map((e) => e.date)),
        unit: "landslides",
      },
    },
    {
      id: "wildfire",
      zones: zonesOf("wildfire"),
      events: {
        label: "Fire detections per year (March–May)",
        source: "NASA FIRMS, MODIS Terra + Aqua",
        period: `${fireYears[0]}–${fireYears[1]}`,
        count: firePerYear === null ? null : Math.round(firePerYear),
        latest: null,
        unit: "detections / year",
      },
    },
  ];

  return {
    country,
    generated,
    years: years.length ? [years[0], years[years.length - 1]] : [0, 0],
    temperature,
    rainfall,
    signals: country.signals,
    hazards,
    regions,
    cities: citiesOfCountry.map((place) => ({
      place,
      temperature,
      rainfall,
    })),
    extremes: {
      hottestYear: extremeYear(temperature, "max"),
      wettestYear: extremeYear(rainfall, "max"),
    },
    fires: firePerYear === null ? null : { perYear: firePerYear, period: fireYears },
    findings: buildFindings(country, { temperature, rainfall, signals: country.signals, regions, hazards, fireCells: fireCells.length }),
  };
}

const pctPerDecade = (s: CountrySignal | null) => {
  if (!s?.trend) return null;
  const mean = s.series.reduce((a, v) => a + v, 0) / s.series.length;
  return mean ? (s.trend.slopePerDecade / mean) * 100 : null;
};

/** Key findings, each one traceable to a value on this page. */
function buildFindings(
  country: Country,
  d: {
    temperature: CountrySignal | null;
    rainfall: CountrySignal | null;
    signals: Record<string, CountrySignal | null>;
    regions: CountryRegion[];
    hazards: CountryHazard[];
    fireCells: number;
  },
): string[] {
  const out: string[] = [];
  const t = d.temperature;
  if (t?.trend) {
    const change = (t.trend.slopePerDecade * (t.years.at(-1)! - t.years[0])) / 10;
    out.push(
      t.trend.p < 0.05
        ? `Annual temperature rose by about ${formatSigned(change, 1)} °C between ${t.years[0]} and ${t.years.at(-1)} (${formatSigned(t.trend.slopePerDecade, 2)} °C per decade, statistically significant).`
        : `Annual temperature shows no statistically detectable trend in ${t.years[0]}–${t.years.at(-1)}.`,
    );
  }
  const rain = d.rainfall;
  const rainPct = pctPerDecade(rain);
  if (rain?.trend && rainPct !== null) {
    out.push(
      rain.trend.p < 0.05
        ? `Annual rainfall is ${rainPct > 0 ? "rising" : "falling"} by about ${Math.abs(rainPct).toFixed(0)}% per decade.`
        : `Annual rainfall shows no statistically detectable trend; the estimate is ${formatSigned(rainPct, 0)}% per decade.`,
    );
  }
  const hot = d.signals["hot-months_annual"];
  if (hot?.trend) {
    out.push(
      hot.trend.p < 0.05
        ? `Very hot months (at least 1 °C above the 1951–1980 normal) increased by ${formatSigned(hot.trend.slopePerDecade, 1)} per decade.`
        : `Very hot months show no statistically detectable trend.`,
    );
  }
  const dry = d.signals["dry-spell_annual"];
  if (dry?.trend && dry.trend.p < 0.05) {
    out.push(
      `The longest monsoon dry spell is ${dry.trend.slopePerDecade > 0 ? "lengthening" : "shortening"} by ${Math.abs(dry.trend.slopePerDecade).toFixed(1)} days per decade.`,
    );
  }
  const top = d.regions.filter((r) => r.zone.hazard).sort((a, b) => b.countryShare - a.countryShare)[0];
  if (top) {
    out.push(
      `${top.zone.name} overlaps about ${Math.round(top.countryShare * 100)}% of ${country.name} and is the country's main ${top.zone.hazard} region in these datasets.`,
    );
  }
  const floods = d.hazards.find((h) => h.id === "flood");
  if (floods?.events.count) {
    out.push(
      `GDACS recorded ${floods.events.count} flood alerts inside ${country.name} since 2000${floods.events.severe ? `, ${floods.events.severe} at red alert` : ""}.`,
    );
  }
  const slides = d.hazards.find((h) => h.id === "landslide");
  if (slides?.events.count) {
    out.push(`The Global Landslide Catalog lists ${slides.events.count} landslides in ${country.name} between 2007 and 2017.`);
  }
  if (d.fireCells === 0) {
    out.push("The fire dataset has no 0.5° cells inside this country, so wildfire exposure is not assessed here.");
  }
  return out;
}
