// Data helpers for the place report: loading the committed global files, the numbers for one
// place, place search (Open-Meteo), and climate-twin matching. No React here.

export type Place = { name: string; detail: string; lat: number; lon: number; twin?: boolean };
export type TrendCell = [number, number, number, number]; // lat, lon, slope/decade, clear
export type FutureCell = [number, number, number | null, number, number, number]; // lat, lon, rain % (null: too dry), agree, warming C, hot-year share
export type Scenario = "ssp245" | "ssp585";
export type HotCell = [number, number, number, number, number]; // lat, lon, days above 35 °C a year: 1995–2014, 2041–60 middle road, 2041–60 high
type TwinCell = [number, number, string, number, number, number, number, number]; // lat, lon, name, 5 features

export interface Data {
  temp: TrendCell[];
  wet: TrendCell[];
  future: { models: string[]; future: [number, number]; scenarios: Record<Scenario, { cells: FutureCell[] }> };
  events: { years: { gdacs: [number, number]; landslide: [number, number] }; cells: [number, number, number, number, number, number][] };
  twins: { weights: number[]; median: number[]; scale: number[]; cells: TwinCell[] };
  /** Days above 35 °C; null if the file is missing (the report then leaves the line out). */
  hot: { thresholdC: number; cells: HotCell[] } | null;
}

export interface Report {
  temp: TrendCell | null;
  wet: TrendCell | null;
  fut: FutureCell | null;
  /** Days above 35 °C a year: today (1995–2014) and by 2041–2060 on the chosen path. */
  hot: { now: number; then: number; threshold: number } | null;
  /** Events within the radius: floods, cyclones, droughts, landslides. */
  ev: number[];
}

export const RADIUS_KM = 300;
const TWIN_MIN_KM = 1500;

const cache: { data?: Promise<Data>; tiles: Map<string, Promise<Record<string, number[]>>> } = { tiles: new Map() };

export function loadData(): Promise<Data> {
  if (!cache.data) {
    const j = (f: string) => fetch(`/data/global/${f}.json`).then((r) => r.json());
    const optional = (f: string) => j(f).catch(() => null);
    cache.data = Promise.all([j("temperature"), j("wet-season"), j("future"), j("events-grid"), j("twins-grid"), optional("hotdays")]).then(([t, w, f, e, tw, h]) => ({
      temp: t.cells,
      wet: w.cells,
      future: f,
      events: e,
      twins: tw,
      hot: h,
    }));
  }
  return cache.data;
}

/** The place's own yearly temperature series (2-degree cell), for its warming stripes. */
export function loadStripes(lat: number, lon: number): Promise<number[] | null> {
  const la = Math.round((lat - 1) / 2) * 2 + 1;
  const lo = Math.round((lon - 1) / 2) * 2 + 1;
  const tile = `${Math.floor(la / 30) * 30}_${Math.floor(lo / 30) * 30}`;
  if (!cache.tiles.has(tile)) cache.tiles.set(tile, fetch(`/data/global/stripes/${tile}.json`).then((r) => (r.ok ? r.json() : {})));
  return cache.tiles.get(tile)!.then((t) => t[`${la},${lo}`] ?? null);
}

/** Coolest and warmest year of a stripes series (values are GISTEMP anomalies vs 1951–1980). */
export function stripeKey(values: number[], first = 1981) {
  let lo = 0;
  let hi = 0;
  values.forEach((v, i) => {
    if (v < values[lo]) lo = i;
    if (v > values[hi]) hi = i;
  });
  return { coolYear: first + lo, cool: values[lo], warmYear: first + hi, warm: values[hi] };
}

export function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** The nearest land cell within `maxKm`, or null (sea, ice, or outside 55°S–75°N). */
function nearest<C extends unknown[]>(cells: C[], lat: number, lon: number, maxKm = 250): C | null {
  let best: C | null = null;
  let bestD = maxKm;
  for (const c of cells) {
    const cl = c[0] as number;
    if (Math.abs(cl - lat) > 4) continue;
    const d = km(lat, lon, cl, c[1] as number);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function computeReport(place: Place, data: Data, scenario: Scenario): Report {
  const ev = [0, 0, 0, 0];
  for (const c of data.events.cells) {
    if (Math.abs(c[0] - place.lat) > 4) continue;
    if (km(place.lat, place.lon, c[0], c[1]) <= RADIUS_KM) for (let k = 0; k < 4; k++) ev[k] += c[2 + k];
  }
  const h = data.hot ? nearest(data.hot.cells, place.lat, place.lon) : null;
  return {
    temp: nearest(data.temp, place.lat, place.lon),
    wet: nearest(data.wet, place.lat, place.lon),
    fut: nearest(data.future.scenarios[scenario].cells, place.lat, place.lon),
    hot: h && data.hot ? { now: h[2], then: scenario === "ssp245" ? h[3] : h[4], threshold: data.hot.thresholdC } : null,
    ev,
  };
}

/**
 * The place elsewhere on Earth (more than 1,500 km away) whose 1981–2025 climate change is most like
 * this one: warming, yearly and rainy-season rain trends, how wet and how seasonal, robustly
 * standardised and weighted exactly as in analysis/twins.py. Null if the place has no land cell.
 */
export function findTwin(place: Place, data: Data): Place | null {
  const { weights, median, scale, cells } = data.twins;
  const own = nearest(cells, place.lat, place.lon, 300);
  if (!own) return null;
  const z = (c: TwinCell) => [3, 4, 5, 6, 7].map((k, i) => Math.max(-4, Math.min(4, ((c[k] as number) - median[i]) / scale[i])) * weights[i]);
  const zo = z(own);
  let best: TwinCell | null = null;
  let bestD = Infinity;
  for (const c of cells) {
    if (km(place.lat, place.lon, c[0], c[1]) < TWIN_MIN_KM) continue;
    const zc = z(c);
    const d = zc.reduce((s, v, i) => s + (v - zo[i]) ** 2, 0);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best ? { name: best[2], detail: "", lat: best[0], lon: best[1], twin: true } : null;
}

export async function geocode(name: string, lang: "en" | "bn"): Promise<Place[]> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=${lang}&format=json`);
  const j = await r.json();
  return (j.results ?? []).map((p: { name: string; country?: string; admin1?: string; latitude: number; longitude: number }) => ({
    name: p.name,
    detail: [p.admin1, p.country].filter(Boolean).join(", "),
    lat: p.latitude,
    lon: p.longitude,
  }));
}

/** "+1.5" / "−2": a true minus sign, no sign on zero. */
export const signed = (v: number, d: number) => {
  const t = Math.abs(v).toFixed(d);
  return Number(t) === 0 ? t : `${v > 0 ? "+" : "−"}${t}`;
};
