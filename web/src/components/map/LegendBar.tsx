import type { Legend } from "@/lib/gibs";

/**
 * Colour key for a satellite layer: plain words at the ends ("Cold" … "Hot"), the bar, then a few
 * values with their unit. The catalogue's extreme labels ("< −73°") are left out: they describe the
 * palette's clipping, not anything a reader looks for on the map.
 */
export function LegendBar({ legend, unit, ends, digits = (s) => s }: { legend: Legend; unit: string; ends: [string, string]; digits?: (s: string) => string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm font-medium text-ink">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
      <div className="h-3 rounded-full" style={{ background: legend.gradient }} />
      <div className="relative mt-1.5 h-4 text-xs text-ink-2">
        {legend.ticks.map((t) => (
          <span key={t.position} className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums" style={{ left: `${t.position * 100}%` }}>
            {digits(t.label)}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-center text-xs text-ink-3">{unit}</p>
    </div>
  );
}
