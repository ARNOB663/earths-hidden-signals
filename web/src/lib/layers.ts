// Map layers shown in the Map Explorer.
// "gibs" layers are NASA GIBS WMTS tiles (pre-rendered, time-enabled, no API key).
// "forest-loss" is the Hansen/UMD Global Forest Change product (built from NASA/USGS
// Landsat) served as encoded tiles by Global Forest Watch; we decode them in the browser.

export type LayerCategory = "heat" | "water" | "vegetation" | "forest";

export type Conversion = "kelvin-to-celsius" | "kgm2s-to-mm-day" | "none";

interface BaseLayer {
  id: string;
  title: string;
  shortTitle: string;
  category: LayerCategory;
  mission: string;
  description: string;
  /** Why this variable matters for the project's hazard story. */
  relevance: string;
  sourceUrl: string;
  /** Bangla versions of the texts above. */
  bn: { shortTitle: string; description: string; relevance: string; unit?: string };
}

export interface GibsLayerDef extends BaseLayer {
  kind: "gibs";
  gibsId: string;
  tileMatrixSet: string;
  maxNativeZoom: number;
  period: "month";
  conversion: Conversion;
  displayUnit: string;
  /**
   * How to draw the difference between two dates: the change that gets the strongest colour
   * (display units), the unit shown, and which colour scheme ("temp" blue↔red, "rain" brown↔blue,
   * "green" brown↔green).
   */
  diff: { range: number; unit: string; unitBn: string; kind: "temp" | "rain" | "green" };
  /** Used when the live GIBS catalog cannot be reached. */
  fallbackTimes: string[];
  fallbackColormap: string;
}

export interface ForestLossLayerDef extends BaseLayer {
  kind: "forest-loss";
  tileUrl: string;
  maxNativeZoom: number;
  firstYear: number;
  lastYear: number;
}

export type LayerDef = GibsLayerDef | ForestLossLayerDef;

export const GIBS_WMTS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

export const LAYERS: LayerDef[] = [
  {
    kind: "gibs",
    id: "lst-day",
    title: "Land Surface Temperature (Day)",
    shortTitle: "Ground heat",
    bn: {
      shortTitle: "মাটির তাপ",
      description: "দিনের বেলা মাটির উপরিভাগ কতটা গরম হয়, নাসার টেরা স্যাটেলাইট মহাকাশ থেকে প্রতি মাসে তা মাপে।",
      relevance: "খুব গরম, শুকনো মাটি মাটি ও গাছপালাকে শুকিয়ে দেয়, ফলে দাবানল ও তাপজনিত বিপদ বাড়ে।",
      unit: "°সে",
    },
    category: "heat",
    mission: "MODIS · Terra",
    gibsId: "MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    maxNativeZoom: 6,
    period: "month",
    conversion: "kelvin-to-celsius",
    displayUnit: "°C",
    diff: { range: 8, unit: "°C", unitBn: "°সে", kind: "temp" },
    description: "How hot the ground gets in the daytime, measured every month from space by NASA's Terra satellite.",
    relevance: "Very hot, dry ground dries out soil and plants, which makes wildfires and heat stress more likely.",
    sourceUrl: "https://lpdaac.usgs.gov/products/mod11c3v061/",
    fallbackTimes: ["2000-03-01/2026-08-01/P1M"],
    fallbackColormap: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Land_Surface_Temp.xml",
  },
  {
    kind: "gibs",
    id: "air-temp",
    title: "Air Temperature (2 m)",
    shortTitle: "Air temperature",
    bn: {
      shortTitle: "বাতাসের তাপমাত্রা",
      description: "মাটি থেকে ২ মিটার উপরে বাতাস কতটা গরম, ১৯৮০ সাল থেকে প্রতি মাসে। তথ্য নাসার MERRA-2 আবহাওয়া মডেল থেকে।",
      relevance: "এটি এখানকার সবচেয়ে দীর্ঘ রেকর্ড, তাই অঞ্চলটি কতটা গরম হয়েছে তা দেখার জন্য এটিই সেরা স্তর।",
      unit: "°সে",
    },
    category: "heat",
    mission: "MERRA-2 · NASA GMAO model",
    gibsId: "MERRA2_2m_Air_Temperature_Monthly",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    maxNativeZoom: 6,
    period: "month",
    conversion: "kelvin-to-celsius",
    displayUnit: "°C",
    diff: { range: 3, unit: "°C", unitBn: "°সে", kind: "temp" },
    description: "How warm the air is, 2 metres above the ground, every month since 1980. It comes from NASA's MERRA-2 weather model.",
    relevance: "This is the longest record here, so it is the best layer for seeing how much warmer the region has become.",
    sourceUrl: "https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/",
    fallbackTimes: ["1980-01-01/2023-11-01/P1M", "2024-02-01/2024-04-01/P1M", "2024-06-01/2026-06-01/P1M"],
    fallbackColormap: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MERRA2_2m_Air_Temperature_Monthly.xml",
  },
  {
    kind: "gibs",
    id: "precip",
    title: "Rainfall Rate (Monthly)",
    shortTitle: "Rain",
    bn: {
      shortTitle: "বৃষ্টি",
      description: "প্রতিদিন কত বৃষ্টি হয়, মাসের গড় হিসেবে। নাসার GLDAS মডেল স্যাটেলাইট ও বৃষ্টিমাপক যন্ত্রের তথ্য মেলায়।",
      relevance: "বর্ষার ভারী বৃষ্টি সমতলে বন্যা আর ভেজা পাহাড়ি ঢালে ভূমিধস ঘটায়।",
      unit: "মিমি/দিন",
    },
    category: "water",
    mission: "GLDAS · Noah land model",
    gibsId: "GLDAS_Surface_Total_Precipitation_Rate_Monthly",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    maxNativeZoom: 6,
    period: "month",
    conversion: "kgm2s-to-mm-day",
    displayUnit: "mm/day",
    diff: { range: 4, unit: "mm/day", unitBn: "মিমি/দিন", kind: "rain" },
    description: "How much rain falls per day, averaged over each month. NASA's GLDAS model combines satellite and rain-gauge data.",
    relevance: "Heavy monsoon rain causes floods on the plains and landslides on wet mountain slopes.",
    sourceUrl: "https://ldas.gsfc.nasa.gov/gldas",
    fallbackTimes: ["2000-01-01/2026-05-01/P1M"],
    fallbackColormap:
      "https://gibs.earthdata.nasa.gov/colormaps/v1.3/GLDAS_Surface_Total_Precipitation_Rate_Monthly.xml",
  },
  {
    kind: "gibs",
    id: "ndvi",
    title: "Vegetation Greenness (NDVI)",
    shortTitle: "Greenness",
    bn: {
      shortTitle: "সবুজের পরিমাণ",
      description: "জমি কতটা সবুজ ও পাতায় ভরা। খালি জমি প্রায় ০, ঘন বন প্রায় ১।",
      relevance: "শুষ্ক মৌসুমে গাছপালা বাদামি হয়ে গেলে তা আগুনের জ্বালানি হয়ে ওঠে।",
      unit: "সবুজ (০ থেকে ১)",
    },
    category: "vegetation",
    mission: "MODIS · Terra",
    gibsId: "MODIS_Terra_L3_NDVI_Monthly",
    tileMatrixSet: "GoogleMapsCompatible_Level7",
    maxNativeZoom: 7,
    period: "month",
    conversion: "none",
    displayUnit: "greenness (0 to 1)",
    diff: { range: 0.25, unit: "greenness", unitBn: "সবুজ", kind: "green" },
    description: "How green and leafy the land is. Bare ground is close to 0; thick forest is close to 1.",
    relevance: "When plants turn brown in the dry season, they become fuel for fires.",
    sourceUrl: "https://lpdaac.usgs.gov/products/mod13c2v061/",
    fallbackTimes: ["2000-03-01/2025-03-01/P1M", "2025-05-01/2026-08-01/P1M"],
    fallbackColormap: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml",
  },
  {
    kind: "forest-loss",
    id: "forest-loss",
    title: "Tree Cover Loss (Deforestation)",
    shortTitle: "Forest loss",
    bn: {
      shortTitle: "বন উজাড়",
      description: "কোথায়, কোন বছর গাছ কাটা হয়েছে বা পুড়েছে, ল্যান্ডস্যাট স্যাটেলাইট ৩০ মিটার পর্যন্ত খুঁটিনাটিতে দেখে।",
      relevance: "গাছ হারালে ঢাল দুর্বল হয় (বেশি ভূমিধস) আর বৃষ্টির পানি দ্রুত গড়িয়ে যায় (বেশি বন্যা)।",
    },
    category: "forest",
    mission: "Landsat (NASA/USGS) · Hansen/UMD GFC",
    tileUrl: "https://tiles.globalforestwatch.org/umd_tree_cover_loss/v1.13/dynamic/{z}/{x}/{y}.png",
    maxNativeZoom: 12,
    firstYear: 2001,
    lastYear: 2025,
    description: "Where trees were cut down or burned, and in which year, seen by Landsat satellites in 30-metre detail.",
    relevance: "Losing trees weakens slopes (more landslides) and lets rain run off faster (more floods).",
    sourceUrl: "https://glad.earthengine.app/view/global-forest-change",
  },
];
