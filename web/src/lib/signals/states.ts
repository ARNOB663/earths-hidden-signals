// Page-level state for a Signals row. "no-data" is its own state with its own word and colour:
// it never borrows the Green styling and never counts toward a demo band.
//
// Not a client module: both server pages and client components import it.

export type RowSignal = "green" | "yellow" | "red" | "no-data";

export interface StateStyle {
  word: { en: string; bn: string };
  className: string;
  soft: string;
}

export const ROW_STATE: Record<RowSignal, StateStyle> = {
  green: {
    word: { en: "Green", bn: "সবুজ" },
    className: "text-good",
    soft: "bg-accent-soft",
  },
  yellow: {
    word: { en: "Yellow", bn: "হলুদ" },
    className: "text-watch",
    soft: "bg-watch-soft",
  },
  red: {
    word: { en: "Red", bn: "লাল" },
    className: "text-alert",
    soft: "bg-alert-soft",
  },
  "no-data": {
    word: { en: "No data", bn: "তথ্য নেই" },
    className: "text-ink-3",
    soft: "bg-sunken",
  },
};

export const SIGNAL_ORDER: RowSignal[] = ["red", "yellow", "green", "no-data"];

/** Demo probability as a percentage label, e.g. "62%". */
export function percentLabel(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}
