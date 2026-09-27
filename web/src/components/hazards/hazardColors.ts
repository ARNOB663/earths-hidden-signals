// Event colours for the hazard map and its key. Kept free of Leaflet so server-rendered UI can import it.

// Flood alert levels are a status scale, so they use the reserved status colours (with a text label).
export const FLOOD_ALERT_COLORS: Record<string, string> = { Green: "#0ca30c", Orange: "#fab219", Red: "#e34948" };
export const LANDSLIDE_COLOR = "#eda100";
// One-hue sequential ramp (orange). On the dark map, few fires stay dark and many fires glow brightest.
const FIRE_STEPS = ["#a63b12", "#d95926", "#f4843f", "#f9b27c", "#fde0c5"];
// Cells with under 10 detections a year are left off so the busy fire belts stand out.
export const FIRE_BREAKS = [10, 30, 100, 250, 500];

export function fireColor(avg: number): string | null {
  let color: string | null = null;
  FIRE_BREAKS.forEach((b, i) => {
    if (avg >= b) color = FIRE_STEPS[i];
  });
  return color;
}
