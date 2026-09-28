// Turns statistics into everyday words. The exact numbers stay available
// in each page's "Show the numbers" section for readers who want them.

/** How sure we are that a trend is real, from its p-value. */
export function sureness(p: number): { label: string; short: string; level: 3 | 2 | 1 } {
  if (p < 0.01) return { label: "Very sure this is a real change", short: "Very sure", level: 3 };
  if (p < 0.05) return { label: "Sure this is a real change", short: "Sure", level: 2 };
  return { label: "Not sure: could be natural ups and downs", short: "Not sure", level: 1 };
}

/** How strongly two things move together, from a correlation coefficient. */
export function linkStrength(rho: number): string {
  const r = Math.abs(rho);
  if (r >= 0.6) return "strong";
  if (r >= 0.4) return "moderate";
  return "weak";
}

export const SEASON_PLAIN = {
  annual: { label: "Whole year", hint: "January–December" },
  "pre-monsoon": { label: "Hot season", hint: "March–May, before the rains" },
  monsoon: { label: "Rainy season", hint: "June–September, the monsoon" },
} as const;

/** "+0.31" → "+0.31"; makes minus signs typographically correct. */
export function signed(value: number, decimals: number): string {
  const s = Math.abs(value).toFixed(decimals);
  if (Number(s) === 0) return s;
  return `${value > 0 ? "+" : "−"}${s}`;
}
