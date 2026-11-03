// Display helpers for the pipeline's conclusions. Render-only: no thresholds, no reclassification.
// Every class, level and grade comes from analysis/intel/*.py through the JSON files.

import type { Grade, HazardKey, Level, Severity } from "./types";

export const LEVEL_LABEL: Record<Level, { en: string; bn: string }> = {
  quiet: { en: "Quiet", bn: "শান্ত" },
  notable: { en: "Notable", bn: "লক্ষণীয়" },
  elevated: { en: "Elevated", bn: "বর্ধিত" },
  high: { en: "High", bn: "উচ্চ" },
};

/** Tailwind classes per level. "high" uses the alert tone, which official alerts never use. */
export const LEVEL_TONE: Record<Level, string> = {
  quiet: "bg-sunken text-ink-2",
  notable: "bg-accent-soft text-ink",
  elevated: "bg-watch-soft text-watch",
  high: "bg-alert-soft text-alert",
};

export const SEVERITY_LABEL: Record<Severity, { en: string; bn: string }> = {
  info: { en: "Info", bn: "তথ্য" },
  watch: { en: "Watch", bn: "নজরদারি" },
  warning: { en: "Warning", bn: "সতর্কতা" },
};

export const SEVERITY_TONE: Record<Severity, string> = {
  info: "bg-accent-soft text-ink",
  watch: "bg-watch-soft text-watch",
  warning: "bg-alert-soft text-alert",
};

export const GRADE_LABEL: Record<Grade, { en: string; bn: string }> = {
  high: { en: "High", bn: "উচ্চ" },
  moderate: { en: "Moderate", bn: "মাঝারি" },
  low: { en: "Low", bn: "নিম্ন" },
  insufficient: { en: "Insufficient", bn: "অপর্যাপ্ত" },
};

export const GRADE_DOTS: Record<Grade, 0 | 1 | 2 | 3> = { insufficient: 0, low: 1, moderate: 2, high: 3 };

export const CONFIDENCE_LABEL = {
  observation: { en: "Observation quality", bn: "পর্যবেক্ষণের মান" },
  anomaly: { en: "Anomaly assessment", bn: "অস্বাভাবিকতার মূল্যায়ন" },
  hazard: { en: "Hazard screening", bn: "দুর্যোগ স্ক্রিনিং" },
  validation: { en: "Validation", bn: "যাচাইকরণ" },
} as const;

export const HAZARD_LABEL: Record<HazardKey, { en: string; bn: string }> = {
  heat: { en: "Heat: seasonal warmth", bn: "তাপ: মৌসুমি উষ্ণতা" },
  dry: { en: "Dry conditions", bn: "শুষ্ক অবস্থা" },
  flood: { en: "Flood", bn: "বন্যা" },
  landslide: { en: "Landslide", bn: "ভূমিধস" },
  wildfire: { en: "Wildfire", bn: "দাবানল" },
  cyclone: { en: "Cyclone", bn: "ঘূর্ণিঝড়" },
};

export const KIND_LABEL = {
  country: { en: "Country", bn: "দেশ" },
  region: { en: "Research region", bn: "গবেষণা অঞ্চল" },
  "study-area": { en: "Study area", bn: "গবেষণা এলাকা" },
  city: { en: "City (estimate)", bn: "শহর (অনুমান)" },
} as const;

const CLASS_EN: Record<string, string> = {
  normal: "Normal",
  "above-normal": "Above normal",
  "below-normal": "Below normal",
  "unusually-high": "Unusually high",
  "unusually-low": "Unusually low",
};
const CLASS_BN: Record<string, string> = {
  normal: "স্বাভাবিক",
  "above-normal": "স্বাভাবিকের চেয়ে বেশি",
  "below-normal": "স্বাভাবিকের চেয়ে কম",
  "unusually-high": "অস্বাভাবিক বেশি",
  "unusually-low": "অস্বাভাবিক কম",
};

/** A pipeline class name in words. `extreme` takes its direction from the record. */
export function classLabel(cls: string | null | undefined, direction?: string | null): { en: string; bn: string } {
  if (!cls) return { en: "Not available", bn: "পাওয়া যায়নি" };
  if (cls === "extreme") return direction === "low" ? { en: "Extremely low", bn: "চরম কম" } : { en: "Extremely high", bn: "চরম বেশি" };
  return { en: CLASS_EN[cls] ?? cls, bn: CLASS_BN[cls] ?? cls };
}

export const PERIOD_LABEL: Record<string, { en: string; bn: string }> = {
  annual: { en: "Whole year", bn: "পুরো বছর" },
  "pre-monsoon": { en: "Pre-monsoon (Mar–May)", bn: "প্রাক-বর্ষা (মার্চ–মে)" },
  monsoon: { en: "Monsoon (Jun–Sep)", bn: "বর্ষা (জুন–সেপ্টেম্বর)" },
};

export function periodLabel(period: string): { en: string; bn: string } {
  return PERIOD_LABEL[period] ?? { en: period, bn: period };
}

/** A 0–1 share as a whole percentage, or an em dash when the pipeline left it empty. */
export function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

/** "+0.72" with a real minus sign, for values the pipeline already rounded. */
export function signed(value: number, decimals: number): string {
  const s = value.toFixed(decimals);
  return value > 0 ? `+${s}` : s.replace("-", "−");
}
