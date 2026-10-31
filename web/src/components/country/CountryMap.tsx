"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Leaf,
  Menu,
  PanelLeft,
  Pause,
  Play,
  Thermometer,
  X,
} from "lucide-react";
import { createBaseMap, type BaseMap } from "@/components/map/baseMap";
import { ForestLossLayer } from "@/components/map/forestLossLayer";
import { TrendLegend } from "@/components/ui";
import { GIcon, LAYER_ICONS, TREND_ICONS } from "@/components/ui/icons";
import { bnNum } from "@/lib/bn";
import type { Country } from "@/lib/countries";
import { pointInCountry } from "@/lib/geo";
import type { FireGrid, FloodEvent, HazardZone, LandslideEvent } from "@/lib/hazards";
import { T, useLang, useT } from "@/lib/i18n";
import { LAYERS, type GibsLayerDef } from "@/lib/layers";
import { cssVar, useTheme } from "@/lib/theme";
import {
  cellCenter,
  formatSigned,
  trendToken,
  type GridSpec,
  type TrendGrid,
  type VariableMeta,
} from "@/lib/trends";

/** The trend layers drawn from this project's own gridded results, clipped to the border. */
export interface CountryTrendLayer {
  id: string;
  key: string;
  variable: "temperature" | "rainfall" | "hot-months" | "dry-spell";
  label: string;
  labelBn: string;
  meta: VariableMeta;
  grid: GridSpec;
  stats: TrendGrid;
  limit: number;
}

export interface CountryMapData {
  trendLayers: CountryTrendLayer[];
  zones: HazardZone[];
  landslides: LandslideEvent[];
  floods: FloodEvent[];
  fires: FireGrid | null;
}

interface Props {
  country: Country;
  data: CountryMapData;
  /** Published dates per satellite layer id, so each layer's slider matches NASA's timeline. */
  datesByLayer: Record<string, string[]>;
}

type LayerKey = string;

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function CountryMap({ country, data, datesByLayer }: Props) {
  const t = useT();
  const lang = useLang();
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<BaseMap | null>(null);
  const layersRef = useRef<Record<string, L.Layer>>({});
  /** A canvas tied to the map data pane, created once the map exists. */
  const trendRendererRef = useRef<L.Canvas | null>(null);
  const [active, setActive] = useState<LayerKey>(data.trendLayers[0]?.id ?? "air-temp");
  const [playing, setPlaying] = useState(false);
  const [monthIndex, setMonthIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  // The layer list can be collapsed so the whole map is visible.
  const [panelOpen, setPanelOpen] = useState(false);
  // The legend can be hidden to clear the bottom of the map.
  const [legendOpen, setLegendOpen] = useState(false);

  // Every satellite layer in the shared catalog, so the country map never silently drops one.
  const gibs = useMemo(
    () => LAYERS.filter((l) => l.kind === "gibs" || l.kind === "forest-loss") as (GibsLayerDef | import("@/lib/layers").ForestLossLayerDef)[],
    [],
  );
  // Each layer has its own published timeline; keep the month index inside it.
  const dates = datesByLayer[active] ?? [];
  const safeIndex = Math.min(monthIndex, Math.max(dates.length - 1, 0));
  const date = dates[safeIndex] ?? null;
  const isGibs = gibs.some((g) => g.id === active);
  const trendLayer = data.trendLayers.find((l) => l.id === active) ?? null;

  // Map once; layers are added and removed as the selection changes. It is created on the
  // first effect pass, which runs before the layer effects below in this component.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const [[south, west], [north, east]] = country.bounds;
    const base = createBaseMap(el, { center: [(south + north) / 2, (west + east) / 2], zoom: 5 }, theme, "topright");
    baseRef.current = base;
    // The scale bar is not needed here and crowds the credits under the time slider.
    (base.map as L.Map & { scaleControl?: L.Control }).scaleControl?.remove();
    trendRendererRef.current = L.canvas({ pane: "data", padding: 0.5 }).addTo(base.map);

    // The country border sits above the data so the shape stays legible on every layer.
    const border = L.geoJSON(country.geometry as unknown as GeoJSON.GeoJsonObject, {
      pane: "reference",
      interactive: false,
      style: { color: cssVar("--ink"), weight: 2, fill: false, dashArray: undefined },
    }).addTo(base.map);
    layersRef.current.border = border;
    base.map.fitBounds([
      [south, west],
      [north, east],
    ], { padding: [24, 24] });
    base.map.setMaxBounds(L.latLngBounds([south - 4, west - 4], [north + 4, east + 4]));

    return () => {
      // Stop the canvas before the map is torn down; a late frame from a removed map
      // would otherwise redraw a canvas that no longer has a context.
      const map = baseRef.current?.map;
      const renderer = trendRendererRef.current;
      if (map && renderer && map.hasLayer(renderer)) map.removeLayer(renderer);
      trendRendererRef.current = null;
      base.dispose();
      baseRef.current = null;
      layersRef.current = {};
    };
    // The map is rebuilt when the country or theme changes; the theme is applied separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country.slug]);

  useEffect(() => {
    baseRef.current?.setTheme(theme);
    const border = layersRef.current.border as L.GeoJSON | undefined;
    border?.setStyle({ color: cssVar("--ink") });
  }, [theme]);

  // The data layer: either a NASA GIBS tile layer or a trend grid from this project.
  useEffect(() => {
    const base = baseRef.current;
    const old = layersRef.current.data;
    if (old && base?.map.hasLayer(old)) base.map.removeLayer(old);
    delete layersRef.current.data;
    if (!base) return;

    if (isGibs) {
      const def = gibs.find((g) => g.id === active)!;
      if (def.kind === "forest-loss") {
        const layer = new ForestLossLayer({
          url: def.tileUrl,
          firstYear: def.firstYear,
          lastYear: def.lastYear,
          startYear: def.firstYear,
          endYear: def.lastYear,
          maxNativeZoom: def.maxNativeZoom,
          opacity: 0.85,
          pane: "data",
        });
        layer.addTo(base.map);
        layersRef.current.data = layer;
      } else {
        const layer = L.tileLayer(
          `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${def.gibsId}/default/${date ?? def.fallbackTimes[0].split("/")[0]}/${def.tileMatrixSet}/{z}/{y}/{x}.png`,
          { pane: "data", maxNativeZoom: def.maxNativeZoom, opacity: 0.8, attribution: "NASA GIBS" },
        );
        layer.addTo(base.map);
        layersRef.current.data = layer;
      }
      return;
    }

    if (!trendLayer) return;
    const group = L.layerGroup().addTo(base.map);
    // One canvas for every square, instead of a DOM element per square.
    const renderer = trendRendererRef.current!;
    const bn = lang === "bn";
    const edge = cssVar("--page");
    const { grid, stats, meta } = trendLayer;
    stats.slopePerDecade.forEach((slope, k) => {
      if (slope === null || stats.mean[k] === null) return;
      const i = Math.floor(k / grid.nLon);
      const j = k % grid.nLon;
      const { lat, lon } = cellCenter(grid, i, j);
      // Only cells whose centre falls on this country; the border hides the rest of each square.
      if (!pointInCountry(country.geometry, lat, lon)) return;
      const clear = stats.significant[k] === 1;
      const rect = L.rectangle(
        [
          [lat - grid.dLat / 2, lon - grid.dLon / 2],
          [lat + grid.dLat / 2, lon + grid.dLon / 2],
        ],
        {
          renderer,
          color: edge,
          weight: 1,
          fillColor: cssVar(trendToken(slope, trendLayer.limit, trendLayer.variable)),
          fillOpacity: clear ? 0.85 : 0.28,
        },
      );
      const mean = stats.mean[k];
      rect.bindTooltip(
        bn
          ? `<strong>${bnNum(formatSigned(slope, meta.decimals + 1))} ${meta.unit} / ১০ বছর</strong><br>গড় ${bnNum(mean!.toFixed(meta.decimals))} ${meta.unit}<br>${clear ? "স্পষ্ট পরিবর্তন" : "স্পষ্ট পরিবর্তন নেই"}`
          : `<strong>${formatSigned(slope, meta.decimals + 1)} ${meta.unit} per decade</strong><br>Average ${mean!.toFixed(meta.decimals)} ${meta.unit}<br>${clear ? "Clear change (passes the map-wide test)" : "No clear change"}`,
        { sticky: true, direction: "top", className: "map-tooltip" },
      );
      rect.on("click", () => setSelected(`${formatSigned(slope, meta.decimals + 1)} ${meta.unit}/decade`));
      group.addLayer(rect);
    });
    layersRef.current.data = group;
  }, [active, date, gibs, isGibs, trendLayer, lang, theme, country.geometry]);

  // Hazard-zone outlines, so the "regions" section has a map counterpart.
  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;
    const old = layersRef.current.zones;
    if (old) base.map.removeLayer(old);
    const ink = cssVar("--ink");
    const group = L.layerGroup().addTo(base.map);
    for (const z of data.zones) {
      const [la0, la1, lo0, lo1] = z.bbox;
      L.rectangle(
        [
          [la0, lo0],
          [la1, lo1],
        ],
        { pane: "reference", interactive: false, fill: false, color: ink, weight: 1, dashArray: "3 5", opacity: 0.6 },
      )
        .bindTooltip(escape(z.name), { sticky: true, className: "map-tooltip" })
        .addTo(group);
    }
    layersRef.current.zones = group;
  }, [data.zones, theme]);

  // Optional month animation for the satellite layers.
  useEffect(() => {
    if (!playing || !isGibs || dates.length < 2) return;
    const id = window.setInterval(() => setMonthIndex((i) => (i + 1) % dates.length), 1400);
    return () => window.clearInterval(id);
  }, [playing, isGibs, dates.length]);

  const activeDef = isGibs ? gibs.find((g) => g.id === active) : undefined;

  return (
    <div className="country-map relative overflow-hidden rounded-2xl border border-line bg-sunken">
      <div ref={containerRef} className="h-[min(70svh,560px)] w-full" />

      {/* Layer list toggle: stays put whether the panel is open or closed. */}
      <button
        type="button"
        onClick={() => {
          setPanelOpen((o) => !o);
          setLegendOpen(false);
        }}
        aria-expanded={panelOpen}
        aria-controls="country-layer-panel"
        aria-label={panelOpen ? t("Hide layers", "স্তর লুকান") : t("Show layers", "স্তর দেখান")}
        title={panelOpen ? t("Hide layers", "স্তর লুকান") : t("Show layers", "স্তর দেখান")}
        className="absolute left-3 top-3 z-[var(--z-map-panel)] grid h-10 w-10 place-items-center rounded-xl border border-line bg-card/95 text-ink-2 shadow-soft backdrop-blur transition-colors hover:text-ink"
      >
        {panelOpen ? <PanelLeft size={18} /> : <Menu size={18} />}
      </button>

      {/* Layer list column on the left; the legend lives on the right so the two never compete. */}
      <div
        className={`pointer-events-none absolute left-3 top-16 z-[var(--z-map)] flex w-[15rem] max-w-[calc(100%-1.5rem)] flex-col ${
          isGibs && dates.length > 1 ? "bottom-14" : "bottom-2"
        }`}
      >
      {/* Layer switcher */}
      {panelOpen && (
        <div
          id="country-layer-panel"
          className="pointer-events-auto min-h-0 overflow-y-auto rounded-xl border border-line bg-card/95 p-2 shadow-soft backdrop-blur"
        >
          <div className="flex items-center justify-between pl-2 pr-1">
            <p className="pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              <T en="Trend layers (this project)" bn="প্রবণতা স্তর" />
            </p>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label={t("Hide layers", "স্তর লুকান")}
              className="grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
          <ul className="space-y-0.5">
            {data.trendLayers.map((l) => {
              const Icon = TREND_ICONS[l.variable] ?? Thermometer;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => { setActive(l.id); setPlaying(false); }}
                    aria-pressed={active === l.id}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${active === l.id ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-sunken"}`}
                  >
                    <GIcon icon={Icon} className="shrink-0 text-accent" />
                    <span><T en={l.label} bn={l.labelBn} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            <T en="Satellite imagery (NASA)" bn="স্যাটেলাইট চিত্র" />
          </p>
          <ul className="space-y-0.5">
            {gibs.map((l) => {
              const Icon = LAYER_ICONS[l.id] ?? Leaf;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => { setActive(l.id); setMonthIndex(0); setPlaying(false); }}
                    aria-pressed={active === l.id}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${active === l.id ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-sunken"}`}
                  >
                    <GIcon icon={Icon} className="shrink-0 text-accent" />
                    <span>{lang === "bn" ? l.bn.shortTitle : l.shortTitle}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      </div>

      {/* Legend on the right, clear of the attribution strip and the slideshow. */}
      <div
        className={`pointer-events-auto absolute right-3 z-[var(--z-map)] w-[min(15rem,calc(100%-1.5rem))] rounded-xl border border-line bg-card/95 shadow-soft backdrop-blur ${
          isGibs && dates.length > 1 ? "bottom-24" : "bottom-9"
        } ${legendOpen ? "p-3" : "px-3 py-1.5"}`}
      >
        <div className="flex items-start justify-between gap-2">
          {trendLayer ? (
            <p className={`text-xs font-medium text-ink ${legendOpen ? "mb-2" : ""}`}>
              <T en={trendLayer.label} bn={trendLayer.labelBn} />{" "}
              <span className="text-ink-3">
                (<T en="per decade" bn="প্রতি দশকে" />)
              </span>
            </p>
          ) : (
            <p className="text-xs font-medium text-ink">
              <T en="About this layer" bn="এই স্তর সম্পর্কে" />
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setLegendOpen((o) => !o);
              if (!legendOpen) setPanelOpen(false);
            }}
            aria-expanded={legendOpen}
            aria-controls="country-legend-body"
            aria-label={legendOpen ? t("Hide legend", "লিজেন্ড লুকান") : t("Show legend", "লিজেন্ড দেখান")}
            title={legendOpen ? t("Hide legend", "লিজেন্ড লুকান") : t("Show legend", "লিজেন্ড দেখান")}
            className="-mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
          >
            {legendOpen ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
          </button>
        </div>
        {legendOpen && (
          <div id="country-legend-body">
            {trendLayer ? (
              <>
                <TrendLegend
                  variable={trendLayer.variable}
                  limit={trendLayer.limit}
                  decimals={trendLayer.meta.decimals + 1}
                  decreaseWord={trendLayer.meta.decrease}
                  increaseWord={trendLayer.meta.increase}
                  compact
                  mobileCompact
                />
                <p className="mt-1.5 text-[11px] text-ink-3">
                  <T en="Solid = passes the map-wide test (FDR 10%). Faint = no clear change." bn="গাঢ় = মানচিত্র-ব্যাপী পরীক্ষায় উত্তীর্ণ। হালকা = স্পষ্ট পরিবর্তন নেই।" />
                </p>
                {selected && (
                  <p className="mt-1 text-[11px] text-ink-2">
                    <T en="Selected square:" bn="নির্বাচিত বর্গ:" /> <span className="tabular-nums">{selected}</span>
                  </p>
                )}
              </>
            ) : activeDef ? (
              <p className="text-xs text-ink-2">
                {lang === "bn" ? activeDef.bn.description : activeDef.description}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Time slider, only for time-enabled satellite layers. It sits above the credits so
          the two never overlap at the bottom of the map. */}
      {isGibs && dates.length > 1 && (
        <div className="absolute bottom-9 right-3 z-[var(--z-map)] flex items-center gap-2.5 rounded-xl border border-line bg-card/95 px-3 py-2 shadow-soft backdrop-blur">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[10px] text-accent-ink"
            aria-label={playing ? t("Pause months", "মাস থামান") : t("Play months", "মাস চালান")}
            aria-pressed={playing}
          >
            {playing ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden className="translate-x-px" />}
          </button>
          <input
            type="range"
            min={0}
            max={dates.length - 1}
            value={safeIndex}
            onChange={(e) => { setPlaying(false); setMonthIndex(Number(e.target.value)); }}
            aria-label={t("Month", "মাস")}
            aria-valuetext={date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : undefined}
            className="w-28 accent-[var(--accent)] sm:w-36"
          />
          <span className="w-[4.5rem] shrink-0 text-right text-xs tabular-nums text-ink-2">
            {date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "–"}
          </span>
        </div>
      )}

      <p className="sr-only">
        <T
          en={`Interactive map of ${country.name}: country border, trend squares and NASA satellite layers. Use the layer list to switch; zoom and pan to explore.`}
          bn={`${country.name}-এর ইন্টারঅ্যাকটিভ মানচিত্র: সীমান্ত, প্রবণতার বর্গ ও নাসার স্যাটেলাইট স্তর।`}
        />
      </p>
    </div>
  );
}
