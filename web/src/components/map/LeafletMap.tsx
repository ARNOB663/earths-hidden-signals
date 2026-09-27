"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { GIBS_WMTS, type LayerDef } from "@/lib/layers";
import { createBaseMap } from "./baseMap";
import { ForestLossLayer } from "./forestLossLayer";

export type MapFocus = "south-asia" | "world";

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
}

type DataLayer = L.TileLayer | ForestLossLayer;

export default function LeafletMap({
  layer,
  date,
  yearRange,
  opacity,
  showReference,
  focus,
  onLoadingChange,
  onForestStats,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dataRef = useRef<DataLayer | null>(null);
  const staleRef = useRef(new Set<DataLayer>());
  const referenceRef = useRef<L.LayerGroup | null>(null);

  // Keep latest callbacks/values reachable from Leaflet event handlers without re-creating layers.
  const latest = useRef({ onLoadingChange, onForestStats, opacity, yearRange });
  useEffect(() => {
    latest.current = { onLoadingChange, onForestStats, opacity, yearRange };
  });

  useEffect(() => {
    const base = createBaseMap(containerRef.current!, FOCUS["south-asia"]);
    mapRef.current = base.map;
    referenceRef.current = base.reference;
    return () => {
      base.dispose();
      mapRef.current = null;
      dataRef.current = null;
    };
  }, []);

  // Swap the data layer when the variable or date changes. The new layer fades in
  // over the old one, so stepping through months doesn't flash an empty map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const previous = dataRef.current;
    let next: DataLayer;

    if (layer.kind === "gibs") {
      if (!date) return;
      next = L.tileLayer(
        `${GIBS_WMTS}/${layer.gibsId}/default/${date}/${layer.tileMatrixSet}/{z}/{y}/{x}.png`,
        {
          pane: "data",
          maxNativeZoom: layer.maxNativeZoom,
          opacity: latest.current.opacity,
          attribution: '<a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>',
        },
      );
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

    // Different kinds of layer never blend well; drop the old ones right away.
    if (previous && (previous instanceof ForestLossLayer) !== (next instanceof ForestLossLayer)) clearStale();

    return () => {
      next.off("load", onLoad);
    };
  }, [layer, date]);

  useEffect(() => {
    dataRef.current?.setOpacity(opacity);
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

  return <div ref={containerRef} className="h-full w-full bg-[#0b0f14]" />;
}
