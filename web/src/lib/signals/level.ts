// The two words every Signal page uses, and nothing else:
//
//   Coverage state — why a location has (or lacks) a reading.
//   Watch Level    — what the observed rain is doing against its own history.
//   Data Trust Grade — how far that reading can be checked against the historical record.
//
// There is no Green and no "safe". The calm level is never "all clear": the data showing nothing
// unusual is not a statement about the ground, and no level ever means a place is safe.
// The pipeline maps statuses to these values (scripts/signals/level.py); this file only renders
// them, so the two languages of the site cannot drift apart.

import type { FrequencyLevel } from "./model";
import type { Status, TrustState } from "./types";

export type CoverageState = "live" | "seasonal" | "cant-tell";
export type WatchLevel = "none" | "elevated" | "high" | "unknown";
export type TrustGrade = "high" | "medium" | "low";

export interface LevelWords {
  en: string;
  bn: string;
  /** Short label for chips and map legends. */
  shortEn: string;
  shortBn: string;
  /** A one-line meaning. Never "safe", never "all clear". */
  meaningEn: string;
  meaningBn: string;
}

export const COVERAGE: Record<CoverageState, LevelWords> = {
  live: {
    en: "Live Signal",
    bn: "সরাসরি সংকেত",
    shortEn: "Live",
    shortBn: "সরাসরি",
    meaningEn: "A current rain observation is available for this location.",
    meaningBn: "এই স্থানের জন্য সাম্প্রতিক বৃষ্টির পর্যবেক্ষণ আছে।",
  },
  seasonal: {
    en: "Seasonal Context Only",
    bn: "কেবল মৌসুমি প্রেক্ষাপট",
    shortEn: "Seasonal",
    shortBn: "মৌসুমি",
    meaningEn: "No current rain reading covers this location. Only seasonal and historical climate records apply.",
    meaningBn: "এই স্থানকে কোনো সাম্প্রতিক বৃষ্টির পাঠ ঢাকে না। কেবল মৌসুমি ও ঐতিহাসিক জলবায়ুর তথ্য প্রযোজ্য।",
  },
  "cant-tell": {
    en: "Can't Tell Here",
    bn: "এখানে বলা সম্ভব নয়",
    shortEn: "Can't tell",
    shortBn: "বলা যায় না",
    meaningEn: "The data needed to judge this location is missing, too sparse, or too old.",
    meaningBn: "এই স্থান বিচার করার জন্য প্রয়োজনীয় তথ্য অনুপস্থিত, অতি বিরল, বা খুব পুরোনো।",
  },
};

export const WATCH: Record<WatchLevel, LevelWords & { cls: string; soft: string }> = {
  none: {
    en: "No elevated watch",
    bn: "উচ্চ সতর্কতা নেই",
    shortEn: "None elevated",
    shortBn: "উচ্চতর নয়",
    meaningEn: "Observed rain is not unusual for this date in its own record. This is not an all-clear.",
    meaningBn: "পর্যবেক্ষিত বৃষ্টি এই তারিখের নিজস্ব রেকর্ডে অস্বাভাবিক নয়। এটি নিরাপত্তার নিশ্চয়তা নয়।",
    cls: "text-ink",
    soft: "bg-sunken",
  },
  elevated: {
    en: "Watch Level: Elevated",
    bn: "সতর্কতার মাত্রা: বর্ধিত",
    shortEn: "Elevated",
    shortBn: "বর্ধিত",
    meaningEn: "Observed rain is unusually high for this date in its own history.",
    meaningBn: "পর্যবেক্ষিত বৃষ্টি এই তারিখের নিজস্ব ইতিহাসে অস্বাভাবিকভাবে বেশি।",
    cls: "text-watch",
    soft: "bg-watch-soft",
  },
  high: {
    en: "Watch Level: High",
    bn: "সতর্কতার মাত্রা: উচ্চ",
    shortEn: "High",
    shortBn: "উচ্চ",
    meaningEn: "Observed rain is one of the highest readings for this date in the record.",
    meaningBn: "পর্যবেক্ষিত বৃষ্টি এই তারিখের রেকর্ডে সবচেয়ে উঁচু পাঠগুলির একটি।",
    cls: "text-alert",
    soft: "bg-alert-soft",
  },
  unknown: {
    en: "Watch Level: Can't tell",
    bn: "সতর্কতার মাত্রা: বলা সম্ভব নয়",
    shortEn: "Can't tell",
    shortBn: "বলা যায় না",
    meaningEn: "There is no reading to judge. A gap is not quiet.",
    meaningBn: "বিচারের মতো কোনো পাঠ নেই। ফাঁক মানে শান্ত অবস্থা নয়।",
    cls: "text-ink-3",
    soft: "bg-sunken",
  },
};

export const TRUST: Record<TrustGrade, LevelWords & { cls: string; soft: string }> = {
  high: {
    en: "Data Trust Grade: High",
    bn: "তথ্য-ভরসার গ্রেড: উচ্চ",
    shortEn: "High",
    shortBn: "উচ্চ",
    meaningEn: "Long baseline, dense coverage, current observation, and a historical case set large enough to compare.",
    meaningBn: "দীর্ঘ ভিত্তি-রেকর্ড, ঘন আচ্ছাদন, সাম্প্রতিক পর্যবেক্ষণ, এবং তুলনার জন্য যথেষ্ট বড় ঐতিহাসিক নমুনা।",
    cls: "text-ink",
    soft: "bg-card",
  },
  medium: {
    en: "Data Trust Grade: Medium",
    bn: "তথ্য-ভরসার গ্রেড: মাঝারি",
    shortEn: "Medium",
    shortBn: "মাঝারি",
    meaningEn: "One data-quality factor is weaker: a shorter baseline, sparse cells, an older reading, or a small case set.",
    meaningBn: "একটি মানের কারণ দুর্বল: ছোট ভিত্তি-রেকর্ড, বিরল কোষ, পুরোনো পাঠ, বা ছোট নমুনা।",
    cls: "text-ink",
    soft: "bg-sunken",
  },
  low: {
    en: "Data Trust Grade: Low",
    bn: "তথ্য-ভরসার গ্রেড: নিম্ন",
    shortEn: "Low",
    shortBn: "নিম্ন",
    meaningEn: "Two or more factors are weak. Treat the reading as indicative only.",
    meaningBn: "দুই বা তার বেশি কারণ দুর্বল। পাঠটিকে কেবল ইঙ্গিতমূলক ধরে নিন।",
    cls: "text-ink-3",
    soft: "bg-sunken",
  },
};

/** The pipeline's cell status → the public Watch Level. Grey is "can't tell", never "calm". */
export function watchFromStatus(status: Status): WatchLevel {
  if (status === "red") return "high";
  if (status === "yellow") return "elevated";
  if (status === "green") return "none";
  return "unknown";
}

/** The pipeline's area-trend trust → the three public grades. Anything unmeasurable is Low. */
export function trustFromState(state: TrustState): TrustGrade {
  if (state === "detectable") return "high";
  if (state === "blind-spot") return "medium";
  return "low";
}

/** The coverage state written by scripts/signals/level.py on each place record. */
export function coverageOf(record: { coverageState?: string } | null | undefined): CoverageState {
  const value = record?.coverageState;
  return value === "live" || value === "seasonal" ? value : "cant-tell";
}

/** "floods in 3 of 26 years (95% 4–28%)" — the interval wording every surface shares. */
export function formatFrequency(level: FrequencyLevel): { en: string; bn: string } {
  const low = (level.low * 100).toFixed(0);
  const high = (level.high * 100).toFixed(0);
  return {
    en: `${level.floods} of ${level.cases} historical cases (95% interval ${low}–${high}%)`,
    bn: `${level.cases}টি ঐতিহাসিক ক্ষেত্রে ${level.floods}টিতে বন্যা নথিভুক্ত (৯৫% ব্যবধান ${low}–${high}%)`,
  };
}

/** The sentence used wherever a frequency cannot be read out, with its Bangla pair. */
export const FREQUENCY_UNKNOWN = {
  en: "Not enough historical evidence to calculate a reliable frequency.",
  bn: "নির্ভরযোগ্য ফ্রিকোয়েন্সি গণনার জন্য যথেষ্ট ঐতিহাসিক প্রমাণ নেই।",
} as const;
