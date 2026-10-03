"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { GIBS_WMTS, LAYERS } from "@/lib/layers";
import type { GibsLayerDef } from "@/lib/layers";

/**
 * Fixed snapshot used on the home page so the hero map matches the Explore page
 * when it is opened with the same layer and date.
 */
const HERO_LAYER_ID = "lst-day";
const HERO_DATE = "2026-08-01";

function heroLayer(): GibsLayerDef {
  const layer = LAYERS.find(
    (candidate): candidate is GibsLayerDef =>
      candidate.kind === "gibs" && candidate.id === HERO_LAYER_ID
  );
  if (!layer) {
    throw new Error(`Hero map layer "${HERO_LAYER_ID}" is not defined in LAYERS.`);
  }
  return layer;
}

export default function HeroEarthMap({ className = "aspect-square w-[340px] lg:w-[380px] rounded-xl" }: { className?: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const layer = heroLayer();

    const map = L.map(container, {
      center: [23.5, 81], // South Asia focus
      zoom: 4,
      minZoom: 2,
      maxZoom: 8,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      dragging: false,
      touchZoom: false,
    });

    mapRef.current = map;

    // Same WMTS tile construction as the Explore page's LeafletMap: the layer's
    // GIBS id and tile matrix set at the hero's fixed date.
    L.tileLayer(
      `${GIBS_WMTS}/${layer.gibsId}/default/${HERO_DATE}/${layer.tileMatrixSet}/{z}/{y}/{x}.png`,
      {
        maxNativeZoom: layer.maxNativeZoom,
        attribution: `<a href="${layer.sourceUrl}">${layer.mission}</a>`,
      }
    ).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      className={`${className} overflow-hidden shadow-lg`}
      style={{ position: "relative" }}
    />
  );
}