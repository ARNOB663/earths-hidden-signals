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
                  className="w-full rounded-t-[4px] transition-opacity"
                  style={{
                    height: `${v === 0 ? 0 : Math.max(2, (v / max) * 100)}%`,
                    background: color,
                    opacity: hover === i ? 1 : strong ? 1 : 0.4,
                    outline: hover === i ? "2px solid var(--ink)" : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-ink-2 shadow-soft"
            style={{ left: `${Math.min(80, (hover / values.length) * 100)}%` }}
          >
            <span className="font-medium text-ink">{labels[hover]}</span>: {values[hover].toLocaleString()} {unit}
          </div>
        )}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[11px] text-ink-3">
        {labels.map((l, i) => (
          <span key={l} className="flex-1 text-center">
            {i % labelEvery === 0 ? l : ""}
          </span>
        ))}
      </div>
      <details className="mt-2 text-xs text-ink-3">
        <summary className="cursor-pointer select-none hover:text-ink">Show the data as a table</summary>
        <table className="mt-1 w-full text-left tabular-nums">
          <tbody>
            {labels.map((l, i) => (
              <tr key={l} className="text-ink-2 odd:bg-sunken/60">
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
