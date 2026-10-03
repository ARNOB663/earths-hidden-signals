"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { GIBS_WMTS, type LayerDef } from "@/lib/layers";
import { cssVar, useTheme } from "@/lib/theme";
import { createBaseMap, type BaseMap } from "./baseMap";
import { DifferenceLayer } from "./differenceLayer";
import { hexToRgb, type DiffKind } from "./diffColors";
import { ForestLossLayer } from "./forestLossLayer";
import type { MapPlace } from "@/lib/mapPlaces";

export type MapFocus = "south-asia" | "world";

/** Settings for showing the change between the two compare dates as one coloured layer. */
export interface DiffSettings {
  values: [number, number][];
  range: number;
  kind: DiffKind;
}

/** A map position: centre and zoom level. */
export interface MapView {
  lat: number;
  lon: number;
  zoom: number;
}

const FOCUS: Record<MapFocus, { center: L.LatLngExpression; zoom: number }> = {
  "south-asia": { center: [23.5, 81], zoom: 4 },
  world: { center: [20, 20], zoom: 2 },
};

interface Props {
  layer: LayerDef;
  date: string | null;
  yearRange: [number, number];
  opacity: number;
  showReference: boolean;
  focus: { target: MapFocus; nonce: number };
  onLoadingChange: (loading: boolean) => void;
  onForestStats: (totals: number[]) => void;
  /** When set, the left part of the map shows this date and the right part shows `date`. */
  compareDate: string | null;
  /** Where the divider sits, 0 (left edge) to 1 (right edge). */
  split: number;
  /** Where the map opens (defaults to South Asia). */
  initialView?: MapView | null;
  /** Called after the map stops moving, so the page can keep the position in its link. */
  onViewChange?: (view: MapView) => void;
  /** With a compare date: show the change between the dates as one layer, instead of side by side. */
  diff?: DiffSettings | null;
  selectedPlace?: MapPlace | null;
  panelHidden?: boolean;
}

type DataLayer = L.TileLayer | ForestLossLayer | DifferenceLayer;
const kindOf = (l: DataLayer) => (l instanceof ForestLossLayer ? "forest" : l instanceof DifferenceLayer ? "diff" : "tiles");

export default function LeafletMap({
  layer,
  date,
  yearRange,
  opacity,
  showReference,
  focus,
  onLoadingChange,
  onForestStats,
  compareDate,
  split,
  initialView,
  onViewChange,
  diff,
  selectedPlace = null,
  panelHidden = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dataRef = useRef<DataLayer | null>(null);
  const staleRef = useRef(new Set<DataLayer>());
  const referenceRef = useRef<L.LayerGroup | null>(null);
  const baseRef = useRef<BaseMap | null>(null);
  const compareRef = useRef<L.TileLayer | null>(null);
  const splitRef = useRef(split);
  const theme = useTheme();
  const selectionRef = useRef<L.LayerGroup | null>(null);
  const previousSelection = useRef<string | null>(null);
  const panelHiddenRef = useRef(panelHidden);
  useEffect(() => { panelHiddenRef.current = panelHidden; }, [panelHidden]);

  // Compare mode: clip the "then" layer to the left of the divider and everything else to the right.
  // Clipping uses layer coordinates, so it must be recomputed whenever the map moves.
  const clipLayers = useRef(() => {
    const map = mapRef.current;
    if (!map) return;
    const others = [dataRef.current, ...staleRef.current].filter(Boolean) as DataLayer[];
    const then = compareRef.current;
    if (!then) {
      for (const l of others) {
        const el = l.getContainer();
        if (el) el.style.clip = "";
      }
      return;
    }
    const nw = map.containerPointToLayerPoint([0, 0]);
    const se = map.containerPointToLayerPoint(map.getSize());
    const cx = nw.x + (se.x - nw.x) * splitRef.current;
    const thenEl = then.getContainer();
    if (thenEl) thenEl.style.clip = `rect(${nw.y}px, ${cx}px, ${se.y}px, ${nw.x}px)`;
    for (const l of others) {
      const el = l.getContainer();
      if (el) el.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${cx}px)`;
    }
  });

  // Keep latest callbacks/values reachable from Leaflet event handlers without re-creating layers.
  const latest = useRef({ onLoadingChange, onForestStats, opacity, yearRange, onViewChange, diff });
  useEffect(() => {
    latest.current = { onLoadingChange, onForestStats, opacity, yearRange, onViewChange, diff };
  });
  // The difference layer is rebuilt when its dates, variable or theme change.
  const diffActive = !!diff && !!compareDate && layer.kind === "gibs";
  const diffKey = diffActive ? `${compareDate}|${theme}` : "";
  const startView = useRef(initialView);

  useEffect(() => {
    const start = startView.current;
    const base = createBaseMap(
      containerRef.current!,
      start ? { center: [start.lat, start.lon], zoom: start.zoom } : FOCUS["south-asia"],
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    );
    baseRef.current = base;
    mapRef.current = base.map;
    referenceRef.current = base.reference;
    const reclip = () => clipLayers.current();
    const reportView = () => {
      const c = base.map.getCenter();
      latest.current.onViewChange?.({ lat: c.lat, lon: c.wrap().lng, zoom: base.map.getZoom() });
    };
    base.map.on("move zoom resize", reclip);
    base.map.on("moveend", reportView);
    return () => {
      base.map.off("move zoom resize", reclip);
      base.map.off("moveend", reportView);
      base.dispose();
      mapRef.current = null;
      dataRef.current = null;
    };
  }, []);

  useEffect(() => {
    baseRef.current?.setTheme(theme);
  }, [theme]);

  // Swap the data layer when the variable or date changes. The new layer fades in
  // over the old one, so stepping through months doesn't flash an empty map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const previous = dataRef.current;
    let next: DataLayer;

    if (layer.kind === "gibs") {
      if (!date) return;
      const template = (d: string) => `${GIBS_WMTS}/${layer.gibsId}/default/${d}/${layer.tileMatrixSet}/{z}/{y}/{x}.png`;
      const settings = latest.current.diff;
      next =
        diffKey && settings
          ? new DifferenceLayer({
              pane: "data",
              urlThen: template(diffKey.split("|")[0]),
              urlNow: template(date),
              values: settings.values,
              range: settings.range,
              kind: settings.kind,
              mid: hexToRgb(cssVar("--mid")),
              maxNativeZoom: layer.maxNativeZoom,
              opacity: latest.current.opacity,
              attribution: '<a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>',
            })
          : L.tileLayer(template(date), {
              pane: "data",
              maxNativeZoom: layer.maxNativeZoom,
              opacity: latest.current.opacity,
              attribution: '<a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>',
            });
    } else {
      const [startYear, endYear] = latest.current.yearRange;
      next = new ForestLossLayer({
        pane: "data",
        url: layer.tileUrl,
        tileSize: 256,
        maxNativeZoom: layer.maxNativeZoom,
        firstYear: layer.firstYear,
        lastYear: layer.lastYear,
        startYear,
        endYear,
        opacity: latest.current.opacity,
        onStats: (totals) => latest.current.onForestStats(totals),
        attribution:
          'Tree cover loss: <a href="https://glad.earthengine.app/view/global-forest-change">Hansen/UMD/Google/USGS/NASA</a> via <a href="https://www.globalforestwatch.org/">GFW</a>',
      });
    }

    // Every older layer stays visible until the newest one has loaded, then all are dropped.
    const stale = staleRef.current;
    if (previous) stale.add(previous);
    const clearStale = () => {
      for (const old of stale) map.removeLayer(old);
      stale.clear();
    };
    const onLoad = () => {
      latest.current.onLoadingChange(false);
      clearStale();
    };

    latest.current.onLoadingChange(true);
    next.on("load", onLoad);
    next.addTo(map);
    dataRef.current = next;
    clipLayers.current();

    // Different kinds of layer never blend well; drop the old ones right away.
    if (previous && kindOf(previous) !== kindOf(next)) clearStale();

    return () => {
      next.off("load", onLoad);
    };
  }, [layer, date, diffKey]);

  // The "then" layer for compare mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (compareRef.current) {
      map.removeLayer(compareRef.current);
      compareRef.current = null;
    }
    if (layer.kind === "gibs" && compareDate && !diffActive) {
      compareRef.current = L.tileLayer(
        `${GIBS_WMTS}/${layer.gibsId}/default/${compareDate}/${layer.tileMatrixSet}/{z}/{y}/{x}.png`,
        { pane: "data", maxNativeZoom: layer.maxNativeZoom, opacity: latest.current.opacity },
      ).addTo(map);
    }
    clipLayers.current();
  }, [layer, compareDate, diffActive]);

  useEffect(() => {
    splitRef.current = split;
    clipLayers.current();
  }, [split]);

  useEffect(() => {
    dataRef.current?.setOpacity(opacity);
    compareRef.current?.setOpacity(opacity);
  }, [opacity]);

  useEffect(() => {
    const current = dataRef.current;
    if (current instanceof ForestLossLayer) current.setYears(yearRange[0], yearRange[1]);
  }, [yearRange]);

  useEffect(() => {
    const map = mapRef.current;
    const group = referenceRef.current;
    if (!map || !group) return;
    if (showReference) group.addTo(map);
    else group.remove();
  }, [showReference]);

  useEffect(() => {
    if (focus.nonce === 0) return;
    const { center, zoom } = FOCUS[focus.target];
    mapRef.current?.flyTo(center, zoom, { duration: 1.2 });
  }, [focus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize({ pan: false });
    selectionRef.current?.remove();
    selectionRef.current = null;
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    const paddingTopLeft: L.PointExpression = desktop && !panelHiddenRef.current ? [380, 76] : [20, 76];
    const paddingBottomRight: L.PointExpression = desktop ? [24, 36] : [20, 200];
    if (selectedPlace) {
      if (!map.getPane("selection")) map.createPane("selection").style.zIndex = "480";
      const feature = { type: "Feature" as const, properties: {}, geometry: selectedPlace.geometry };
      const outline = L.geoJSON(feature, { pane: "selection", interactive: false, style: { color: "#111111", weight: 4, fill: false } });
      const highlight = L.geoJSON(feature, { pane: "selection", style: { color: "#5098ea", weight: 2, fillOpacity: 0.04, dashArray: selectedPlace.type === "region" ? "6 4" : undefined } });
      const label = document.createElement("span");
      label.textContent = selectedPlace.name;
      highlight.bindTooltip(label, { permanent: true, direction: "center" });
      selectionRef.current = L.layerGroup([outline, highlight]).addTo(map);
      map.flyToBounds(selectedPlace.bounds, { paddingTopLeft, paddingBottomRight, duration: 1.2, maxZoom: 8 });
    } else if (previousSelection.current) {
      map.flyToBounds([[5, 60], [38, 100]], { paddingTopLeft, paddingBottomRight, duration: 1.2 });
    }
    previousSelection.current = selectedPlace?.id ?? null;
    return () => { selectionRef.current?.remove(); selectionRef.current = null; };
  }, [selectedPlace]);

  return <div ref={containerRef} className="h-full w-full bg-sunken" />;
}
