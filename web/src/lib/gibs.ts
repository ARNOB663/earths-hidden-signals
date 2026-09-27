// Server-side reader for the NASA GIBS catalog (WMTS GetCapabilities) and colormaps.
// It asks NASA which dates exist for each layer and how its colors map to values,
// so the time slider only offers dates that really have imagery.

import { expandMonthlyIntervals } from "./dates";
import { GIBS_WMTS, LAYERS, type Conversion, type GibsLayerDef } from "./layers";

export interface LegendTick {
  /** 0..1 position along the color bar. */
  position: number;
  label: string;
}

export interface Legend {
  gradient: string;
  ticks: LegendTick[];
  minLabel: string;
  maxLabel: string;
}

export interface GibsLayerInfo {
  dates: string[];
  legend: Legend | null;
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

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8805;/g, "≥")
    .replace(/&#8804;/g, "≤")
    .replace(/&amp;/g, "&");
}

function convert(value: number, conversion: Conversion): number {
  if (conversion === "kelvin-to-celsius") return value - 273.15;
  if (conversion === "kgm2s-to-mm-day") return value * 86400;
  return value;
}

function formatValue(value: number, conversion: Conversion): string {
  const v = convert(value, conversion);
  if (conversion === "kelvin-to-celsius") return `${Math.round(v)}°`;
  if (conversion === "kgm2s-to-mm-day") return v < 10 ? v.toFixed(1) : v.toFixed(0);
  return String(Number(v.toFixed(2)));
}

/** Rewrites a label like "< 200.0" into display units, keeping the comparison sign. */
function convertBoundLabel(raw: string | undefined, conversion: Conversion): string {
  if (!raw) return "";
  const label = decodeEntities(raw);
  const num = label.match(/-?\d+(\.\d+)?(e[-+]?\d+)?/i);
  if (!num) return label;
  const sign = label.slice(0, num.index).trim();
  return `${sign ? `${sign} ` : ""}${formatValue(Number(num[0]), conversion)}`;
}

export function parseColormap(xml: string, conversion: Conversion): Legend | null {
  const maps = xml.match(/<ColorMap [\s\S]*?<\/ColorMap>/g) ?? [];
  const dataMap = maps.find((m) => /<Legend type="continuous"/.test(m));
  if (!dataMap) return null;

  const legendTag = dataMap.match(/<Legend type="continuous"[^>]*>/)![0];
  const entries = dataMap.match(/<LegendEntry [^>]*>/g) ?? [];
  if (entries.length < 2) return null;

  const last = entries.length - 1;
  // A few dozen stops are plenty for a smooth CSS gradient.
  const step = Math.max(1, Math.floor(entries.length / 48));
  const stops: string[] = [];
  entries.forEach((e, i) => {
    if (i % step === 0 || i === last) stops.push(`rgb(${attr(e, "rgb")}) ${((i / last) * 100).toFixed(1)}%`);
  });

  const ticks: LegendTick[] = [];
  entries.forEach((e, i) => {
    if (attr(e, "showLabel") !== "true") return;
    const num = decodeEntities(attr(e, "tooltip") ?? "").match(/-?\d+(\.\d+)?(e[-+]?\d+)?/i);
    if (num) ticks.push({ position: i / last, label: formatValue(Number(num[0]), conversion) });
  });

  return {
    gradient: `linear-gradient(to right, ${stops.join(", ")})`,
    ticks,
    minLabel: convertBoundLabel(attr(legendTag, "minLabel"), conversion),
    maxLabel: convertBoundLabel(attr(legendTag, "maxLabel"), conversion),
  };
}

async function describeLayer(layer: GibsLayerDef, capabilities: string | null): Promise<GibsLayerInfo> {
  const block = capabilities ? layerBlock(capabilities, layer.gibsId) : null;
  const liveTimes = block ? [...block.matchAll(/<Value>([^<]*)<\/Value>/g)].map((m) => m[1]) : [];
  const colormapUrl =
    block?.match(/colormap\/1\.3'[^>]*xlink:href='([^']*)'/)?.[1] ?? layer.fallbackColormap;

  const colormapXml = await fetchText(colormapUrl);
  const liveDates = expandMonthlyIntervals(liveTimes);

  return {
    dates: liveDates.length > 0 ? liveDates : expandMonthlyIntervals(layer.fallbackTimes),
    legend: colormapXml ? parseColormap(colormapXml, layer.conversion) : null,
    live: liveDates.length > 0,
  };
}

export async function getGibsCatalog(): Promise<GibsCatalog> {
  const capabilities = await fetchText(CAPABILITIES_URL);
  const gibsLayers = LAYERS.filter((l): l is GibsLayerDef => l.kind === "gibs");
  const infos = await Promise.all(gibsLayers.map((l) => describeLayer(l, capabilities)));
  return Object.fromEntries(gibsLayers.map((l, i) => [l.id, infos[i]]));
}
