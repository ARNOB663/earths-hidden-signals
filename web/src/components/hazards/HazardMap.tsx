"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { createBaseMap, type BaseMap } from "@/components/map/baseMap";
import type { FireGrid, FloodEvent, HazardId, HazardZone, LandslideEvent } from "@/lib/hazards";
import { cssVar, useTheme } from "@/lib/theme";
import { EVENT_TOKEN, fireToken, FLOOD_ALERT_COLORS } from "./hazardColors";

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

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function HazardMap({ hazard, zones, selectedZone, onSelectZone, landslides, floods, fires }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<BaseMap | null>(null);
  const eventsRef = useRef<L.LayerGroup | null>(null);
  const zonesRef = useRef<L.LayerGroup | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const theme = useTheme();
  const onSelectRef = useRef(onSelectZone);
  useEffect(() => {
    onSelectRef.current = onSelectZone;
  });

  useEffect(() => {
    const base = createBaseMap(
      containerRef.current!,
      { center: [22, 88], zoom: 4 },
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      "topleft",
    );
    baseRef.current = base;
    rendererRef.current = L.canvas({ pane: "data", padding: 0.5 });
    eventsRef.current = L.layerGroup().addTo(base.map);
    zonesRef.current = L.layerGroup().addTo(base.map);
    return () => {
      base.dispose();
      baseRef.current = null;
    };
  }, []);

  useEffect(() => {
    baseRef.current?.setTheme(theme);
  }, [theme]);

  // Past events for the chosen disaster type.
  useEffect(() => {
    const group = eventsRef.current;
    const renderer = rendererRef.current;
    if (!group || !renderer) return;
    group.clearLayers();
    const edge = cssVar("--card");

    if (hazard === "wildfire" && fires) {
      const h = fires.cell / 2;
      for (const [lat, lon, avg] of fires.cells) {
        const token = fireToken(avg);
        if (!token) continue;
        L.rectangle(
          [
            [lat - h, lon - h],
            [lat + h, lon + h],
          ],
          { renderer, stroke: false, fillColor: cssVar(token), fillOpacity: 0.85 },
        )
          .bindTooltip(`<strong>About ${Math.round(avg)} fires a year</strong><br>seen by satellite in March–May`, {
            sticky: true,
            className: "map-tooltip",
          })
          .addTo(group);
      }
    }

    if (hazard === "landslide" && landslides) {
      const color = cssVar(EVENT_TOKEN.landslide);
      for (const e of landslides) {
        L.circleMarker([e.lat, e.lon], {
          renderer,
          radius: e.fatalities && e.fatalities >= 10 ? 6 : 3.5,
          color: edge,
          weight: 1,
          fillColor: color,
          fillOpacity: 0.9,
        })
          .bindTooltip(
            `<strong>${escapeHtml(e.title)}</strong><br>${prettyDate(e.date)}` +
              (e.fatalities ? ` · ${e.fatalities} people died` : ""),
            { className: "map-tooltip" },
          )
          .addTo(group);
      }
    }

    if (hazard === "flood" && floods) {
      for (const e of floods) {
        L.circleMarker([e.lat, e.lon], {
          renderer,
          radius: e.alert === "Red" ? 8 : e.alert === "Orange" ? 6 : 4.5,
          color: edge,
          weight: 1.5,
          fillColor: FLOOD_ALERT_COLORS[e.alert] ?? cssVar("--ink-3"),
          fillOpacity: 0.9,
        })
          .bindTooltip(`<strong>${escapeHtml(e.title)}</strong><br>${prettyDate(e.date)} · ${escapeHtml(e.alert)} alert`, {
            className: "map-tooltip",
          })
          .addTo(group);
      }
    }
  }, [hazard, landslides, floods, fires, theme]);

  // Region boxes for this disaster type; click one to select it.
  useEffect(() => {
    const group = zonesRef.current;
    if (!group) return;
    group.clearLayers();
    const ink = cssVar("--ink");
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
          color: ink,
          weight: selected ? 3 : 1.5,
          opacity: selected ? 1 : 0.5,
          dashArray: selected ? undefined : "5 5",
        },
      );
      rect.bindTooltip(escapeHtml(z.name), { className: "map-tooltip", direction: "top" });
      rect.on("click", () => onSelectRef.current(z.id));
      group.addLayer(rect);
      // The reference pane ignores the pointer (labels shouldn't block the map); region boxes need clicks.
      const el = rect.getElement?.() as HTMLElement | undefined;
      if (el) el.style.pointerEvents = "auto";
    }
  }, [zones, selectedZone, theme]);

  // Frame the selected region.
  useEffect(() => {
    const zone = zones.find((z) => z.id === selectedZone);
    const map = baseRef.current?.map;
    if (!zone || !map) return;
    const [la0, la1, lo0, lo1] = zone.bbox;
    map.flyToBounds(
      [
        [la0, lo0],
        [la1, lo1],
      ],
      { paddingTopLeft: [60, 60], paddingBottomRight: [window.innerWidth >= 1024 ? 480 : 60, 60], maxZoom: 7, duration: 0.8 },
    );
  }, [selectedZone, zones]);

  return <div ref={containerRef} className="h-full w-full bg-sunken" />;
}
