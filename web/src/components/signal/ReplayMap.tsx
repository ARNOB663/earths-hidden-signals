"use client";

// The replay map: the tile's rain cells, a flag wash over them when the screen fired, and the
// catalogued flood episodes for the selected year as markers. Rain cells are drawn from the
// backtest's own geometry, so the map cannot show a grid the screen did not use.

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { createBaseMap, createCanvasRenderer, type BaseMap } from "@/components/map/baseMap";
import { T, useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import type { Episode } from "@/lib/signals/backtest";

interface Props {
  tile: string;
  lat: number | null;
  lon: number | null;
  episodes: Episode[];
  cells: { lat: number; lon: number }[];
  grid: { lat0: number; dLat: number; lon0: number; dLon: number };
  outlined: boolean;
  section: "monsoon" | "pre-monsoon";
}

export default function ReplayMap({ lat, lon, episodes, cells, grid, outlined }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<BaseMap | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const theme = useTheme();
  const t = useT();

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let map: BaseMap | null = null;
    const frame = requestAnimationFrame(() => {
      map = createBaseMap(container, { center: [lat ?? 25, lon ?? 80], zoom: lat === null ? 4.5 : 5.5 }, theme, "topright");
      mapRef.current = map;
      layer.current = L.layerGroup().addTo(map.map);
    });
    return () => {
      cancelAnimationFrame(frame);
      map?.dispose();
      mapRef.current = null;
      layer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layer.current;
    if (!map || !group) return;
    group.clearLayers();
    const renderer = createCanvasRenderer({ padding: 0.2, pane: "data" });
    // Every rain cell the screen used, drawn at the grid's own spacing so a cell's size is visible.
    for (const cell of cells) {
      L.rectangle(
        L.latLngBounds([cell.lat - grid.dLat / 2, cell.lon - grid.dLon / 2], [cell.lat + grid.dLat / 2, cell.lon + grid.dLon / 2]),
        {
          renderer,
          pane: "data",
          color: "#4b5563",
          weight: 0.4,
          fill: true,
          fillColor: outlined ? "#a16207" : "#8a9a8a",
          fillOpacity: outlined ? 0.25 : 0.12,
          interactive: false,
        },
      ).addTo(group);
    }
    // Episodes: a ring whose size is the number of catalogue records merged into it.
    if (lat !== null && lon !== null) {
      const bounds = L.latLngBounds([lat, lon], [lat, lon]);
      for (const episode of episodes) {
        bounds.extend([episode.lat, episode.lon]);
        L.circleMarker([episode.lat, episode.lon], {
          pane: "data",
          radius: 6 + Math.min(6, episode.events),
          color: "#111827",
          weight: 1.5,
          fillColor: "#ffffff",
          fillOpacity: 0.85,
        })
          .bindTooltip(`${episode.start} · ${episode.events} record${episode.events === 1 ? "" : "s"}`, { sticky: true })
          .addTo(group);
      }
      map.map.fitBounds(bounds.pad(0.5), { animate: false });
    }
  }, [cells, episodes, grid.dLat, grid.dLon, lat, lon, outlined]);

  return (
    <figure className="m-0">
      <div
        ref={host}
        role="application"
        aria-label={t(
          "Map of the rain cells used by the screen and the flood episodes for this year.",
          "এই বছরের স্ক্রিনিংয়ের বৃষ্টি-কোষ ও বন্যা-ঘটনার মানচিত্র।",
        )}
        className="h-64 w-full overflow-hidden rounded-xl border border-line bg-sunken"
      />
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5" style={{ background: outlined ? "#a16207" : "#8a9a8a" }} />
          <T en="rain cells used by the screen" bn="স্ক্রিনিংয়ের ব্যবহৃত বৃষ্টি-কোষ" />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-ink bg-card" />
          <T en="catalogued flood episode (size = records merged)" bn="নথিভুক্ত বন্যা-ঘটনা (আকার = একত্রিত রেকর্ড)" />
        </span>
      </figcaption>
    </figure>
  );
}
