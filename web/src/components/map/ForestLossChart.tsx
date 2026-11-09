import { T } from "@/lib/i18n";
import { lossYearColor } from "./lossColors";

interface Props {
  totals: number[] | null;
  firstYear: number;
  yearRange: [number, number];
}

/** Bar chart of the relative tree-cover-loss index per year for the area in view. */
export function ForestLossChart({ totals, firstYear, yearRange }: Props) {
  if (!totals) {
    return <div className="h-24 animate-pulse rounded-lg bg-sunken" aria-label="Loading forest data" />;
  }
  const max = Math.max(...totals);
  if (max === 0) {
    return <p className="text-sm text-ink-3">
        <T en="No forest loss found in this part of the map." bn="মানচিত্রের এই অংশে বন উজাড় পাওয়া যায়নি।" />
      </p>;
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
              title={`${year}: ${Math.round((v / max) * 100)}% of the worst year`}
              className="flex-1 rounded-t-[3px] transition-opacity"
              style={{
                height: `${Math.max(2, (v / max) * 100)}%`,
                background: `rgb(${r},${g},${b})`,
                opacity: active ? 1 : 0.2,
              }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-ink-3">
        <span>{firstYear}</span>
        <span>{lastYear}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        <T
          en="Taller bar = more forest lost that year, compared with the worst year. Hover a bar for details."
          bn="লম্বা দণ্ড = ওই বছর বেশি বন উজাড়, সবচেয়ে খারাপ বছরের তুলনায়। বিস্তারিত দেখতে দণ্ডের উপর মাউস রাখুন।"
        />
      </p>
    </div>
  );
}
