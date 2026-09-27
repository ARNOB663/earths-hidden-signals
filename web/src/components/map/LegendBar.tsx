import type { Legend } from "@/lib/gibs";

export function LegendBar({ legend, unit }: { legend: Legend; unit: string }) {
  return (
    <div>
      <div className="h-3 rounded-sm ring-1 ring-white/10" style={{ background: legend.gradient }} />
      <div className="relative mt-1 h-4 font-mono text-[11px] text-slate-400">
        {legend.ticks.map((t) => (
          <span
            key={t.position}
            className="absolute -translate-x-1/2 tabular-nums"
            style={{ left: `${t.position * 100}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{legend.minLabel}</span>
        <span className="text-slate-400">{unit}</span>
        <span>{legend.maxLabel}</span>
      </div>
    </div>
  );
}
