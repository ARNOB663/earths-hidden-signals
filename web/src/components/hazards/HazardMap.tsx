"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { createBaseMap } from "@/components/map/baseMap";
import type { FireGrid, FloodEvent, HazardId, HazardZone, LandslideEvent } from "@/lib/hazards";
import { fireColor, FLOOD_ALERT_COLORS, LANDSLIDE_COLOR } from "./hazardColors";

interface Props {
  hazard: HazardId;
  zones: HazardZone[];
  selectedZone: string;
  onSelectZone: (id: string) => void;
  landslides: LandslideEvent[] | null;
  floods: FloodEvent[] | null;
  fires: FireGrid | null;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function HazardMap({ hazard, zones, selectedZone, onSelectZone, landslides, floods, fires }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const eventsRef = useRef<L.LayerGroup | null>(null);
  const zonesRef = useRef<L.LayerGroup | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const onSelectRef = useRef(onSelectZone);
  useEffect(() => {
    onSelectRef.current = onSelectZone;
  });

  useEffect(() => {
    const base = createBaseMap(containerRef.current!, { center: [22, 80], zoom: 4 });
    mapRef.current = base.map;
    rendererRef.current = L.canvas({ pane: "data", padding: 0.5 });
    eventsRef.current = L.layerGroup().addTo(base.map);
    zonesRef.current = L.layerGroup().addTo(base.map);
    return () => {
      base.dispose();
      mapRef.current = null;
    };
  }, []);

  // Past events for the chosen hazard.
  useEffect(() => {
    const group = eventsRef.current;
    const renderer = rendererRef.current;
    if (!group || !renderer) return;
    group.clearLayers();

    if (hazard === "wildfire" && fires) {
      const h = fires.cell / 2;
      for (const [lat, lon, avg] of fires.cells) {
        const color = fireColor(avg);
        if (!color) continue;
        L.rectangle(
          [
            [lat - h, lon - h],
            [lat + h, lon + h],
          ],
          { renderer, stroke: false, fillColor: color, fillOpacity: 0.8 },
        )
          .bindTooltip(`<strong>${avg}</strong> fire detections per year (Mar–May)<br>${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E`, {
            sticky: true,
            className: "trend-tooltip",
          })
          .addTo(group);
      }
    }

    if (hazard === "landslide" && landslides) {
      for (const e of landslides) {
        L.circleMarker([e.lat, e.lon], {
          renderer,
          radius: e.fatalities && e.fatalities >= 10 ? 5 : 3,
          color: "#0b0f14",
          weight: 1,
          fillColor: LANDSLIDE_COLOR,
          fillOpacity: 0.85,
        })
          .bindTooltip(
            `<strong>${escapeHtml(e.title)}</strong><br>${e.date} · ${escapeHtml(e.trigger.replace(/_/g, " "))}` +
              (e.fatalities ? ` · ${e.fatalities} deaths` : ""),
            { className: "trend-tooltip" },
          )
          .addTo(group);
      }
    }

    if (hazard === "flood" && floods) {
      for (const e of floods) {
        L.circleMarker([e.lat, e.lon], {
          renderer,
          radius: e.alert === "Red" ? 7 : e.alert === "Orange" ? 5.5 : 4,
          color: "#0b0f14",
          weight: 1.5,
          fillColor: FLOOD_ALERT_COLORS[e.alert] ?? "#94a3b8",
          fillOpacity: 0.85,
        })
          .bindTooltip(
            `<strong>${escapeHtml(e.title)}</strong><br>${e.date}${e.end ? ` to ${e.end}` : ""} · ${escapeHtml(e.alert)} alert`,
            { className: "trend-tooltip" },
          )
          .addTo(group);
      }
    }
  }, [hazard, landslides, floods, fires]);

  // Region outlines for this hazard; click one to select it.
  useEffect(() => {
    const group = zonesRef.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();
    for (const z of zones) {
      const [la0, la1, lo0, lo1] = z.bbox;
      const selected = z.id === selectedZone;
      const rect = L.rectangle(
        [
          [la0, lo0],
          [la1, lo1],
        ],
        {
          pane: "reference",
          fill: true,
          fillOpacity: 0,
          color: selected ? "#f8fafc" : "#94a3b8",
          weight: selected ? 2.5 : 1.2,
          dashArray: selected ? undefined : "5 4",
        },
      );
      rect.bindTooltip(escapeHtml(z.name), { className: "trend-tooltip", direction: "top" });
      rect.on("click", () => onSelectRef.current(z.id));
      group.addLayer(rect);
    }
    // The reference pane ignores the pointer (labels shouldn't block the map); outlines need clicks.
    map.getPane("reference")!.style.pointerEvents = "none";
    group.eachLayer((l) => {
      const el = (l as L.Path).getElement?.();
      if (el) (el as HTMLElement).style.pointerEvents = "auto";
    });
  }, [zones, selectedZone]);

  // Frame the selected region.
  useEffect(() => {
    const zone = zones.find((z) => z.id === selectedZone);
    const map = mapRef.current;
    if (!zone || !map) return;
    const [la0, la1, lo0, lo1] = zone.bbox;
    map.flyToBounds(
      [
        [la0, lo0],
        [la1, lo1],
      ],
      { padding: [60, 60], maxZoom: 7, duration: 0.8 },
    );
  }, [selectedZone, zones]);

  return <div ref={containerRef} className="h-full w-full bg-[#0b0f14]" />;
}
