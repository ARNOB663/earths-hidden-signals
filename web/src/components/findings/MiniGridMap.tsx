import {
  cellCenter,
  divergingColor,
  divergingGradient,
  formatSigned,
  type GridSpec,
  type TrendGrid,
  type VariableId,
  type VariableMeta,
} from "@/lib/trends";

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
  caption: string;
}

/** Small static heat map of per-cell trends: solid = significant, faded = not. */
export function MiniGridMap({ grid, stats, variable, meta, limit, percent, caption }: Props) {
  const W = 520;
  const scale = W / (LON1 - LON0);
  const yTop = mercY(LAT1);
  const H = Math.round(((yTop - mercY(LAT0)) * 180 * scale) / Math.PI);
  const x = (lon: number) => (lon - LON0) * scale;
  const y = (lat: number) => ((yTop - mercY(lat)) * 180 * scale) / Math.PI;

  const unit = percent ? "% per decade" : `${meta.unit} per decade`;
  const cells = stats.slopePerDecade.flatMap((slope, k) => {
    if (slope === null) return [];
    const i = Math.floor(k / grid.nLon);
    const j = k % grid.nLon;
    const { lat, lon } = cellCenter(grid, i, j);
    const mean = stats.mean[k];
    const value = percent && mean ? (slope / mean) * 100 : slope;
    return [{ k, lat, lon, value, significant: stats.significant[k] === 1 }];
  });

  return (
    <figure className="rounded-lg bg-[#0b0f14] p-3 ring-1 ring-white/10">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={caption}>
        <rect width={W} height={H} fill="#0b0f14" />
        {cells.map((c) => {
          const [r, g, b] = divergingColor(c.value, limit, variable);
          const x0 = x(c.lon - grid.dLon / 2);
          const y0 = y(c.lat + grid.dLat / 2);
          return (
            <rect
              key={c.k}
              x={x0 + 0.75}
              y={y0 + 0.75}
              width={x(c.lon + grid.dLon / 2) - x0 - 1.5}
              height={y(c.lat - grid.dLat / 2) - y0 - 1.5}
              rx={2}
              fill={`rgb(${r},${g},${b})`}
              fillOpacity={c.significant ? 0.92 : 0.3}
            >
              <title>
                {`${c.lat.toFixed(1)}°N ${c.lon.toFixed(1)}°E: ${formatSigned(c.value, percent ? 1 : meta.decimals + 1)} ${unit}${
                  c.significant ? " (significant)" : " (not significant)"
                }`}
              </title>
            </rect>
          );
        })}
        {CITIES.map(([name, lat, lon]) => (
          <g key={name} pointerEvents="none">
            <circle cx={x(lon)} cy={y(lat)} r={2.6} fill="#f8fafc" stroke="#0b0f14" strokeWidth={1.2} />
            <text
              x={x(lon) + 5}
              y={y(lat)}
              dy="0.35em"
              fontSize={11}
              fill="#f1f5f9"
              stroke="#0b0f14"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {name}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 space-y-1.5">
        <div className="h-2.5 rounded-sm" style={{ background: divergingGradient(variable) }} />
        <div className="flex justify-between font-mono text-[11px] text-slate-400">
          <span>
            {formatSigned(-limit, percent ? 0 : meta.decimals + 1)} · {meta.decrease}
          </span>
          <span>{unit}</span>
          <span>
            {meta.increase} · {formatSigned(limit, percent ? 0 : meta.decimals + 1)}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {caption} Solid squares passed the significance test; faded squares did not. Hover a square for its value.
        </p>
      </figcaption>
    </figure>
  );
}
