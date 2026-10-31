// A small static locator: the six study countries, the area whose numbers this page uses, and
// (for a city) the city itself. Server-rendered SVG, no map library.

import { T } from "@/lib/i18n";

type Ring = [number, number][];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };

const LON0 = 60;
const LON1 = 100;
const LAT0 = 5;
const LAT1 = 38;
const W = 400;
const H = Math.round(((LAT1 - LAT0) / (LON1 - LON0)) * W * 1.05);

const x = (lon: number) => ((lon - LON0) / (LON1 - LON0)) * W;
const y = (lat: number) => ((LAT1 - lat) / (LAT1 - LAT0)) * H;

function rings(g: Geometry): Ring[] {
  return g.type === "Polygon" ? (g.coordinates as Ring[]) : (g.coordinates as Ring[][]).flat();
}

function path(g: Geometry): string {
  return rings(g)
    .map((r) => r.map(([lo, la], i) => `${i ? "L" : "M"}${x(lo).toFixed(1)},${y(la).toFixed(1)}`).join("") + "Z")
    .join("");
}

export function Locator({
  countries,
  highlight,
  bbox,
  point,
  label,
}: {
  countries: { id: string; geometry: Geometry }[];
  /** Country whose polygon is the source area. */
  highlight?: string;
  /** [latMin, latMax, lonMin, lonMax] source box. */
  bbox?: [number, number, number, number];
  point?: [number, number];
  label: { en: string; bn: string };
}) {
  return (
    <figure className="rounded-2xl border border-line bg-card p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label.en}>
        <rect x={0} y={0} width={W} height={H} rx={8} fill="var(--sunken)" />
        {countries.map((c) => (
          <path
            key={c.id}
            d={path(c.geometry)}
            fill={c.id === highlight ? "var(--accent-soft)" : "var(--card)"}
            stroke={c.id === highlight ? "var(--accent)" : "var(--line)"}
            strokeWidth={c.id === highlight ? 1.6 : 0.8}
          />
        ))}
        {bbox && (
          <rect
            x={x(bbox[2])}
            y={y(bbox[1])}
            width={x(bbox[3]) - x(bbox[2])}
            height={y(bbox[0]) - y(bbox[1])}
            fill="var(--accent)"
            fillOpacity={0.14}
            stroke="var(--accent)"
            strokeWidth={1.6}
            strokeDasharray="5 3"
          />
        )}
        {point && (
          <>
            <circle cx={x(point[1])} cy={y(point[0])} r={7} fill="var(--card)" stroke="var(--ink)" strokeWidth={1.5} />
            <circle cx={x(point[1])} cy={y(point[0])} r={3} fill="var(--ink)" />
          </>
        )}
      </svg>
      <figcaption className="mt-2 text-xs text-ink-3">
        <T en={label.en} bn={label.bn} />
      </figcaption>
    </figure>
  );
}
