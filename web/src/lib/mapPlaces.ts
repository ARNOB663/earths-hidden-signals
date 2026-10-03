import type { Geometry } from "geojson";
import type { TrendSummary } from "./trends";

export interface PlaceSignal {
  years: number[];
  series: (number | null)[];
  trend: TrendSummary | null;
  unit: string;
  baseline: string | null;
  source: string;
  gridDegrees: number;
  cells: number | null;
}
export interface MapPlace {
  id: string;
  name: string;
  type: "country" | "region";
  countryCode?: string;
  bounds: [[number, number], [number, number]];
  geometry: Geometry;
  signals: { temperature: PlaceSignal | null; rainfall: PlaceSignal | null };
}
export interface MapPlaceData { generated: string; method: string; places: MapPlace[] }
