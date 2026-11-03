// Colours for the "difference between two dates" view. Plain data (no Leaflet), shared by the map
// layer that paints the difference and by its colour key.

export type DiffKind = "temp" | "rain" | "green" | "soil";
type RGB = [number, number, number];

/** Full-strength colours for "less" and "more", per colour scheme. */
export const DIFF_ENDS: Record<DiffKind, { less: RGB; more: RGB }> = {
  temp: { less: [33, 102, 172], more: [178, 24, 43] },
  rain: { less: [140, 81, 10], more: [33, 102, 172] },
  green: { less: [140, 81, 10], more: [27, 120, 55] },
  // Soil water uses the rain palette so the two moisture variables read the same way.
  soil: { less: [140, 81, 10], more: [33, 102, 172] },
};

export function hexToRgb(hex: string): RGB {
  const h = hex.trim().replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [200, 200, 200];
}
