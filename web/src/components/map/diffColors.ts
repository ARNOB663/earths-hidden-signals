// Colours for the "difference between two dates" view. Plain data (no Leaflet), shared by the map
// layer that paints the difference and by its colour key.

export type DiffKind = "temp" | "rain" | "green";
type RGB = [number, number, number];

/** Full-strength colours for "less" and "more", per colour scheme. */
export const DIFF_ENDS: Record<DiffKind, { less: RGB; more: RGB }> = {
  temp: { less: [33, 102, 172], more: [178, 24, 43] },
  rain: { less: [140, 81, 10], more: [33, 102, 172] },
  green: { less: [140, 81, 10], more: [27, 120, 55] },
};

/** What "less" and "more" mean for each scheme, in English and Bangla. */
export const DIFF_WORDS: Record<DiffKind, { less: [string, string]; more: [string, string] }> = {
  temp: { less: ["Colder", "ঠান্ডা"], more: ["Hotter", "গরম"] },
  rain: { less: ["Drier", "শুষ্ক"], more: ["Wetter", "ভেজা"] },
  green: { less: ["Less green", "কম সবুজ"], more: ["Greener", "বেশি সবুজ"] },
};

export function hexToRgb(hex: string): RGB {
  const h = hex.trim().replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [200, 200, 200];
}

/** CSS gradient for the colour key: "less" on the left, no change in the middle, "more" on the right. */
export function diffGradient(kind: DiffKind, mid: string): string {
  const { less, more } = DIFF_ENDS[kind];
  return `linear-gradient(to right, rgb(${less.join(",")}), ${mid}, rgb(${more.join(",")}))`;
}
