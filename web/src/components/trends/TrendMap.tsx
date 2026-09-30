"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { createBaseMap, type BaseMap } from "@/components/map/baseMap";
import { bnNum } from "@/lib/bn";
import { useLang } from "@/lib/i18n";
import { unitBn } from "@/lib/names";
import { cssVar, useTheme } from "@/lib/theme";
import {
  cellCenter,
  formatSigned,
  trendToken,
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

// Centred east of South Asia so the region sits clear of the details panel on the right.
const SOUTH_ASIA = { center: [22, 91] as L.LatLngExpression, zoom: 4 };

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
  const baseRef = useRef<BaseMap | null>(null);
  const cellsRef = useRef<L.LayerGroup | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const theme = useTheme();
  const lang = useLang();
  const onSelectRef = useRef(onSelectCell);
  useEffect(() => {
    onSelectRef.current = onSelectCell;
  });

  useEffect(() => {
    const base = createBaseMap(
      containerRef.current!,
      SOUTH_ASIA,
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      "topleft",
    );
    baseRef.current = base;
    // Frame the whole study area, leaving room for the details panel (beside the map on wide screens,
    // over its lower part on phones) and the colour key.
    base.map.fitBounds(
      [
        [6, 61],
        [37, 99],
      ],
      window.innerWidth >= 1024
        ? { paddingTopLeft: [16, 56], paddingBottomRight: [430, 16] }
        : { paddingTopLeft: [8, 60], paddingBottomRight: [8, 250] },
    );
    rendererRef.current = L.canvas({ pane: "data", padding: 0.5 });
    cellsRef.current = L.layerGroup().addTo(base.map);
    overlayRef.current = L.layerGroup().addTo(base.map);
    return () => {
      base.dispose();
      baseRef.current = null;
    };
  }, []);

  useEffect(() => {
    baseRef.current?.setTheme(theme);
  }, [theme]);

  // Trend squares: colour = how fast it changes; solid = a clear change, faded = no clear change.
  useEffect(() => {
    const group = cellsRef.current;
    const renderer = rendererRef.current;
    if (!group || !renderer) return;
    group.clearLayers();
    if (!stats) return;

    const bn = lang === "bn";
    const edge = cssVar("--page");
    stats.slopePerDecade.forEach((slope, k) => {
      if (slope === null) return;
      const i = Math.floor(k / grid.nLon);
      const j = k % grid.nLon;
      const { lat, lon } = cellCenter(grid, i, j);
      const clear = stats.significant[k] === 1;
      const rect = L.rectangle(
        [
          [lat - grid.dLat / 2, lon - grid.dLon / 2],
          [lat + grid.dLat / 2, lon + grid.dLon / 2],
        ],
        {
          renderer,
          color: edge,
          weight: 1.5,
          fillColor: cssVar(trendToken(slope, limit, variable)),
          fillOpacity: clear ? 0.9 : 0.3,
        },
      );
      rect.bindTooltip(
        bn
          ? `<strong>প্রতি ১০ বছরে ${bnNum(formatSigned(slope, meta.decimals + 1))} ${unitBn(meta.unit)}</strong><br>` +
              `${clear ? "স্পষ্ট পরিবর্তন" : "স্পষ্ট পরিবর্তন নেই"} · পুরো বিবরণের জন্য ক্লিক করুন`
          : `<strong>${formatSigned(slope, meta.decimals + 1)} ${meta.unit} every 10 years</strong><br>` +
              `${clear ? "Clear change" : "No clear change"} · click for the full story`,
        { sticky: true, direction: "top", className: "map-tooltip" },
      );
      rect.on("click", () => onSelectRef.current(lat, lon));
      group.addLayer(rect);
    });
  }, [stats, grid, limit, variable, meta, theme, lang]);

  // Region outlines and the selected square.
  useEffect(() => {
    const group = overlayRef.current;
    if (!group) return;
    group.clearLayers();
    const ink = cssVar("--ink");
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
            color: ink,
            weight: selected ? 3 : 1,
            dashArray: selected ? undefined : "4 5",
            opacity: selected ? 1 : 0.45,
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
          { pane: "reference", interactive: false, fill: false, color: ink, weight: 3 },
        ),
      );
    }
  }, [zones, selectedZone, selectedCell, grid, theme]);

  return <div ref={containerRef} className="h-full w-full bg-sunken" />;
}
