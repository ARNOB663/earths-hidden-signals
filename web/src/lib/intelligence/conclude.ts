// Display helpers for the pipeline's numbers. Render-only: no thresholds, no reclassification.
// Every value comes from analysis/intel/*.py through the JSON files.

/** A 0–1 share as a whole percentage, or an em dash when the pipeline left it empty. */
export function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}
