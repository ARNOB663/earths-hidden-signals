// A tiny static trend raster for the Signals map: one tightly packed RGB image plus a separate
// alpha mask, drawn through Leaflet's image overlay so it sits under the Esri labels like any
// other data layer. The data is the analysis pipeline's own Sen slope (web/public/data/trends),
// resampled onto a 0.5° grid by scripts/signals/build_south_asia.py and coloured by a fixed ramp
// that travels with the file, so the legend can never describe colours the file does not use.

import L from "leaflet";

export interface RasterMeta {
  variable: string;
  season: string;
  label: string;
  labelBn: string;
  unit: string;
  range: [number, number];
  legend: { at: number; rgb: [number, number, number] }[];
  lat0: number;
  lon0: number;
  dLat: number;
  dLon: number;
  nLat: number;
  nLon: number;
  yearFirst: number;
  yearLast: number;
  slopeDecimals: number;
  updated: string;
}

export const RASTER_BASE = "/data/signals/south-asia";

export interface RasterIndex {
  default: string;
  variables: { key: string; label: string; labelBn: string }[];
}

/** The raster's own index: which variables exist, read from the files the build wrote. */
export async function loadRasterIndex(signal?: AbortSignal): Promise<RasterIndex> {
  const response = await fetch(`${RASTER_BASE}/index.json`, { signal });
  if (!response.ok) throw new Error("raster index unavailable");
  return (await response.json()) as RasterIndex;
}

export async function loadRasterMeta(key: string, signal?: AbortSignal): Promise<RasterMeta> {
  const response = await fetch(`${RASTER_BASE}/${key}.json`, { signal });
  if (!response.ok) throw new Error("raster metadata unavailable");
  return (await response.json()) as RasterMeta;
}


/** Decode the packed bytes into an RGBA PNG the browser and the canvas can draw. */
export async function loadRaster(meta: RasterMeta, signal?: AbortSignal): Promise<string> {
  const base = `${RASTER_BASE}/${meta.variable}_${meta.season}`;
  const [rgbResponse, alphaResponse] = await Promise.all([
    fetch(`${base}.rgb`, { signal }),
    fetch(`${base}.alpha`, { signal }),
  ]);
  if (!rgbResponse.ok || !alphaResponse.ok) throw new Error("raster unavailable");
  const rgb = new Uint8Array(await rgbResponse.arrayBuffer());
  const alpha = new Uint8Array(await alphaResponse.arrayBuffer());
  const count = meta.nLat * meta.nLon;
  if (rgb.length !== count * 3 || alpha.length !== count) throw new Error("raster size mismatch");

  // Decode the packed rows (south edge first) into a small image; Leaflet puts an image's first
  // row on the north edge of its bounds, so flip once here.
  const small = document.createElement("canvas");
  small.width = meta.nLon;
  small.height = meta.nLat;
  const smallContext = small.getContext("2d");
  if (!smallContext) throw new Error("no canvas");
  const image = smallContext.createImageData(meta.nLon, meta.nLat);
  for (let y = 0; y < meta.nLat; y += 1) {
    const src = (meta.nLat - 1 - y) * meta.nLon;
    const dst = y * meta.nLon;
    for (let x = 0; x < meta.nLon; x += 1) {
      const i = src + x;
      const o = (dst + x) * 4;
      image.data[o] = rgb[i * 3];
      image.data[o + 1] = rgb[i * 3 + 1];
      image.data[o + 2] = rgb[i * 3 + 2];
      image.data[o + 3] = alpha[i];
    }
  }
  smallContext.putImageData(image, 0, 0);

  // Drawn at the pipeline's own resolution: each cell is the size of a real analysis cell, and a
  // smooth field over a 2° grid would be false precision.
  return small.toDataURL("image/png");
}

export function rasterBounds(meta: RasterMeta): L.LatLngBounds {
  const south = meta.lat0;
  const west = meta.lon0;
  const north = meta.lat0 + meta.nLat * meta.dLat;
  const east = meta.lon0 + meta.nLon * meta.dLon;
  return L.latLngBounds([south, west], [north, east]);
}

/** Colour for a value, interpolated between the file's own legend stops. */
export function rampColor(meta: RasterMeta, value: number): string {
  const [low, high] = meta.range;
  const t = Math.min(100, Math.max(0, ((value - low) / (high - low || 1)) * 100));
  for (let i = 0; i < meta.legend.length - 1; i += 1) {
    const a = meta.legend[i];
    const b = meta.legend[i + 1];
    if (t >= a.at && t <= b.at) {
      const f = b.at === a.at ? 0 : (t - a.at) / (b.at - a.at);
      const mix = a.rgb.map((channel, index) => Math.round(channel + (b.rgb[index] - channel) * f));
      return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
    }
  }
  const last = meta.legend[meta.legend.length - 1];
  return `rgb(${last.rgb[0]}, ${last.rgb[1]}, ${last.rgb[2]})`;
}

export function createRasterOverlay(url: string, meta: RasterMeta, opacity: number): L.ImageOverlay {
  return L.imageOverlay(url, rasterBounds(meta), {
    pane: "dataRaster",
    opacity,
    interactive: false,
    // Nearest-neighbour: keep each cell's edges, so the grid stays visible as what it is.
    className: "signals-raster",
    alt: `${meta.label}, ${meta.yearFirst}–${meta.yearLast}`,
  });
}
