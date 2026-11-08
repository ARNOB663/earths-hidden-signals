// Types and display helpers for public/data/twins/ (produced by analysis/twins.py). No server
// imports, so client components can use it; pages read the JSON through lib/data.ts readData.

export type FeatureKey = "warming" | "rainTrend" | "wetTrend" | "wetness" | "seasonality";
export type EventType = "flood" | "drought" | "cyclone" | "landslide";

export interface TrendTest {
  perDecade: number;
  lower: number;
  upper: number;
  p: number;
}

export interface Place {
  features: Record<FeatureKey, number>;
  tests: Record<"warming" | "rainTrend" | "wetTrend", TrendTest | null>;
  meanRainMm: number;
  wetMonths: number[];
  counts: Record<EventType, { all: number; severe: number }>;
  notable: { type: EventType; date: string; alert: string; title: string; deaths?: number }[];
}

export interface Block extends Place {
  id: string;
  bbox: [number, number, number, number];
  name: string;
  countries: string[];
  home: boolean;
}

export interface Twin {
  id: string;
  distance: number;
  percentile: number;
  /** 1 = the closest land block on Earth (South Asia's own blocks included in the count). */
  rank: number;
  /** Per-feature distance in weighted standard units: small = matches, large = differs. */
  gap: Record<FeatureKey, number>;
}

export interface Region extends Place {
  id: string;
  name: string;
  hazard: "flood" | "landslide" | "wildfire" | null;
  bbox: [number, number, number, number];
  twins: Twin[];
  /** Similarity percentile of every block, in the order of `blocks`. */
  similarity: number[];
}

export interface TwinsData {
  generated: string;
  years: [number, number];
  eventYears: [number, number];
  block: number;
  features: { key: FeatureKey; label: string; unit: string; weight: number }[];
  method: { test: string; match: string; data: string };
  blocks: Block[];
  regions: Region[];
}

export type TwinSeries = Record<string, { temperature: (number | null)[]; rain: number[] }>;

export const EVENT_WORDS: Record<EventType, { en: string; bn: string }> = {
  flood: { en: "Floods", bn: "বন্যা" },
  drought: { en: "Droughts", bn: "খরা" },
  cyclone: { en: "Cyclones", bn: "ঘূর্ণিঝড়" },
  landslide: { en: "Landslides", bn: "ভূমিধস" },
};

export const FEATURE_WORDS: Record<FeatureKey, { en: string; bn: string; unit: string; unitBn: string }> = {
  warming: { en: "Warming rate", bn: "উষ্ণতার হার", unit: "°C / 10 yr", unitBn: "°সে / ১০ বছর" },
  rainTrend: { en: "Yearly rain trend", bn: "বার্ষিক বৃষ্টির প্রবণতা", unit: "% / 10 yr", unitBn: "% / ১০ বছর" },
  wetTrend: { en: "Rainy-season trend", bn: "বর্ষা মৌসুমের প্রবণতা", unit: "% / 10 yr", unitBn: "% / ১০ বছর" },
  wetness: { en: "Yearly rain", bn: "বার্ষিক বৃষ্টি", unit: "mm", unitBn: "মিমি" },
  seasonality: { en: "Rain in rainy season", bn: "বর্ষায় বৃষ্টির ভাগ", unit: "%", unitBn: "%" },
};

/** Display value for a feature: wetness is stored as log10 mm, seasonality as a share. */
export function featureValue(key: FeatureKey, v: number): string {
  if (key === "wetness") return `${Math.round(10 ** v).toLocaleString("en-US")}`;
  if (key === "seasonality") return `${Math.round(v * 100)}`;
  const s = Math.abs(v).toFixed(key === "warming" ? 2 : 1);
  return Number(s) === 0 ? s : `${v > 0 ? "+" : "−"}${s}`;
}
