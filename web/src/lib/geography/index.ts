// Client-safe help for the shared geography index. Server pages read the files through ./data;
// client components import only these pure helpers. No Node built-ins.

import type { GeoCountrySummary, GeographyIndex, AdminLevel } from "./types";

/** "Divisions" for a summary (Bangla is supplied per level). Singular level names stay as-is. */
export function levelLabel(level: AdminLevel | "country", country?: GeoCountrySummary): string {
  if (level === "country") return "Country";
  return country?.levels[level]?.name ?? level;
}

export function areaLevelLabel(level: "ADM1" | "ADM2", country: GeoCountrySummary) {
  return country.levels[level];
}

export function formatPercent(share: number | null): string {
  if (share === null) return "–";
  return `${Math.round(share * 100)}%`;
}

export function countryByCode(index: GeographyIndex, code: string) {
  return index.countries.find((country) => country.code === code) ?? null;
}
