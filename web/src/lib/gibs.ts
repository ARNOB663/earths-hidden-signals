// Server-side reader for the NASA GIBS catalog (WMTS GetCapabilities) and colormaps.
// It asks NASA which dates exist for each layer and how its colors map to values,
// so the time slider only offers dates that really have imagery.

import { expandDailyIntervals, expandMonthlyIntervals } from "./dates";
import { GIBS_WMTS, LAYERS, type Conversion, type GibsLayerDef } from "./layers";

export interface GibsLayerInfo {
  dates: string[];
  /**
   * Every colour in NASA's colour map with the value it stands for, in display units, as
   * [r << 16 | g << 8 | b, value]. Each colour is unique, so the browser can read values back from
   * the image tiles (used to draw the difference between two dates).
   */
  values: [number, number][] | null;
  /** false when NASA could not be reached and built-in fallback dates are used. */
  live: boolean;
}

export type GibsCatalog = Record<string, GibsLayerInfo>;

const CAPABILITIES_URL = `${GIBS_WMTS}/1.0.0/WMTSCapabilities.xml`;
const ONE_DAY = 60 * 60 * 24;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: ONE_DAY }, signal: AbortSignal.timeout(30_000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

function layerBlock(capabilities: string, gibsId: string): string | null {
  const at = capabilities.indexOf(`<ows:Identifier>${gibsId}</ows:Identifier>`);
  if (at < 0) return null;
  return capabilities.slice(capabilities.lastIndexOf("<Layer>", at), capabilities.indexOf("</Layer>", at));
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

function convert(value: number, conversion: Conversion): number {
  if (conversion === "kelvin-to-celsius") return value - 273.15;
  if (conversion === "kgm2s-to-mm-day") return value * 86400;
  return value;
}

function expandDates(intervals: string[], period: "month" | "day"): string[] {
  return period === "day" ? expandDailyIntervals(intervals) : expandMonthlyIntervals(intervals);
}

/** Colour → value pairs for the data part of a colour map (see GibsLayerInfo.values). */
export function parseColorValues(xml: string, conversion: Conversion): [number, number][] | null {
  const maps = xml.match(/<ColorMap [\s\S]*?<\/ColorMap>/g) ?? [];
  const dataMap = maps.find((m) => /<Legend type="continuous"/.test(m));
  if (!dataMap) return null;
  const entries = (dataMap.match(/<ColorMapEntry [^>]*>/g) ?? [])
    .filter((e) => attr(e, "transparent") !== "true")
    .map((e) => {
      const rgb = (attr(e, "rgb") ?? "").split(",").map(Number);
      const [lo, hi] = (attr(e, "value") ?? "").replace(/[[\]()]/g, "").split(",").map((v) => Number(v.trim()));
      return { key: (rgb[0] << 16) | (rgb[1] << 8) | rgb[2], lo, hi };
    })
    .filter((e) => Number.isFinite(e.lo) || Number.isFinite(e.hi));
  if (entries.length < 2) return null;
  // Most bins are narrow; the first and last can be open-ended catch-alls ("below 200 K"). Those take
  // their inner edge rather than a meaningless midpoint.
  const widths = entries.filter((e) => Number.isFinite(e.lo) && Number.isFinite(e.hi)).map((e) => e.hi - e.lo).sort((a, b) => a - b);
  const typical = widths[Math.floor(widths.length / 2)] ?? 0;
  return entries.map((e, i) => {
    const wide = !Number.isFinite(e.lo) || !Number.isFinite(e.hi) || e.hi - e.lo > 5 * typical;
    const raw = !wide ? (e.lo + e.hi) / 2 : i < entries.length / 2 ? e.hi : e.lo;
    return [e.key, Number(convert(raw, conversion).toFixed(4))];
  });
}

async function describeLayer(layer: GibsLayerDef, capabilities: string | null): Promise<GibsLayerInfo> {
  const block = capabilities ? layerBlock(capabilities, layer.gibsId) : null;
  const liveTimes = block ? [...block.matchAll(/<Value>([^<]*)<\/Value>/g)].map((m) => m[1]) : [];
  const colormapUrl =
    block?.match(/colormap\/1\.3'[^>]*xlink:href='([^']*)'/)?.[1] ?? layer.fallbackColormap;

  const colormapXml = await fetchText(colormapUrl);
  const liveDates = expandDates(liveTimes, layer.period);

  return {
    dates: liveDates.length > 0 ? liveDates : expandDates(layer.fallbackTimes, layer.period),
    values: colormapXml ? parseColorValues(colormapXml, layer.conversion) : null,
    live: liveDates.length > 0,
  };
}

export async function getGibsCatalog(): Promise<GibsCatalog> {
  const capabilities = await fetchText(CAPABILITIES_URL);
  const gibsLayers = LAYERS.filter((l): l is GibsLayerDef => l.kind === "gibs");
  const infos = await Promise.all(gibsLayers.map((l) => describeLayer(l, capabilities)));
  return Object.fromEntries(gibsLayers.map((l, i) => [l.id, infos[i]]));
}
