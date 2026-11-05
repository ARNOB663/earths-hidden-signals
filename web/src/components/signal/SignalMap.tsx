"use client";

// The Signal map: country outlines, the areas that carry data, and a marker for the selected
// location. Shape and colour follow the Watch Level (or the coverage state when there is no
// reading); a solid, dashed or dotted outline carries the Data Trust Grade. Every shape carries a
// tooltip and every status also appears as a word in the list and the legend, so colour is never
// the only cue. This map shows the recent rain signal, not a climate-trend background.

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { createBaseMap, createCanvasRenderer, type BaseMap } from "@/components/map/baseMap";
import { T, useLang, useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export interface SignalMapArea {
  id: string;
  name: string;
  level: "ADM1" | "ADM2";
  watch: "none" | "elevated" | "high" | "unknown";
  coverage: "live" | "seasonal" | "cant-tell";
  trust: "high" | "medium" | "low";
  rings: [number, number][][];
}

interface Props {
  areas: SignalMapArea[];
  selected: string | null;
  onSelect?: (id: string) => void;
  focus?: [number, number] | null;
  height?: string;
}

const FILL: Record<SignalMapArea["watch"], string> = {
  high: "#b42318",
  elevated: "#a16207",
  none: "#8a9a8a",
  unknown: "#9ca3af",
};

const STROKE: Record<SignalMapArea["trust"], { color: string; dashArray?: string }> = {
  high: { color: "#111827" },
  medium: { color: "#4b5563", dashArray: "4 3" },
  low: { color: "#9ca3af", dashArray: "1 4" },
};

const WORD: Record<SignalMapArea["watch"], { en: string; bn: string }> = {
  high: { en: "Watch Level: High", bn: "সতর্কতা: উচ্চ" },
  elevated: { en: "Watch Level: Elevated", bn: "সতর্কতা: বর্ধিত" },
  none: { en: "No elevated watch", bn: "উচ্চ সতর্কতা নেই" },
  unknown: { en: "Can't tell (no reading)", bn: "বলা যায় না (পাঠ নেই)" },
};

const COVERAGE_WORD: Record<SignalMapArea["coverage"], { en: string; bn: string }> = {
  live: { en: "Live Signal", bn: "সরাসরি সংকেত" },
  seasonal: { en: "Seasonal Context Only", bn: "কেবল মৌসুমি প্রেক্ষাপট" },
  "cant-tell": { en: "Can't Tell Here", bn: "এখানে বলা সম্ভব নয়" },
};

export default function SignalMap({ areas, selected, onSelect, focus, height = "h-[420px]" }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const base = useRef<BaseMap | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const theme = useTheme();
  const lang = useLang();
  const t = useT();
  const selectRef = useRef(onSelect);
  const latest = useRef({ areas, lang });

  useEffect(() => {
    selectRef.current = onSelect;
    latest.current = { areas, lang };
  }, [areas, lang, onSelect]);

  const draw = (list: SignalMapArea[], language: "en" | "bn", current: string | null) => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    const renderer = createCanvasRenderer({ padding: 0.5, pane: "data" });
    // ADM1 first, so the smaller ADM2 fills sit on top.
    const ordered = [...list].sort((a, b) => a.level.localeCompare(b.level));
    for (const area of ordered) {
      const stroke = STROKE[area.trust];
      const isSelected = current === area.id;
      const shape = L.polygon(area.rings, {
        renderer,
        pane: "data",
        color: isSelected ? "var(--accent-strong)" : stroke.color,
        dashArray: isSelected ? undefined : stroke.dashArray,
        weight: isSelected ? 2.5 : area.level === "ADM1" ? 1.2 : 0.6,
        fillColor: FILL[area.watch],
        fillOpacity: area.coverage === "live" ? 0.32 : 0.1,
      });
      const word = language === "bn" ? WORD[area.watch].bn : WORD[area.watch].en;
      const coverage = language === "bn" ? COVERAGE_WORD[area.coverage].bn : COVERAGE_WORD[area.coverage].en;
      shape.bindTooltip(`${area.name} — ${word} · ${coverage}`, { sticky: true });
      shape.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        selectRef.current?.(area.id);
      });
      shape.addTo(group);
    }
  };

  useEffect(() => {
    draw(areas, lang, selected);
  }, [areas, lang, selected]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let map: BaseMap | null = null;
    const frame = requestAnimationFrame(() => {
      map = createBaseMap(container, { center: [25, 79], zoom: 4.2 }, theme, "topright");
      base.current = map;
      map.map.attributionControl.addAttribution('Areas &copy; <a href="https://www.geoboundaries.org/">geoBoundaries</a>');
      layer.current = L.layerGroup().addTo(map.map);
      map.map.on("click", () => selectRef.current?.(""));
      draw(latest.current.areas, latest.current.lang, null);
    });
    return () => {
      cancelAnimationFrame(frame);
      map?.dispose();
      base.current = null;
      layer.current = null;
    };
    // The map is created once; the draw effect handles later data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    base.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!base.current || !focus) return;
    base.current.map.setView(focus, Math.max(base.current.map.getZoom(), 6), { animate: false });
  }, [focus]);

  return (
    <figure className="m-0">
      <div
        ref={host}
        role="application"
        aria-label={t(
          "Map of the covered areas colored by Watch Level and outlined by Data Trust Grade.",
          "সতর্কতার মাত্রা অনুযায়ী রঙিন এবং তথ্য-ভরসার গ্রেড অনুযায়ী রূপরেখাযুক্ত আচ্ছাদিত এলাকার মানচিত্র।",
        )}
        className={`${height} w-full overflow-hidden rounded-2xl border border-line bg-sunken`}
      />
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: FILL.high }} />
          <T en="Watch Level: High" bn="সতর্কতা: উচ্চ" />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: FILL.elevated }} />
          <T en="Elevated" bn="বর্ধিত" />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: FILL.none }} />
          <T en="Not elevated (never an all-clear)" bn="উচ্চতর নয় (কখনো নিরাপত্তার নিশ্চয়তা নয়)" />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-ink-3" style={{ background: "#e5e7eb" }} />
          <T en="No reading (can't tell)" bn="কোনো পাঠ নেই (বলা যায় না)" />
        </span>
        <span className="text-ink-3">
          <T en="Outline: solid = trust high · dashed = medium · dotted = low" bn="রূপরেখা: অবিচ্ছিন্ন = ভরসা উচ্চ · ড্যাশ = মাঝারি · বিন্দু = নিম্ন" />
        </span>
      </figcaption>
    </figure>
  );
}
