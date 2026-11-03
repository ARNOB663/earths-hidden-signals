"use client";

// The Signals map. Two layers, drawn in the order readers need:
//
// 1. The 45-year trend grid (the analysis pipeline's Sen slope, 0.5°): the South Asia context the
//    boundary list alone cannot give, and the "where is the change" background.
// 2. The covered areas, shaded by their Now status in the same colours as the list. The outline
//    carries Trust: solid = detectable, dashed = blind spot, dotted = no history.
//
// Colour is never the only cue: every area also carries its status word in the list beside the map,
// and the map has a written legend. Leaflet is browser-only; the page imports this with SSR off.

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { createBaseMap, createCanvasRenderer, type BaseMap } from "@/components/map/baseMap";
import { T, useLang, useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import {
  createRasterOverlay,
  loadRaster,
  loadRasterIndex,
  loadRasterMeta,
  rampColor,
  type RasterIndex,
  type RasterMeta,
} from "./trendRaster";

export interface MapArea {
  id: string;
  name: string;
  level: "ADM1" | "ADM2";
  status: "red" | "yellow" | "green" | "no-data";
  trust: "detectable" | "blind-spot" | "no-data";
  rings: [number, number][][];
}

export interface MapTile {
  id: string;
  label: string;
  ring: [number, number][];
}

interface Props {
  areas: MapArea[];
  tiles: MapTile[];
  selected: string | null;
  onSelect: (id: string) => void;
}

const STATUS_WORD = {
  red: { en: "Red", bn: "লাল" },
  yellow: { en: "Yellow", bn: "হলুদ" },
  green: { en: "Green", bn: "সবুজ" },
  "no-data": { en: "No data", bn: "তথ্য নেই" },
} as const;

const FILL: Record<MapArea["status"], string> = {
  red: "#b45309",
  yellow: "#a16207",
  green: "#15803d",
  "no-data": "#9ca3af",
};

const TRUST_STROKE: Record<MapArea["trust"], { color: string; dashArray?: string }> = {
  detectable: { color: "#111827" },
  "blind-spot": { color: "#6b7280", dashArray: "4 3" },
  "no-data": { color: "#9ca3af", dashArray: "1 4" },
};

export default function SignalsMap({ areas, tiles, selected, onSelect }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const base = useRef<BaseMap | null>(null);
  const areasLayer = useRef<L.LayerGroup | null>(null);
  const selectLayer = useRef<L.LayerGroup | null>(null);
  const rasterLayer = useRef<L.ImageOverlay | null>(null);
  const theme = useTheme();
  const t = useT();
  const lang = useLang();
  // Set by the load effect before the map exists, and read by the map's own effect: both are
  // effects, so the order is fixed by declaration and needs no shared state.
  const [raster, setRaster] = useState<
    { state: "loading" | "missing"; meta?: RasterMeta } | { state: "ready"; meta: RasterMeta }
  >({ state: "loading" });
  // The decoded overlay per raster key, so switching variable is instant after the first load.
  const overlays = useRef(new Map<string, { url: string; meta: RasterMeta }>());
  const [index, setIndex] = useState<RasterIndex | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const selectRef = useRef(onSelect);
  const drawAreas = (
    list: MapArea[],
    boxes: MapTile[],
    language: "en" | "bn",
  ) => {
    const group = areasLayer.current;
    if (!group) return;
    group.clearLayers();
    // The area canvas is its own pane, above the trend background (360) and below Esri's labels.
    const renderer = createCanvasRenderer({ padding: 0.5, pane: "data" });

    for (const tile of boxes) {
      L.rectangle(
        L.latLngBounds([tile.ring[0][1], tile.ring[0][0]], [tile.ring[2][1], tile.ring[2][0]]),
        { pane: "data", color: "#6b7280", weight: 1, dashArray: "6 6", fill: false, interactive: false, renderer },
      ).addTo(group);
    }

    // Canvas shapes draw in add order, so the largest go first and the ADM2 fill sits on top.
    const ordered = [...list].sort((a, b) => a.level.localeCompare(b.level));
    for (const area of ordered) {
      const stroke = TRUST_STROKE[area.trust];
      const shape = L.polygon(area.rings, {
        renderer,
        pane: "data",
        color: stroke.color,
        dashArray: stroke.dashArray,
        weight: area.level === "ADM1" ? 1.2 : 0.6,
        // A 0.55 wash of the status colour over a coloured background reads as a new colour; a
        // light fill plus a strong outline keeps the status word and the map colour in step.
        fillColor: FILL[area.status],
        fillOpacity: area.status === "no-data" ? 0.12 : 0.3,
      });
      shape.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        selectRef.current(area.id);
      });
      const word = language === "bn" ? STATUS_WORD[area.status].bn : STATUS_WORD[area.status].en;
      shape.bindTooltip(`${area.name} — ${word}`, { sticky: true });
      shape.addTo(group);
    }
  };

  useEffect(() => {
    drawAreas(areas, tiles, lang);
  }, [areas, tiles, lang]);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);
  // The map is created one frame after mount (to measure the laid-out container); the data
  // effects may already have run by then, so keep the latest props for that late creation.
  const latest = useRef({ areas, tiles, key, lang });
  useEffect(() => {
    latest.current = { areas, tiles, key, lang };
  }, [areas, tiles, key, lang]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let map: BaseMap | null = null;
    // Leaflet measures its container once, at init, and the dynamic import mounts it before the
    // CSS grid has laid out (0×0) — which pinned the canvas at its 1028 px default. Measure in the
    // container's next frame instead, when it has its real size.
    const frame = requestAnimationFrame(() => {
      map = createBaseMap(container, { center: [25, 79], zoom: 4.4 }, theme, "topright");
      base.current = map;
      map.map.attributionControl.addAttribution('Areas &copy; <a href="https://www.geoboundaries.org/">geoBoundaries</a>');
      areasLayer.current = L.layerGroup().addTo(map.map);
      selectLayer.current = L.layerGroup().addTo(map.map);
      map.map.on("click", () => selectRef.current(""));
      const ready = latest.current.key ? overlays.current.get(latest.current.key) : undefined;
      if (ready) rasterLayer.current = createRasterOverlay(ready.url, ready.meta, 0.75).addTo(map.map);
      drawAreas(latest.current.areas, latest.current.tiles, latest.current.lang);
    });
    return () => {
      cancelAnimationFrame(frame);
      map?.dispose();
      base.current = null;
    };
    // The map is created once; later effects draw into it and handle theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The index lists the variables the build wrote; a missing file is a real state the legend
  // reports, never a silent blank.
  useEffect(() => {
    const controller = new AbortController();
    loadRasterIndex(controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setIndex(loaded);
        setKey(loaded.default);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRaster({ state: "missing" });
      });
    return () => controller.abort();
  }, []);

  // Decode the chosen variable once, then hand it to the map (which may already exist).
  useEffect(() => {
    if (!key) return;
    const ready = overlays.current.get(key);
    if (ready) {
      setRaster({ state: "ready", meta: ready.meta });
      if (base.current) {
        if (rasterLayer.current) base.current.map.removeLayer(rasterLayer.current);
        rasterLayer.current = createRasterOverlay(ready.url, ready.meta, 0.75).addTo(base.current.map);
      }
      return;
    }
    const controller = new AbortController();
    setRaster({ state: "loading" });
    (async () => {
      try {
        const meta = await loadRasterMeta(key, controller.signal);
        const url = await loadRaster(meta, controller.signal);
        if (controller.signal.aborted) return;
        overlays.current.set(key, { url, meta });
        if (base.current) {
          if (rasterLayer.current) base.current.map.removeLayer(rasterLayer.current);
          rasterLayer.current = createRasterOverlay(url, meta, 0.75).addTo(base.current.map);
        }
        setRaster({ state: "ready", meta });
      } catch {
        if (!controller.signal.aborted) setRaster({ state: "missing" });
      }
    })();
    return () => controller.abort();
  }, [key]);

  useEffect(() => {
    base.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const group = selectLayer.current;
    if (!group) return;
    group.clearLayers();
    const area = areas.find((candidate) => candidate.id === selected);
    if (area) {
      L.polygon(area.rings, { pane: "data", color: "#111827", weight: 3, fill: false, interactive: false }).addTo(group);
    }
  }, [selected, areas]);

  const legend = raster.state === "ready" ? raster.meta : null;
  const [low, high] = legend?.range ?? [0, 1];
  const gradient = legend
    ? `linear-gradient(to right, ${legend.legend
        .slice()
        .sort((a, b) => a.at - b.at)
        .map((stop) => `${rampColor(legend, low + ((high - low) * stop.at) / 100)} ${stop.at}%`)
        .join(", ")})`
    : "";

  return (
    <figure className="m-0">
      <div
        ref={host}
        role="application"
        aria-label={t(
          "Map: South Asia trend background, with covered areas shaded by today's status and outlined by Trust.",
          "মানচিত্র: দক্ষিণ এশিয়ার প্রবণতার পটভূমি, আজকের অবস্থা অনুযায়ী আচ্ছাদিত এলাকা রঙিন এবং ভরসা অনুযায়ী রূপরেখা।",
        )}
        className="h-[380px] w-full overflow-hidden rounded-2xl border border-line bg-sunken sm:h-[520px]"
      />
      <figcaption className="mt-2 space-y-1.5">
        {index && index.variables.length > 1 && (
          <div role="group" aria-label={t("Trend background", "প্রবণতার পটভূমি")} className="flex flex-wrap gap-1.5">
            {index.variables.map((variable) => (
              <button
                key={variable.key}
                type="button"
                aria-pressed={key === variable.key}
                onClick={() => setKey(variable.key)}
                className={`min-h-8 rounded-full border px-3 text-xs transition-colors ${
                  key === variable.key
                    ? "border-accent bg-accent-soft font-medium text-ink"
                    : "border-line bg-card text-ink-2 hover:text-ink"
                }`}
              >
                {lang === "bn" ? variable.labelBn : variable.label}
              </button>
            ))}
          </div>
        )}
        {legend ? (
          <div>
            <div className="flex items-baseline justify-between text-xs text-ink-2">
              <span>
                <T
                  en={`${legend.label}, ${legend.yearFirst}–${legend.yearLast} (Sen's slope, per decade)`}
                  bn={`${legend.labelBn}, ${legend.yearFirst}–${legend.yearLast} (সেনের ঢাল, প্রতি দশকে)`}
                />
              </span>
              <span className="tabular-nums text-ink-3">
                {low} → {high} {legend.unit}
              </span>
            </div>
            <div aria-hidden className="mt-1 h-2 w-full rounded-full" style={{ background: gradient }} />
          </div>
        ) : (
          <p className="text-xs text-ink-3">
            <T
              en={raster.state === "missing" ? "The trend background is not built. Areas and their statuses are still shown." : "Loading the trend background…"}
              bn={raster.state === "missing" ? "প্রবণতার পটভূমি তৈরি হয়নি। এলাকা ও তাদের অবস্থা এখনও দেখানো হচ্ছে।" : "প্রবণতার পটভূমি লোড হচ্ছে…"}
            />
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <svg aria-hidden width="22" height="8" viewBox="0 0 22 8">
              <line x1="0" y1="4" x2="22" y2="4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {t("Trust: detectable", "ভরসা: শনাক্তযোগ্য")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg aria-hidden width="22" height="8" viewBox="0 0 22 8">
              <line x1="0" y1="4" x2="22" y2="4" stroke="currentColor" strokeDasharray="4 3" />
            </svg>
            {t("blind spot", "অন্ধ স্থান")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg aria-hidden width="22" height="8" viewBox="0 0 22 8">
              <line x1="0" y1="4" x2="22" y2="4" stroke="currentColor" strokeDasharray="1 4" />
            </svg>
            {t("no history", "ইতিহাস নেই")}
          </span>
        </div>
      </figcaption>
    </figure>
  );
}
