"use client";

import { useState } from "react";

interface Props {
  labels: (string | number)[];
  values: number[];
  /** Labels to draw at full strength (e.g. the top-25% event years); others are muted. */
  highlight?: Set<string | number>;
  color: string;
  unit: string;
  ariaLabel: string;
  height?: number;
  /** Show every Nth label under the bars. */
  labelEvery?: number;
}

/** Simple bar chart with a per-bar tooltip and a data-table fallback. */
export function YearBars({ labels, values, highlight, color, unit, ariaLabel, height = 110, labelEvery = 5 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...values);

  return (
    <div>
      <div className="relative">
        <div className="flex items-end gap-[2px]" style={{ height }} role="img" aria-label={ariaLabel}>
          {values.map((v, i) => {
            const strong = !highlight || highlight.has(labels[i]);
            return (
              <div
                key={labels[i]}
                className="flex h-full flex-1 cursor-default items-end"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              >
                <div
                  className="w-full rounded-t-[3px] transition-opacity"
                  style={{
                    height: `${v === 0 ? 0 : Math.max(2, (v / max) * 100)}%`,
                    background: color,
                    opacity: hover === i ? 1 : strong ? 0.9 : 0.35,
                    outline: hover === i ? "1px solid #f8fafc" : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-md bg-[#0b0f14]/95 px-2 py-1 text-xs text-slate-200 ring-1 ring-white/15"
            style={{ left: `${Math.min(80, (hover / values.length) * 100)}%` }}
          >
            <span className="font-medium text-white">{labels[hover]}</span>: {values[hover].toLocaleString()} {unit}
          </div>
        )}
      </div>
      <div className="mt-1 flex gap-[2px] font-mono text-[10px] text-slate-500">
        {labels.map((l, i) => (
          <span key={l} className="flex-1 text-center">
            {i % labelEvery === 0 ? l : ""}
          </span>
        ))}
      </div>
      <details className="mt-1 text-xs text-slate-400">
        <summary className="cursor-pointer select-none hover:text-slate-200">Show data table</summary>
        <table className="mt-1 w-full text-left tabular-nums">
          <tbody>
            {labels.map((l, i) => (
              <tr key={l} className="odd:bg-white/[0.02]">
                <td className="px-2 py-0.5">{l}</td>
                <td className="px-2 py-0.5 text-right">{values[i].toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
