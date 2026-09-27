// Types for public/data/hazards/ (produced by analysis/build_hazards.py).

import type { TrendSummary } from "./trends";

export type HazardId = "flood" | "landslide" | "wildfire";

export const HAZARD_ORDER: HazardId[] = ["flood", "landslide", "wildfire"];

export const HAZARD_META: Record<
  HazardId,
  { label: string; eventNoun: string; eventsPlural: string; intro: string; affected: string[] }
> = {
  flood: {
    label: "Floods",
    eventNoun: "flood alert",
    eventsPlural: "flood alerts",
    intro: "River and flash floods on the great floodplains, driven by monsoon rain falling locally and upstream.",
    affected: ["Riverside and delta communities", "Farmers", "Emergency teams", "Local authorities"],
  },
  landslide: {
    label: "Landslides",
    eventNoun: "landslide",
    eventsPlural: "landslides",
    intro: "Slope failures in steep terrain, mostly triggered when monsoon rain saturates the soil.",
    affected: ["Mountain communities", "Roads", "Hydropower", "Disaster management agencies"],
  },
  wildfire: {
    label: "Wildfires",
    eventNoun: "fire detection",
    eventsPlural: "fire detections",
    intro: "Forest and scrub fires in the hot, dry weeks before the monsoon arrives (March–May).",
    affected: ["Forest communities", "Farmers", "Forest departments", "Emergency responders"],
  },
};

export interface DriverResult {
  key: string; // e.g. "temperature_pre-monsoon"
  label: string;
  /** Which direction of the driver raises the hazard. */
  risk: "higher" | "lower";
  /** Spearman correlation between yearly event counts and the driver, both detrended. */
  relationship: { rho: number; p: number; n: number } | null;
  linked: boolean;
  trend: TrendSummary | null;
  latest: { year: number; value: number; percentile: number };
  /** Average percentile of the driver in the top-25% event years. */
  highEventYearsPercentile: number | null;
}

export interface HazardZone {
  id: string;
  name: string;
  hazard: HazardId;
  bbox: [number, number, number, number];
  description: string;
  eventSource: string;
  monthly: number[];
  years: number[];
  counts: number[];
  highEventYears: number[];
  eventTrend: {
    slopePerDecade: number;
    lowerPerDecade: number;
    upperPerDecade: number;
    p: number;
    mean: number;
  } | null;
  drivers: DriverResult[];
}

export interface LandslideEvent {
  date: string;
  lat: number;
  lon: number;
  trigger: string;
  fatalities: number | null;
  title: string;
  country: string;
}

export interface FloodEvent {
  date: string;
  end: string;
  lat: number;
  lon: number;
  alert: string;
  title: string;
  country: string;
}

export interface FireGrid {
  cell: number;
  years: [number, number];
  note: string;
  cells: [number, number, number][];
}

export type Signal =
  | { kind: "resembles"; drivers: DriverResult[] }
  | { kind: "not-resembling"; drivers: DriverResult[] }
  | { kind: "no-link" };

/**
 * Compares this year's conditions with past high-event years, only for drivers with a
 * real (significant, right-direction) link to events. Never a forecast.
 */
export function preparednessSignal(zone: HazardZone): Signal {
  const linked = zone.drivers.filter((d) => d.linked && d.highEventYearsPercentile !== null);
  if (linked.length === 0) return { kind: "no-link" };
  const resembling = linked.filter((d) =>
    d.risk === "higher"
      ? d.latest.percentile >= d.highEventYearsPercentile!
      : d.latest.percentile <= d.highEventYearsPercentile!,
  );
  return resembling.length > 0 ? { kind: "resembles", drivers: resembling } : { kind: "not-resembling", drivers: linked };
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
