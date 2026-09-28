import { TrendLegend } from "@/components/ui";
import { cellCenter, formatSigned, trendToken, type GridSpec, type TrendGrid, type VariableId, type VariableMeta } from "@/lib/trends";

// Reference points so readers can find their way on a map without coastlines.
const CITIES: [string, number, number][] = [
  ["Delhi", 28.61, 77.21],
  ["Dhaka", 23.81, 90.41],
  ["Karachi", 24.86, 67.01],
  ["Mumbai", 19.08, 72.88],
  ["Kathmandu", 27.72, 85.32],
  ["Colombo", 6.93, 79.86],
  ["Chennai", 13.08, 80.27],
  ["Lahore", 31.55, 74.34],
  ["Kolkata", 22.57, 88.36],
];

const LON0 = 60;
const LON1 = 100;
const LAT0 = 5;
const LAT1 = 38;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

interface Props {
  grid: GridSpec;
  stats: TrendGrid;
  variable: VariableId;
  meta: VariableMeta;
  /** Colour-scale limit, per decade. */
  limit: number;
  /** Show the value as % of the local average instead of raw units. */
  percent?: boolean;
  title: string;
  decreaseWord: string;
  increaseWord: string;
}

/** Small static map of trends per square: solid = clear change, faded = no clear change. */
export function MiniGridMap({ grid, stats, variable, meta, limit, percent, title, decreaseWord, increaseWord }: Props) {
  const W = 520;
  const scale = W / (LON1 - LON0);
  const yTop = mercY(LAT1);
  const H = Math.round(((yTop - mercY(LAT0)) * 180 * scale) / Math.PI);
  const x = (lon: number) => (lon - LON0) * scale;
  const y = (lat: number) => ((yTop - mercY(lat)) * 180 * scale) / Math.PI;

  const unit = percent ? "% every 10 years" : `${meta.unit} every 10 years`;
  const cells = stats.slopePerDecade.flatMap((slope, k) => {
    if (slope === null) return [];
    const i = Math.floor(k / grid.nLon);
    const j = k % grid.nLon;
    const { lat, lon } = cellCenter(grid, i, j);
    const mean = stats.mean[k];
    const value = percent && mean ? (slope / mean) * 100 : slope;
    return [{ k, lat, lon, value, clear: stats.significant[k] === 1 }];
  });

  return (
    <figure className="rounded-2xl bg-card p-5 shadow-soft">
      <figcaption className="mb-3 text-sm font-medium text-ink">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={title}>
        <rect width={W} height={H} rx={10} fill="var(--sunken)" />
        {cells.map((c) => {
          const x0 = x(c.lon - grid.dLon / 2);
          const y0 = y(c.lat + grid.dLat / 2);
          return (
            <rect
              key={c.k}
              x={x0 + 1}
              y={y0 + 1}
              width={x(c.lon + grid.dLon / 2) - x0 - 2}
              height={y(c.lat - grid.dLat / 2) - y0 - 2}
              rx={3}
              fill={`var(${trendToken(c.value, limit, variable)})`}
              fillOpacity={c.clear ? 1 : 0.3}
            >
              <title>{`${formatSigned(c.value, percent ? 1 : meta.decimals + 1)} ${unit}${c.clear ? " (clear change)" : " (no clear change)"}`}</title>
            </rect>
          );
        })}
        {CITIES.map(([name, lat, lon]) => (
          <g key={name} pointerEvents="none">
            <circle cx={x(lon)} cy={y(lat)} r={3} fill="var(--ink)" stroke="var(--card)" strokeWidth={1.5} />
            <text x={x(lon) + 6} y={y(lat)} dy="0.35em" fontSize={12} fill="var(--ink)" stroke="var(--card)" strokeWidth={3} paintOrder="stroke">
              {name}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-4">
        <TrendLegend
          variable={variable}
          limit={limit}
          decimals={percent ? 0 : meta.decimals}
          decreaseWord={decreaseWord}
          increaseWord={increaseWord}
        />
      </div>
    </figure>
  );
}
