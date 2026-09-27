// Helpers for GIBS time dimensions like "2000-03-01/2026-08-01/P1M".

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Expands monthly GIBS intervals into a sorted, de-duplicated list of "YYYY-MM-01" dates. */
export function expandMonthlyIntervals(intervals: string[]): string[] {
  const months = new Set<number>();
  for (const interval of intervals) {
    const [start, end, period] = interval.split("/");
    // GIBS occasionally lists stray mid-month granules; monthly products live on day 01.
    if (!start || !end || period !== "P1M" || start.slice(8, 10) !== "01") continue;
    let y = Number(start.slice(0, 4));
    let m = Number(start.slice(5, 7));
    const endKey = Number(end.slice(0, 4)) * 12 + Number(end.slice(5, 7)) - 1;
    while (y * 12 + m - 1 <= endKey) {
      months.add(y * 12 + m - 1);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return [...months]
    .sort((a, b) => a - b)
    .map((k) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}-01`);
}

export function formatMonth(isoDate: string): string {
  return `${MONTHS[Number(isoDate.slice(5, 7)) - 1]} ${isoDate.slice(0, 4)}`;
}

/** Index of the date closest to `target` (dates must be sorted ISO strings). */
export function nearestDateIndex(dates: string[], target: string): number {
  if (dates.length === 0) return -1;
  const t = Date.parse(target);
  let best = 0;
  for (let i = 1; i < dates.length; i++) {
    if (Math.abs(Date.parse(dates[i]) - t) < Math.abs(Date.parse(dates[best]) - t)) best = i;
  }
  return best;
}
