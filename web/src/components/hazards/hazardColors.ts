// Colour tokens for hazard events (CSS variables, so they follow the light/dark theme).
// Kept free of Leaflet so server-rendered UI can import it.

export const EVENT_TOKEN = {
  flood: "--ev-flood",
  landslide: "--ev-landslide",
  wildfire: "--ev-fire",
  cyclone: "--ev-cyclone",
} as const;

/** Flood alert levels are a status scale: fixed status colours, always shown with a text label. */
export const FLOOD_ALERT_COLORS: Record<string, string> = { Green: "#0ca30c", Orange: "#fab219", Red: "#e34948" };

// Cells with under 10 fire detections a year are left off so the busy fire belts stand out.
export const FIRE_BREAKS = [10, 30, 100, 250, 500];

/** Colour token for a cell's average yearly fire count (one-hue orange ramp), or null if too few. */
export function fireToken(avg: number): string | null {
  let token: string | null = null;
  FIRE_BREAKS.forEach((b, i) => {
    if (avg >= b) token = `--fire-${i + 1}`;
  });
  return token;
}
