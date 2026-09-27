// Colors for tree cover loss by year. Kept free of Leaflet so server-rendered UI can import it.

// Early loss years are yellow, recent years are deep red, so change over time reads at a glance.
const COLOR_STOPS: [number, number, number][] = [
  [255, 230, 110],
  [255, 150, 30],
  [235, 40, 70],
  [175, 0, 110],
];

export function lossYearColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (COLOR_STOPS.length - 1);
  const i = Math.min(COLOR_STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = COLOR_STOPS[i];
  const b = COLOR_STOPS[i + 1];
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as [number, number, number];
}

export function lossYearGradient(): string {
  const stops = COLOR_STOPS.map((c, i) => `rgb(${c.join(",")}) ${(i / (COLOR_STOPS.length - 1)) * 100}%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
