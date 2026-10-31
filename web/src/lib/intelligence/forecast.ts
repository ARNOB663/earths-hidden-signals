// The forecast contract: what a forecast feed must provide before this site may show one.
// No forecast is integrated. The /location and /methods pages render this as an explicit gap.

export interface ForecastContract {
  /** Issuing agency and product (for example a national met service's extended-range outlook). */
  provider: string;
  /** Issue time and the period the forecast covers. */
  issuedAt: string;
  validFrom: string;
  validTo: string;
  /** Probabilities for terciles (below / near / above normal) against the same 1991–2020 baseline. */
  terciles: { below: number; near: number; above: number };
  /** Published skill for this season and region, so the forecast can be weighed. */
  skill: { metric: string; value: number; reference: string };
  /** Spatial support of the forecast, in the same units as the observation grid. */
  gridDeg: number;
}

export const FORECAST_GAP = {
  en: "No forecast is integrated. Everything on this page is an observation of a past period. A forecast would need an issuing agency, an issue time and validity window, tercile probabilities against the same 1991–2020 baseline, published skill for this season and region, and its grid size.",
  bn: "কোনো পূর্বাভাস যুক্ত করা হয়নি। এই পাতার সবকিছুই অতীত সময়ের পর্যবেক্ষণ। পূর্বাভাস যুক্ত করতে হলে প্রকাশকারী সংস্থা, প্রকাশের সময় ও মেয়াদ, একই ১৯৯১–২০২০ বেসলাইনের বিপরীতে তিন-ভাগ সম্ভাবনা, এই মৌসুম ও অঞ্চলের জন্য প্রকাশিত দক্ষতা এবং গ্রিডের আকার দরকার।",
};

export const FORECAST_FIELDS: { key: keyof ForecastContract; en: string; bn: string }[] = [
  { key: "provider", en: "Issuing agency and product", bn: "প্রকাশকারী সংস্থা ও পণ্য" },
  { key: "issuedAt", en: "Issue time", bn: "প্রকাশের সময়" },
  { key: "validFrom", en: "Validity window", bn: "মেয়াদ" },
  { key: "terciles", en: "Tercile probabilities vs 1991–2020", bn: "১৯৯১–২০২০-এর বিপরীতে তিন-ভাগ সম্ভাবনা" },
  { key: "skill", en: "Published skill for the season and region", bn: "মৌসুম ও অঞ্চলের জন্য প্রকাশিত দক্ষতা" },
  { key: "gridDeg", en: "Grid size", bn: "গ্রিডের আকার" },
];
