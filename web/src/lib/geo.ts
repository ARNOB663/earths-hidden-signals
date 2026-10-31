// Geometry helpers for country pages, in plain TypeScript so the server (build time) and
// the browser can both use them without a geospatial dependency.

import type { CountryGeometry } from "./countries";

type Ring = [number, number][];

function polygons(geometry: CountryGeometry): Ring[][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as Ring[]];
  return geometry.coordinates as Ring[][];
}

/** Ray casting against every exterior ring; holes are ignored, which is fine at 2° scale. */
export function pointInCountry(geometry: CountryGeometry, lat: number, lon: number): boolean {
  for (const rings of polygons(geometry)) {
    const ring = rings[0];
    if (!ring) continue;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

/** Share of the country's own area that a box [latMin, latMax, lonMin, lonMax] covers (0–1). */
export function boxOverlap(
  geometry: CountryGeometry,
  box: [number, number, number, number],
  step = 0.2,
): number {
  const [south, north, west, east] = box;
  const [[s0, w0], [n0, e0]] = geometryBounds(geometry);
  let inside = 0;
  let total = 0;
  for (let lat = s0 + step / 2; lat < n0; lat += step) {
    const weight = Math.cos((lat * Math.PI) / 180);
    for (let lon = w0 + step / 2; lon < e0; lon += step) {
      if (!pointInCountry(geometry, lat, lon)) continue;
      total += weight;
      if (lat >= south && lat <= north && lon >= west && lon <= east) inside += weight;
    }
  }
  return total ? inside / total : 0;
}

export function geometryBounds(geometry: CountryGeometry): [[number, number], [number, number]] {
  let s = 90;
  let w = 180;
  let n = -90;
  let e = -180;
  for (const rings of polygons(geometry)) {
    for (const [lon, lat] of rings[0] ?? []) {
      s = Math.min(s, lat);
      n = Math.max(n, lat);
      w = Math.min(w, lon);
      e = Math.max(e, lon);
    }
  }
  return [
    [s, w],
    [n, e],
  ];
}
