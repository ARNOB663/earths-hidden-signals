import { formatSigned, trendToken, type VariableId } from "@/lib/trends";

/* ---------- Region bars: one bar per region, left = decrease, right = increase ---------- */

export interface RegionBar {
  name: string;
  value: number;
  significant: boolean;
}

export function RegionBars({
  bars,
  limit,
  variable,
  unit,
  decimals,
  label,
}: {
  bars: RegionBar[];
  limit: number;
  variable: VariableId;
  unit: string;
  decimals: number;
  label: string;
}) {
  const sorted = [...bars].sort((a, b) => b.value - a.value);
  return (
    <figure className="rounded-2xl bg-card p-5 shadow-soft" aria-label={label}>
      <figcaption className="mb-3 text-sm font-medium text-ink">{label}</figcaption>
      <div className="space-y-2">
        {sorted.map((b) => {
          // Bars use at most 40% of each half so the value label always fits inside the card.
          const w = Math.min(40, (Math.abs(b.value) / limit) * 40);
          return (
            <div key={b.name} className="grid grid-cols-[minmax(0,8.5rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr]">
              <span className="truncate text-ink-2" title={b.name}>
                {b.name}
              </span>
              <div className="relative h-7">
                <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                <div
                  className="absolute inset-y-1 rounded-md"
                  title={`${b.name}: ${formatSigned(b.value, decimals)} ${unit}${b.significant ? " (clear change)" : " (no clear change)"}`}
                  style={{
                    left: b.value >= 0 ? "50%" : `${50 - w}%`,
                    width: `${Math.max(w, 0.8)}%`,
                    background: `var(${trendToken(b.value, limit, variable)})`,
                    opacity: b.significant ? 1 : 0.35,
                  }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-medium tabular-nums text-ink"
                  style={b.value >= 0 ? { left: `calc(${50 + w}% + 6px)` } : { right: `calc(${50 + w}% + 6px)` }}
                >
                  {formatSigned(b.value, decimals)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-3">{unit}. Faded bars: no clear change.</p>
    </figure>
  );
}

/* ---------- Events above, weather below, on the same years ---------- */

export function EventDriverChart({
  title,
  years,
  counts,
  highYears,
  driverValues,
  eventLabel,
  driverLabel,
  eventColor,
  driverDecimals,
  driverUnit,
}: {
  title: string;
  years: number[];
  counts: number[];
  highYears: number[];
  driverValues: number[];
  eventLabel: string;
  driverLabel: string;
  eventColor: string;
  driverDecimals: number;
  driverUnit: string;
}) {
  const W = 520;
  const step = W / years.length;
  const cx = (i: number) => step * (i + 0.5);
  const maxC = Math.max(1, ...counts);
  const lo = Math.min(...driverValues);
  const hi = Math.max(...driverValues);
  const dy = (v: number) => 8 + (1 - (v - lo) / (hi - lo || 1)) * 60;
  const high = new Set(highYears);
  const line = driverValues.map((v, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${dy(v).toFixed(1)}`).join("");

  return (
    <figure className="rounded-2xl bg-card p-5 shadow-soft">
      <figcaption className="font-medium text-ink">{title}</figcaption>
      <div className="mt-3 text-xs text-ink-3">{eventLabel}</div>
      <svg viewBox={`0 0 ${W} 86`} className="mt-1 block h-auto w-full" role="img" aria-label={`${eventLabel} per year`}>
        {counts.map((c, i) => {
          const h = (c / maxC) * 80;
          return (
            <rect
              key={years[i]}
              x={cx(i) - step * 0.36}
              y={84 - h}
              width={step * 0.72}
              height={Math.max(h, c > 0 ? 1.5 : 0)}
              rx={2.5}
              fill={eventColor}
              opacity={high.has(years[i]) ? 1 : 0.35}
            >
              <title>{`${years[i]}: ${c.toLocaleString()}${high.has(years[i]) ? " (one of the worst years)" : ""}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-3 text-xs text-ink-3">{driverLabel}</div>
      <svg viewBox={`0 0 ${W} 76`} className="mt-1 block h-auto w-full" role="img" aria-label={`${driverLabel} per year`}>
        {years.map((yr, i) =>
          high.has(yr) ? <rect key={yr} x={cx(i) - step / 2} y={0} width={step} height={76} fill="var(--ink)" opacity={0.05} /> : null,
        )}
        <path d={line} fill="none" stroke="var(--ink-2)" strokeWidth={2} strokeLinejoin="round" />
        {driverValues.map((v, i) => (
          <circle
            key={years[i]}
            cx={cx(i)}
            cy={dy(v)}
            r={high.has(years[i]) ? 4.5 : 2.5}
            fill={high.has(years[i]) ? eventColor : "var(--ink-3)"}
            stroke="var(--card)"
            strokeWidth={1.5}
          >
            <title>{`${years[i]}: ${v.toFixed(driverDecimals)} ${driverUnit}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-ink-3">
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>
    </figure>
  );
}

/* ---------- Where does this year sit, compared with past disaster years? ---------- */

export function PercentileBar({
  label,
  latestYear,
  latest,
  highEvent,
  color,
}: {
  label: string;
  latestYear: number;
  latest: number;
  highEvent: number;
  color: string;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-ink">{label}</div>
      <div className="relative mt-3 h-8">
        <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-sunken" />
        <div
          className="absolute top-0 h-8 w-0.5 rounded bg-ink-3"
          style={{ left: `${highEvent}%` }}
          title={`Worst years were around the ${highEvent}th percentile`}
        />
        <div
          className="absolute top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-card"
          style={{ left: `${latest}%`, background: color }}
          title={`${latestYear}: higher than ${latest}% of years`}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-3">
        <span>Lowest year</span>
        <span>Highest year</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: color }} /> {latestYear}: higher than {latest}% of years
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-0.5 rounded bg-ink-3" /> Worst years: about {highEvent}%
        </span>
      </div>
    </div>
  );
}

/* ---------- Tiny sparkline for summary cards ---------- */

export function Sparkline({ values, color = "var(--ink)" }: { values: number[]; color?: string }) {
  const W = 200;
  const H = 44;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-11 w-full" aria-hidden preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
