import { lossYearColor } from "./lossColors";

interface Props {
  totals: number[] | null;
  firstYear: number;
  yearRange: [number, number];
}

/** Bar chart of the relative tree-cover-loss index per year for the area in view. */
export function ForestLossChart({ totals, firstYear, yearRange }: Props) {
  if (!totals) {
    return <p className="text-xs text-slate-500">Loading forest tiles for this view…</p>;
  }
  const max = Math.max(...totals);
  if (max === 0) {
    return <p className="text-xs text-slate-500">No tree cover loss detected in this view.</p>;
  }
  const lastYear = firstYear + totals.length - 1;
  const span = Math.max(1, lastYear - firstYear);

  return (
    <div>
      <div className="flex h-24 items-end gap-[2px]" role="img" aria-label="Relative tree cover loss by year in the current view">
        {totals.map((v, i) => {
          const year = firstYear + i;
          const active = year >= yearRange[0] && year <= yearRange[1];
          const [r, g, b] = lossYearColor(i / span);
          return (
            <div
              key={year}
              title={`${year}: ${Math.round((v / max) * 100)}% of peak year`}
              className="flex-1 rounded-t-[2px] transition-opacity"
              style={{
                height: `${Math.max(2, (v / max) * 100)}%`,
                background: `rgb(${r},${g},${b})`,
                opacity: active ? 1 : 0.2,
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-500">
        <span>{firstYear}</span>
        <span>{lastYear}</span>
      </div>
    </div>
  );
}
