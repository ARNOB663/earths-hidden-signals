"use client";

// World map for Climate Twins: every land block shaded by how closely its trend fingerprint
// matches the chosen South Asian region, the region itself outlined, and its twins numbered.
// Shading is a darker blue for a closer match; the numbers and the cards below carry the same
// information in words, so colour is never the only cue.

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { createBaseMap, createCanvasRenderer, type BaseMap } from "@/components/map/baseMap";
import { useLang } from "@/lib/i18n";
import { cssVar, useTheme } from "@/lib/theme";

export interface TwinMapBlock {
  id: string;
  bbox: [number, number, number, number];
  name: string;
}

interface Props {
  blocks: TwinMapBlock[];
  similarity: number[];
  region: { name: string; bbox: [number, number, number, number] };
  twins: string[];
  active: string | null;
  onSelect: (id: string) => void;
}

/** Similarity percentile -> colour step; below the 80th percentile a block stays unshaded. */
function step(p: number): string | null {
  if (p >= 99) return "--cool-4";
  if (p >= 95) return "--cool-3";
  if (p >= 90) return "--cool-2";
  if (p >= 80) return "--cool-1";
  return null;
}

export default function TwinMap({ blocks, similarity, region, twins, active, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const base = useRef<BaseMap | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const renderer = useRef<L.Canvas | null>(null);
  const select = useRef(onSelect);
  const theme = useTheme();
  const lang = useLang();

  useEffect(() => {
    select.current = onSelect;
  });

  useEffect(() => {
    const b = createBaseMap(host.current!, { center: [15, 30], zoom: 2 }, theme, "topright");
    b.map.setMinZoom(1);
    b.map.invalidateSize({ animate: false });
    b.map.fitBounds([[-50, -165], [70, 165]], { animate: false, padding: [4, 4] });
    base.current = b;
    renderer.current = createCanvasRenderer({ pane: "data", padding: 0.5 });
    layer.current = L.layerGroup().addTo(b.map);
    return () => {
      b.dispose();
      base.current = null;
    };
    // Created once; later effects redraw the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    base.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const group = layer.current;
    const r = renderer.current;
    if (!group || !r) return;
    group.clearLayers();
    const bn = lang === "bn";
    const edge = cssVar("--page");

    blocks.forEach((blk, k) => {
      const tok = step(similarity[k]);
      if (!tok) return;
      const [la0, la1, lo0, lo1] = blk.bbox;
      const rect = L.rectangle(
        [
          [la0, lo0],
          [la1, lo1],
        ],
        { renderer: r, color: edge, weight: 0.5, fillColor: cssVar(tok), fillOpacity: 0.9 },
      );
      rect.bindTooltip(
        bn
          ? `<strong>${blk.name}</strong><br>মিলের দিক থেকে পৃথিবীর স্থলভাগের শীর্ষ ${Math.max(1, Math.ceil(100 - similarity[k]))}%-এ`
          : `<strong>${blk.name}</strong><br>In the top ${Math.max(1, Math.ceil(100 - similarity[k]))}% of Earth's land for this match`,
        { sticky: true, className: "map-tooltip" },
      );
      if (twins.includes(blk.id)) rect.on("click", () => select.current(blk.id));
      group.addLayer(rect);
    });

    const [ra0, ra1, ro0, ro1] = region.bbox;
    group.addLayer(
      L.rectangle(
        [
          [ra0, ro0],
          [ra1, ro1],
        ],
        { pane: "data", interactive: false, fill: false, color: cssVar("--warm-3"), weight: 3 },
      ),
    );

    twins.forEach((id, n) => {
      const blk = blocks.find((b) => b.id === id);
      if (!blk) return;
      const [la0, la1, lo0, lo1] = blk.bbox;
      const on = id === active;
      const marker = L.marker([(la0 + la1) / 2, (lo0 + lo1) / 2], {
        pane: "data",
        keyboard: true,
        title: blk.name,
        icon: L.divIcon({
          className: "",
          html: `<span style="display:grid;place-items:center;width:${on ? 30 : 24}px;height:${on ? 30 : 24}px;border-radius:9999px;background:${on ? "var(--ink)" : "var(--card)"};color:${on ? "var(--card)" : "var(--ink)"};border:2px solid var(--ink);font:600 12px/1 system-ui;box-shadow:0 1px 4px rgba(0,0,0,.35)">${n + 1}</span>`,
          iconSize: [on ? 30 : 24, on ? 30 : 24],
          iconAnchor: [on ? 15 : 12, on ? 15 : 12],
        }),
      });
      marker.on("click", () => select.current(id));
      group.addLayer(marker);
    });
  }, [blocks, similarity, region, twins, active, theme, lang]);

  return <div ref={host} className="h-full w-full bg-sunken" />;
}
