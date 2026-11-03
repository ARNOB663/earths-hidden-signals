// Countries with data in this project: a polygon, an ISO code and the area-weighted
// annual series produced by analysis/build_country_signals.py. Nothing here is invented:
// a country appears only because south-asia-boundaries.json and place-signals.json contain it.

import { slug } from "./download";
import { COUNTRY_BN } from "./names";
import type { TrendSummary } from "./trends";

export interface CountrySignal {
  years: number[];
  series: number[];
  trend: TrendSummary | null;
  unit: string;
  source: string;
  baseline: string | null;
  gridDegrees: number;
  cells: number | null;
}

export interface CountryGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface Country {
  code: string;
  slug: string;
  name: string;
  nameBn: string;
  /** ISO 3166-1 alpha-2, for the flag image. */
  flag: string;
  /** [[south lat, west lon], [north lat, east lon]] */
  bounds: [[number, number], [number, number]];
  center: [number, number];
  geometry: CountryGeometry;
  signals: Record<string, CountrySignal | null>;
}

export interface PlaceSignals {
  generated: string;
  method: string;
  places: {
    id: string;
    name: string;
    type: "country" | "region";
    countryCode?: string;
    bounds: [[number, number], [number, number]];
    geometry: CountryGeometry;
    signals: Record<string, CountrySignal | null>;
  }[];
}

/** The alpha-2 code each country's flag is drawn from. */
const FLAGS: Record<string, string> = {
  BGD: "bd",
  BTN: "bt",
  IND: "in",
  NPL: "np",
  PAK: "pk",
  LKA: "lk",
};

function toCountry(place: PlaceSignals["places"][number]): Country {
  const [[south, west], [north, east]] = place.bounds;
  return {
    code: place.countryCode!,
    slug: slug(place.name),
    name: place.name,
    nameBn: COUNTRY_BN[place.name] ?? place.name,
    flag: FLAGS[place.countryCode!] ?? "",
    bounds: place.bounds,
    center: [(south + north) / 2, (west + east) / 2],
    geometry: place.geometry,
    signals: Object.fromEntries(
      Object.entries(place.signals).filter(([, v]) => v !== null),
    ) as Record<string, CountrySignal>,
  };
}

/** Every country the datasets cover, sorted by name. */
export function countriesFrom(data: PlaceSignals): Country[] {
  return data.places
    .filter((p) => p.type === "country")
    .map(toCountry)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function countryBySlug(countries: Country[], value: string): Country | undefined {
  return countries.find((c) => c.slug === value);
}

/** The seasons and measures a country page can plot, in display order. */
export const COUNTRY_TREND_KEYS = {
  temperature: ["temperature_annual", "temperature_pre-monsoon", "temperature_monsoon"],
  rainfall: ["rainfall_annual", "rainfall_pre-monsoon", "rainfall_monsoon"],
  extremes: ["hot-months_annual", "dry-spell_annual", "heavy-rain_annual", "wettest-day_annual"],
} as const;
