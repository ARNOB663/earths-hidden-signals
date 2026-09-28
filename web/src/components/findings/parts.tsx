import { divergingColor, formatSigned, type VariableId } from "@/lib/trends";

/* ---------- Region bars: diverging horizontal bars, one per region ---------- */

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
    <figure className="rounded-lg bg-[#0b0f14] p-4 ring-1 ring-white/10" aria-label={label}>
      <div className="space-y-1.5">
        {sorted.map((b) => {
          // Bars use at most 40% of each half so the value label always fits inside the card.
          const w = Math.min(40, (Math.abs(b.value) / limit) * 40);
          const [r, g, bl] = divergingColor(b.value, limit, variable);
          return (
            <div key={b.name} className="grid grid-cols-[minmax(0,9.5rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
              <span className="truncate text-slate-300" title={b.name}>
                {b.name}
              </span>
              <div className="relative h-6">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
                <div
                  className="absolute inset-y-1 rounded-[4px]"
                  title={`${b.name}: ${formatSigned(b.value, decimals)} ${unit}${b.significant ? " (significant)" : " (not significant)"}`}
                  style={{
                    left: b.value >= 0 ? "50%" : `${50 - w}%`,
                    width: `${Math.max(w, 0.6)}%`,
                    background: `rgb(${r},${g},${bl})`,
                    opacity: b.significant ? 1 : 0.35,
                  }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[11px] tabular-nums text-slate-200"
                  style={b.value >= 0 ? { left: `calc(${50 + w}% + 6px)` } : { right: `calc(${50 + w}% + 6px)` }}
                >
                  {formatSigned(b.value, decimals)}
                  {b.significant ? "" : " ns"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 text-xs text-slate-500">
        {label} ({unit}). Faded bars and &ldquo;ns&rdquo; = not statistically significant.
      </figcaption>
    </figure>
  );
}

/* ---------- Events above, climate driver below, on the same years ---------- */

export function EventDriverChart({
  years,
  counts,
  highYears,
  driverValues,
  eventLabel,
  driverLabel,
  driverUnit,
  eventColor,
  driverDecimals,
}: {
  years: number[];
  counts: number[];
  highYears: number[];
  driverValues: number[];
  eventLabel: string;
  driverLabel: string;
  driverUnit: string;
  eventColor: string;
  driverDecimals: number;
}) {
  const W = 520;
  const PAD_L = 8;
  const PAD_R = 8;
  const plotW = W - PAD_L - PAD_R;
  const step = plotW / years.length;
  const cx = (i: number) => PAD_L + step * (i + 0.5);
  const maxC = Math.max(1, ...counts);
  const lo = Math.min(...driverValues);
  const hi = Math.max(...driverValues);
  const dy = (v: number) => 8 + (1 - (v - lo) / (hi - lo || 1)) * 64;
  const high = new Set(highYears);
  const line = driverValues.map((v, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${dy(v).toFixed(1)}`).join("");

  return (
    <figure className="rounded-lg bg-[#0b0f14] p-4 ring-1 ring-white/10">
      <div className="text-xs text-slate-400">{eventLabel} per year</div>
      <svg viewBox={`0 0 ${W} 90`} className="mt-1 block h-auto w-full" role="img" aria-label={`${eventLabel} per year`}>
        {counts.map((c, i) => {
          const h = (c / maxC) * 80;
          return (
            <rect
              key={years[i]}
              x={cx(i) - step * 0.36}
              y={86 - h}
              width={step * 0.72}
              height={Math.max(h, c > 0 ? 1.5 : 0)}
              rx={2}
              fill={eventColor}
              opacity={high.has(years[i]) ? 1 : 0.35}
            >
              <title>{`${years[i]}: ${c.toLocaleString()} ${eventLabel.toLowerCase()}${high.has(years[i]) ? " (top-25% year)" : ""}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-3 text-xs text-slate-400">
        {driverLabel} ({driverUnit}) in the same years
      </div>
      <svg viewBox={`0 0 ${W} 80`} className="mt-1 block h-auto w-full" role="img" aria-label={`${driverLabel} per year`}>
        {years.map((yr, i) =>
          high.has(yr) ? <rect key={yr} x={cx(i) - step / 2} y={0} width={step} height={80} fill="#ffffff" opacity={0.05} /> : null,
        )}
        <path d={line} fill="none" stroke="#e2e8f0" strokeWidth={2} strokeLinejoin="round" />
        {driverValues.map((v, i) => (
          <circle key={years[i]} cx={cx(i)} cy={dy(v)} r={high.has(years[i]) ? 4 : 2.5} fill={high.has(years[i]) ? eventColor : "#94a3b8"} stroke="#0b0f14" strokeWidth={1.5}>
            <title>{`${years[i]}: ${v.toFixed(driverDecimals)} ${driverUnit}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>
      <figcaption className="mt-2 text-xs text-slate-500">
        Bright bars and big dots mark the top-25% event years. If the dots in those years sit high, the two move together.
      </figcaption>
    </figure>
  );
}

/* ---------- Where does this year sit in the record? ---------- */

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
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-xs text-slate-400">percentile, 1981–{latestYear}</span>
      </div>
      <div className="relative mt-2 h-8">
        <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-gradient-to-r from-white/5 to-white/20" />
        <div className="absolute top-0 h-8 w-0.5 bg-slate-400" style={{ left: `${highEvent}%` }} title="Average in past high-event years" />
        <div
          className="absolute top-1.5 h-5 w-5 -translate-x-1/2 rounded-full ring-2 ring-[#0b0f14]"
          style={{ left: `${latest}%`, background: color }}
          title={`${latestYear}: ${latest}th percentile`}
        />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {latestYear}: {latest}th
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-slate-400" /> Past high-event years: {highEvent}th
        </span>
      </div>
    </div>
  );
}

/* ---------- How sure are we? ---------- */

const CONFIDENCE = {
  high: { label: "High confidence", dots: 3, className: "text-emerald-300 ring-emerald-400/40 bg-emerald-400/10" },
  medium: { label: "Medium confidence", dots: 2, className: "text-amber-200 ring-amber-400/40 bg-amber-400/10" },
  low: { label: "Low confidence", dots: 1, className: "text-slate-300 ring-white/20 bg-white/5" },
} as const;

export function Confidence({ level, reason }: { level: keyof typeof CONFIDENCE; reason: string }) {
  const c = CONFIDENCE[level];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${c.className}`}>
        <span aria-hidden className="tracking-[-0.1em]">
          {"●".repeat(c.dots)}
          <span className="opacity-30">{"●".repeat(3 - c.dots)}</span>
        </span>
        {c.label}
      </span>
      <span className="text-slate-400">{reason}</span>
    </div>
  );
}

/* ---------- Tiny sparkline for summary cards ---------- */

export function Sparkline({ values, color = "#e2e8f0" }: { values: number[]; color?: string }) {
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
