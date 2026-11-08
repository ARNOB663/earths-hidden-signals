// Types and wording for public/data/future/outlook.json (produced by analysis/future.py).
// No server imports, so client components can use it.

export type MetricKey =
  | "tMean"
  | "hotDays"
  | "annualRain"
  | "monsoonRain"
  | "heavyDays"
  | "wettestDay"
  | "drySpell"
  | "preTemp"
  | "preRain";
export type ExceedKey = "wetMonsoon" | "dryMonsoon" | "heavyYear" | "hotYear";
export type ScenarioKey = "ssp245" | "ssp585";

export interface Spread {
  median: number;
  min: number;
  max: number;
  perModel: Record<string, number>;
}

export interface OutlookRegion {
  id: string;
  name: string;
  hazard: "flood" | "landslide" | "wildfire" | null;
  focus: MetricKey[];
  present: Record<MetricKey, number>;
  scenarios: Record<
    ScenarioKey,
    {
      metrics: Record<MetricKey, Spread & { agree: number }>;
      exceedance: Record<ExceedKey, Spread & { today: number }>;
    }
  >;
}

export interface Outlook {
  generated: string;
  dataset: string;
  datasetUrl: string;
  models: string[];
  present: [number, number];
  future: [number, number];
  scenarios: Record<ScenarioKey, string>;
  metrics: Record<MetricKey, { label: string; unit: string; kind: "abs" | "pct"; decimals: number }>;
  exceedance: Record<ExceedKey, { metric: MetricKey; tail: "high" | "low"; label: string }>;
  regions: OutlookRegion[];
}

export const METRIC_ORDER: MetricKey[] = [
  "tMean",
  "preTemp",
  "hotDays",
  "annualRain",
  "monsoonRain",
  "preRain",
  "heavyDays",
  "wettestDay",
  "drySpell",
];
export const EXCEED_ORDER: ExceedKey[] = ["wetMonsoon", "heavyYear", "dryMonsoon", "hotYear"];

export const METRIC_BN: Record<MetricKey, string> = {
  tMean: "গড় তাপমাত্রা",
  hotDays: "বছরে অস্বাভাবিক গরম দিন (মৌসুমের তুলনায়)",
  annualRain: "বার্ষিক বৃষ্টি",
  monsoonRain: "বর্ষার বৃষ্টি (জুন–সেপ্টে)",
  heavyDays: "বছরে অতি ভারী বৃষ্টির দিন",
  wettestDay: "সবচেয়ে বৃষ্টির দিনে বৃষ্টি",
  drySpell: "বর্ষায় দীর্ঘতম শুকনো সময়",
  preTemp: "গরমের মৌসুমের তাপমাত্রা (মার্চ–মে)",
  preRain: "গরমের মৌসুমের বৃষ্টি (মার্চ–মে)",
};

export const EXCEED_WORDS: Record<ExceedKey, { en: string; bn: string; short: string; shortBn: string }> = {
  wetMonsoon: {
    en: "A monsoon as wet as today's 1-in-10 wettest",
    bn: "আজকের ১০ বছরে ১ বার হওয়া সবচেয়ে ভেজা বর্ষার মতো বর্ষা",
    short: "Very wet monsoon",
    shortBn: "অতি ভেজা বর্ষা",
  },
  heavyYear: {
    en: "A year with as many very heavy rain days as today's 1-in-10",
    bn: "আজকের ১০ বছরে ১ বারের মতো অতি ভারী বৃষ্টির দিনের বছর",
    short: "Year of many downpours",
    shortBn: "বহু প্রবল বর্ষণের বছর",
  },
  dryMonsoon: {
    en: "A monsoon as dry as today's 1-in-10 driest",
    bn: "আজকের ১০ বছরে ১ বার হওয়া সবচেয়ে শুকনো বর্ষার মতো বর্ষা",
    short: "Very dry monsoon",
    shortBn: "অতি শুকনো বর্ষা",
  },
  hotYear: {
    en: "A year as hot as today's 1-in-10 hottest",
    bn: "আজকের ১০ বছরে ১ বার হওয়া সবচেয়ে গরম বছরের মতো বছর",
    short: "Very hot year",
    shortBn: "অতি গরম বছর",
  },
};

export const SCENARIO_WORDS: Record<ScenarioKey, { en: string; bn: string; hint: string; hintBn: string }> = {
  ssp245: {
    en: "Middle road",
    bn: "মাঝামাঝি পথ",
    hint: "SSP2-4.5: emissions peak mid-century",
    hintBn: "SSP2-4.5: শতাব্দীর মাঝামাঝি নিঃসরণ চূড়ায়",
  },
  ssp585: {
    en: "High emissions",
    bn: "উচ্চ নিঃসরণ",
    hint: "SSP5-8.5: emissions keep rising",
    hintBn: "SSP5-8.5: নিঃসরণ বাড়তেই থাকে",
  },
};

/**
 * A yearly rate in words that matches the 10-dot rows: "2 in 10 years". Rare rates (below 1 in 10)
 * read "1 in 20 years"; the ends read "almost never" / "almost every year".
 */
export function oneIn(rate: number): { en: string; bn: string } {
  if (rate >= 0.95) return { en: "almost every year", bn: "প্রায় প্রতি বছর" };
  if (rate <= 0.02) return { en: "almost never", bn: "প্রায় কখনোই না" };
  if (rate < 0.095) {
    const n = Math.round(1 / rate);
    return { en: `1 in ${n} years`, bn: `${toBn(n)} বছরে ১ বার` };
  }
  const k = Math.round(rate * 10);
  return { en: `${k} in 10 years`, bn: `১০ বছরে ${toBn(k)} বার` };
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toBn = (n: number | string) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

export function signedChange(v: number, kind: "abs" | "pct", decimals: number): string {
  const d = kind === "pct" ? 0 : decimals;
  const s = Math.abs(v).toFixed(d);
  const sign = Number(s) === 0 ? "" : v > 0 ? "+" : "−";
  return `${sign}${s}${kind === "pct" ? "%" : ""}`;
}
