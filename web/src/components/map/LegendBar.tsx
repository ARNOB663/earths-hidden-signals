import type { Legend } from "@/lib/gibs";

export function LegendBar({ legend, unit }: { legend: Legend; unit: string }) {
  return (
    <div>
      <div className="h-3 rounded-full" style={{ background: legend.gradient }} />
      <div className="relative mt-1.5 h-4 text-xs text-ink-2">
        {legend.ticks.map((t) => (
          <span key={t.position} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${t.position * 100}%` }}>
            {t.label}
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-3">
        <span>{legend.minLabel}</span>
        <span className="font-medium text-ink-2">{unit}</span>
        <span>{legend.maxLabel}</span>
      </div>
    </div>
  );
}
