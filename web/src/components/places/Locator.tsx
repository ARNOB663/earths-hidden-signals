import { cellCenter, type GridSpec, type TrendGrid } from "@/lib/trends";

const LON0 = 60;
const LON1 = 100;
const LAT0 = 5;
const LAT1 = 38;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** A small silhouette of South Asia (our land squares) with a dot for the place. */
export function Locator({ grid, land, lat, lon, label }: { grid: GridSpec; land: TrendGrid; lat: number; lon: number; label: string }) {
  const W = 320;
  const scale = W / (LON1 - LON0);
  const yTop = mercY(LAT1);
  const H = Math.round(((yTop - mercY(LAT0)) * 180 * scale) / Math.PI);
  const x = (lo: number) => (lo - LON0) * scale;
  const y = (la: number) => ((yTop - mercY(la)) * 180 * scale) / Math.PI;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Location of ${label} in South Asia`}>
      {land.slopePerDecade.map((s, k) => {
        if (s === null) return null;
        const c = cellCenter(grid, Math.floor(k / grid.nLon), k % grid.nLon);
        const x0 = x(c.lon - grid.dLon / 2);
        const y0 = y(c.lat + grid.dLat / 2);
        return (
          <rect
            key={k}
            x={x0 + 0.5}
            y={y0 + 0.5}
            width={x(c.lon + grid.dLon / 2) - x0 - 1}
            height={y(c.lat - grid.dLat / 2) - y0 - 1}
            rx={1.5}
            fill="var(--ink-3)"
            fillOpacity={0.28}
          />
        );
      })}
      <circle cx={x(lon)} cy={y(lat)} r={14} fill="var(--accent)" opacity={0.2} />
      <circle cx={x(lon)} cy={y(lat)} r={6} fill="var(--accent)" stroke="var(--card)" strokeWidth={2.5} />
    </svg>
  );
}
