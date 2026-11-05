// The map's boundary outlines, written by scripts/signals/place.py into signals/places-map/.
// Server-side only: the outlines are simplified to 0.1° and dropped to 90 points per ring, which
// keeps 422 boundaries light enough to draw in one canvas.

import { readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "data", "signals", "places-map");

export interface MapOutline {
  id: string;
  name: string;
  level: "ADM1" | "ADM2";
  rings: [number, number][][];
  /** True when the boundary is smaller than the outline resolution and is drawn as one cell. */
  marker?: boolean;
}

export interface MapBundle {
  areas: Record<string, MapOutline>;
  tiles: Record<string, { label: string; south: number; north: number; west: number; east: number }>;
}

export async function readMapAreas(): Promise<MapBundle> {
  let index: { countries: string[]; tiles: string[] } = { countries: [], tiles: [] };
  try {
    index = JSON.parse(await readFile(path.join(DIR, "index.json"), "utf8")) as { countries: string[]; tiles: string[] };
  } catch {
    return { areas: {}, tiles: {} };
  }
  const areas: Record<string, MapOutline> = {};
  const tiles: MapBundle["tiles"] = {};
  await Promise.all(
    index.countries.map(async (iso) => {
      try {
        const payload = JSON.parse(await readFile(path.join(DIR, `${iso}.json`), "utf8")) as {
          areas: MapOutline[];
          tiles: { id: string; label: string; ring: [number, number][] }[];
        };
        for (const area of payload.areas) areas[area.id] = area;
        for (const tile of payload.tiles ?? []) {
          const lons = tile.ring.map(([lon]) => lon);
          const lats = tile.ring.map(([, lat]) => lat);
          tiles[tile.id] = {
            label: tile.label,
            south: Math.min(...lats),
            north: Math.max(...lats),
            west: Math.min(...lons),
            east: Math.max(...lons),
          };
        }
      } catch {
        // A country without a written outline simply draws no boundary.
      }
    }),
  );
  return { areas, tiles };
}
