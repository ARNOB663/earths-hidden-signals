// Builds a "place report" (trends + nearby disasters for one city) from the precomputed JSON.
// Runs on the server at build time.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FireGrid, FloodEvent, HazardZone, LandslideEvent } from "./hazards";
import { distanceKm, type Place } from "./places";
import { cellAt, cellCenter, type GridSpec, type Manifest, type SeriesGrid, type TrendGrid, type TrendSummary } from "./trends";

const cache = new Map<string, Promise<unknown>>();
function readData<T>(...parts: string[]): Promise<T> {
  const file = path.join(process.cwd(), "public", "data", ...parts);
  if (!cache.has(file)) cache.set(file, readFile(file, "utf-8").then((t) => JSON.parse(t)));
  return cache.get(file) as Promise<T>;
}

export interface PlaceTrend {
  trend: TrendSummary;
  series: (number | null)[];
  mean: number | null;
  /** Passed the map-wide significance check. */
  clear: boolean;
  /** The map square used, and how far its centre is from the place. */
  cellLat: number;
  cellLon: number;
  km: number;
}

export interface PlaceReport {
  place: Place;
  temperature: { annual: PlaceTrend | null; hot: PlaceTrend | null };
  rain: { annual: PlaceTrend | null; monsoon: PlaceTrend | null };
  zones: HazardZone[];
  landslides: { count: number; deaths: number; deadliest: LandslideEvent | null; radiusKm: number };
  floods: { count: number; severe: number; latest: FloodEvent | null; radiusKm: number };
  firesPerYear: number | null;
}

/** The land square covering the place, or the nearest land square around it (coasts, islands). */
function landCell(grid: GridSpec, stats: TrendGrid, lat: number, lon: number): number | null {
  const c = cellAt(grid, lat, lon);
  if (!c) return null;
  let best: { k: number; d: number } | null = null;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const i = c.i + di;
      const j = c.j + dj;
      if (i < 0 || j < 0 || i >= grid.nLat || j >= grid.nLon) continue;
      const k = i * grid.nLon + j;
      if (stats.slopePerDecade[k] === null) continue;
      const { lat: la, lon: lo } = cellCenter(grid, i, j);
      const d = distanceKm(lat, lon, la, lo) + (di === 0 && dj === 0 ? 0 : 1e-6);
      if (!best || d < best.d) best = { k, d };
    }
  }
  return best?.k ?? null;
}

async function placeTrend(grid: GridSpec, key: string, place: Place): Promise<PlaceTrend | null> {
  const [stats, series] = await Promise.all([
    readData<TrendGrid>("trends", `${key}.json`),
    readData<SeriesGrid>("trends", `${key}_series.json`),
  ]);
  const k = landCell(grid, stats, place.lat, place.lon);
  if (k === null || !series[k]) return null;
  const { lat, lon } = cellCenter(grid, Math.floor(k / grid.nLon), k % grid.nLon);
  return {
    trend: {
      slopePerDecade: stats.slopePerDecade[k]!,
      lowerPerDecade: stats.lowerPerDecade[k]!,
      upperPerDecade: stats.upperPerDecade[k]!,
      p: stats.p[k]!,
    },
    series: series[k]!,
    mean: stats.mean[k],
    clear: stats.significant[k] === 1,
    cellLat: lat,
    cellLon: lon,
    km: Math.round(distanceKm(place.lat, place.lon, lat, lon)),
  };
}

export async function buildPlaceReport(place: Place): Promise<PlaceReport> {
  const [manifest, hazardZones, slides, floods, fires] = await Promise.all([
    readData<Manifest>("trends", "manifest.json"),
    readData<{ zones: HazardZone[] }>("hazards", "zones.json").then((d) => d.zones),
    readData<LandslideEvent[]>("hazards", "landslides.json"),
    readData<FloodEvent[]>("hazards", "floods.json"),
    readData<FireGrid>("hazards", "fires_grid.json"),
  ]);
  const t = manifest.grids.temperature;
  const r = manifest.grids.rainfall;
  const [tAnnual, tHot, rAnnual, rMonsoon] = await Promise.all([
    placeTrend(t, "temperature_annual", place),
    placeTrend(t, "temperature_pre-monsoon", place),
    placeTrend(r, "rainfall_annual", place),
    placeTrend(r, "rainfall_monsoon", place),
  ]);

  const near = <T extends { lat: number; lon: number }>(list: T[], km: number) =>
    list.filter((e) => distanceKm(place.lat, place.lon, e.lat, e.lon) <= km);
  const slideRadius = 100;
  const nearSlides = near(slides, slideRadius);
  const floodRadius = 150;
  const nearFloods = near(floods, floodRadius);
  const fireCell = fires.cells.find(
    ([la, lo]) => Math.abs(la - place.lat) <= fires.cell / 2 && Math.abs(lo - place.lon) <= fires.cell / 2,
  );

  return {
    place,
    temperature: { annual: tAnnual, hot: tHot },
    rain: { annual: rAnnual, monsoon: rMonsoon },
    zones: hazardZones.filter(
      (z) => place.lat >= z.bbox[0] && place.lat <= z.bbox[1] && place.lon >= z.bbox[2] && place.lon <= z.bbox[3],
    ),
    landslides: {
      count: nearSlides.length,
      deaths: nearSlides.reduce((a, e) => a + (e.fatalities ?? 0), 0),
      deadliest: nearSlides.reduce<LandslideEvent | null>(
        (best, e) => ((e.fatalities ?? 0) > (best?.fatalities ?? 0) ? e : best),
        null,
      ),
      radiusKm: slideRadius,
    },
    floods: {
      count: nearFloods.length,
      severe: nearFloods.filter((e) => e.alert === "Red" || e.alert === "Orange").length,
      latest: nearFloods.at(-1) ?? null,
      radiusKm: floodRadius,
    },
    firesPerYear: fireCell ? fireCell[2] : null,
  };
}
