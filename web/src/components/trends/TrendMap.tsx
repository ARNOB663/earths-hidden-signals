"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { createBaseMap } from "@/components/map/baseMap";
import {
  cellCenter,
  divergingColor,
  formatP,
  formatSigned,
  type GridSpec,
  type TrendGrid,
  type VariableId,
  type VariableMeta,
  type Zone,
} from "@/lib/trends";

interface Props {
  grid: GridSpec;
  stats: TrendGrid | null;
  variable: VariableId;
  meta: VariableMeta;
  limit: number;
  zones: Zone[];
  selectedZone: string | null;
  selectedCell: { i: number; j: number } | null;
  onSelectCell: (lat: number, lon: number) => void;
}

const SOUTH_ASIA = { center: [22, 80] as L.LatLngExpression, zoom: 4 };

export default function TrendMap({
  grid,
  stats,
  variable,
  meta,
  limit,
  zones,
  selectedZone,
  selectedCell,
  onSelectCell,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const cellsRef = useRef<L.LayerGroup | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const onSelectRef = useRef(onSelectCell);
  useEffect(() => {
    onSelectRef.current = onSelectCell;
  });

  useEffect(() => {
    const base = createBaseMap(containerRef.current!, SOUTH_ASIA);
    mapRef.current = base.map;
    rendererRef.current = L.canvas({ pane: "data", padding: 0.5 });
    cellsRef.current = L.layerGroup().addTo(base.map);
    overlayRef.current = L.layerGroup().addTo(base.map);
    return () => {
      base.dispose();
      mapRef.current = null;
    };
  }, []);

  // Trend cells: colour = rate of change; full colour + dot = significant after the map-wide FDR check.
  useEffect(() => {
    const group = cellsRef.current;
    const renderer = rendererRef.current;
    if (!group || !renderer) return;
    group.clearLayers();
    if (!stats) return;

    const unit = `${meta.unit}/decade`;
    stats.slopePerDecade.forEach((slope, k) => {
      if (slope === null) return;
      const i = Math.floor(k / grid.nLon);
      const j = k % grid.nLon;
      const { lat, lon } = cellCenter(grid, i, j);
      const significant = stats.significant[k] === 1;
      const [r, g, b] = divergingColor(slope, limit, variable);
      const bounds: L.LatLngBoundsExpression = [
        [lat - grid.dLat / 2, lon - grid.dLon / 2],
        [lat + grid.dLat / 2, lon + grid.dLon / 2],
      ];
      const p = stats.p[k];
      const rect = L.rectangle(bounds, {
        renderer,
        color: "#0b0f14",
        weight: 1,
        fillColor: `rgb(${r},${g},${b})`,
        fillOpacity: significant ? 0.88 : 0.3,
      });
      rect.bindTooltip(
        `<strong>${formatSigned(slope, meta.decimals + 1)} ${unit}</strong><br>` +
          `${significant ? "Significant (map-wide check)" : "Not significant"}${p !== null ? ` · ${formatP(p)}` : ""}<br>` +
          `<span style="opacity:.7">${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E · click for details</span>`,
        { sticky: true, direction: "top", className: "trend-tooltip" },
      );
      rect.on("click", () => onSelectRef.current(lat, lon));
      group.addLayer(rect);
      if (significant) {
        group.addLayer(
          L.circleMarker([lat, lon], {
            renderer,
            radius: 1.8,
            stroke: false,
            fillColor: "#f1f5f9",
            fillOpacity: 0.85,
            interactive: false,
          }),
        );
      }
    });
  }, [stats, grid, limit, variable, meta]);

  // Hazard-zone outlines and the selected cell.
  useEffect(() => {
    const group = overlayRef.current;
    if (!group) return;
    group.clearLayers();
    for (const z of zones) {
      if (z.id === "study-area") continue;
      const [la0, la1, lo0, lo1] = z.bbox;
      const selected = z.id === selectedZone;
      group.addLayer(
        L.rectangle(
          [
            [la0, lo0],
            [la1, lo1],
          ],
          {
            pane: "reference",
            interactive: false,
            fill: false,
            color: selected ? "#f8fafc" : "#94a3b8",
            weight: selected ? 2.5 : 1,
            dashArray: selected ? undefined : "4 4",
            opacity: selected ? 1 : 0.7,
          },
        ),
      );
    }
    if (selectedCell) {
      const { lat, lon } = cellCenter(grid, selectedCell.i, selectedCell.j);
      group.addLayer(
        L.rectangle(
          [
            [lat - grid.dLat / 2, lon - grid.dLon / 2],
            [lat + grid.dLat / 2, lon + grid.dLon / 2],
          ],
          { pane: "reference", interactive: false, fill: false, color: "#ffffff", weight: 2.5 },
        ),
      );
    }
  }, [zones, selectedZone, selectedCell, grid]);

  return <div ref={containerRef} className="h-full w-full bg-[#0b0f14]" />;
}
