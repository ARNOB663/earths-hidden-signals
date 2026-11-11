"use client";

// World view of the climate trends: every land cell on Earth coloured by its 1981–2025 trend,
// solid where the change is clear (Mann–Kendall, FDR-controlled), faded where it isn't.
// Deliberately simple: pick a measure, look, click a square. South Asia has the detailed view.

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createBaseMap, type BaseMap } from "@/components/map/baseMap";
import { bnNum } from "@/lib/bn";
import { T, useLang, useT } from "@/lib/i18n";
import { cssVar, useTheme } from "@/lib/theme";
import { formatSigned, trendLegendTokens, trendToken, type VariableId } from "@/lib/trends";

type Cell = [number, number, number, number];
type MeasureId = "temperature" | "wet-season" | "rainfall";

const MEASURES: Record<MeasureId, { en: string; bn: string; unit: string; unitBn: string; limit: number; variable: VariableId; up: [string, string]; down: [string, string] }> = {
  temperature: { en: "Temperature", bn: "তাপমাত্রা", unit: "°C", unitBn: "°সে", limit: 0.6, variable: "temperature", up: ["warmer", "উষ্ণ"], down: ["cooler", "শীতল"] },
  "wet-season": { en: "Rainy-season rain", bn: "বর্ষা মৌসুমের বৃষ্টি", unit: "%", unitBn: "%", limit: 10, variable: "rainfall", up: ["wetter", "ভেজা"], down: ["drier", "শুষ্ক"] },
  rainfall: { en: "Yearly rain", bn: "বার্ষিক বৃষ্টি", unit: "%", unitBn: "%", limit: 10, variable: "rainfall", up: ["wetter", "ভেজা"], down: ["drier", "শুষ্ক"] },
};

export interface WorldCounts {
  temperature: { cells: number; increase: number; decrease: number };
  rainfall: { cells: number; increase: number; decrease: number };
  wetSeason: { cells: number; increase: number; decrease: number };
}

export default function WorldExplorer({ counts, onZoomSouthAsia }: { counts: WorldCounts; onZoomSouthAsia: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const base = useRef<BaseMap | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const mark = useRef<L.Rectangle | null>(null);
  const renderer = useRef<L.Canvas | null>(null);
  const theme = useTheme();
  const bn = useLang() === "bn";
  const [measure, setMeasure] = useState<MeasureId>("temperature");
  const [cells, setCells] = useState<{ id: MeasureId; data: Cell[]; d: number } | null>(null);
  const [picked, setPicked] = useState<Cell | null>(null);
  const [failed, setFailed] = useState(false);
  const t = useT();
  const m = MEASURES[measure];

  useEffect(() => {
    const b = createBaseMap(host.current!, { center: [20, 10], zoom: 2 }, theme, "topright");
    b.map.setMinZoom(1); // phones need one more level out to see every continent
    b.map.fitBounds([[-50, -165], [72, 170]], { animate: false, paddingBottomRight: window.innerWidth < 640 ? [0, 220] : [0, 0] });
    base.current = b;
    renderer.current = L.canvas({ pane: "data", padding: 0.5 });
    layer.current = L.layerGroup().addTo(b.map);
    return () => b.dispose();
    // Created once; the effects below redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    base.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/global/${measure}.json`)
      .then((r) => r.json())
      .then((data: { cell: number; cells: Cell[] }) => {
        if (!cancelled) {
          setFailed(false);
          setCells({ id: measure, data: data.cells, d: data.cell });
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [measure]);

  useEffect(() => {
    const group = layer.current;
    const r = renderer.current;
    if (!group || !r || !cells) return;
    group.clearLayers();
    const meta = MEASURES[cells.id];
    const edge = cssVar("--page");
    for (const c of cells.data) {
      const [lat, lon, slope, clear] = c;
      const h = cells.d / 2;
      const rect = L.rectangle(
        [
          [lat - h, lon - h],
          [lat + h, lon + h],
        ],
        { renderer: r, color: edge, weight: 0.3, fillColor: cssVar(trendToken(slope, meta.limit, meta.variable)), fillOpacity: clear ? 0.9 : 0.25 },
      );
      rect.on("click", () => setPicked(c));
      group.addLayer(rect);
    }
  }, [cells, theme]);

  // Outline the square the reader picked, so the number in the panel has a visible owner.
  useEffect(() => {
    mark.current?.remove();
    mark.current = null;
    const map = base.current?.map;
    if (!map || !picked || !cells || cells.id !== measure) return;
    const h = cells.d / 2;
    mark.current = L.rectangle(
      [
        [picked[0] - h, picked[1] - h],
        [picked[0] + h, picked[1] + h],
      ],
      { pane: "data", color: cssVar("--ink"), weight: 2.5, fill: false, interactive: false },
    ).addTo(map);
  }, [picked, cells, measure, theme]);

  const count = measure === "temperature" ? counts.temperature : measure === "rainfall" ? counts.rainfall : counts.wetSeason;
  const unit = bn ? m.unitBn : m.unit;
  const num = (s: string) => (bn ? bnNum(s) : s);
  const shown = picked && cells?.id === measure ? picked : null;

  return (
    <div className="relative h-full">
      <div ref={host} className="absolute inset-0 bg-sunken" />

      <aside className="absolute bottom-3 left-3 right-3 z-[500] rounded-2xl bg-card p-4 shadow-soft sm:bottom-auto sm:right-auto sm:top-16 sm:w-[340px]">
        <div role="radiogroup" aria-label={t("Measure", "পরিমাপ")} className="grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1 text-xs">
          {(Object.keys(MEASURES) as MeasureId[]).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={measure === id}
              onClick={() => {
                setMeasure(id);
                setPicked(null);
              }}
              className={`rounded-lg px-1.5 py-2 leading-tight transition-colors ${measure === id ? "bg-card font-medium text-ink shadow-soft" : "text-ink-2 hover:text-ink"}`}
            >
              <T en={MEASURES[id].en} bn={MEASURES[id].bn} />
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm text-ink">
          <T
            en={`Since 1981: ${count.increase.toLocaleString("en-US")} land areas clearly ${m.up[0]}, ${count.decrease.toLocaleString("en-US")} clearly ${m.down[0]}.`}
            bn={`১৯৮১ থেকে: ${bnNum(count.increase.toLocaleString("en-US"))}টি স্থল-এলাকা স্পষ্টভাবে ${m.up[1]}, ${bnNum(count.decrease.toLocaleString("en-US"))}টি স্পষ্টভাবে ${m.down[1]}।`}
          />
        </p>

        <div className="mt-3 flex items-center gap-2 text-xs text-ink-2">
          <span>{bn ? m.down[1] : m.down[0]}</span>
          <span aria-hidden className="flex h-2.5 flex-1 overflow-hidden rounded-full">
            {trendLegendTokens(m.variable).map((tok) => (
              <span key={tok} className="flex-1" style={{ background: `var(${tok})` }} />
            ))}
          </span>
          <span>{bn ? m.up[1] : m.up[0]}</span>
        </div>
        <p className="mt-1 text-xs text-ink-3">
          <T en="Faded squares: no clear change." bn="হালকা বর্গ: স্পষ্ট পরিবর্তন নেই।" />
        </p>

        {failed && (
          <p role="alert" className="mt-3 text-sm text-ink">
            <T en="The map data didn't load. Check your connection and reload the page." bn="মানচিত্রের তথ্য লোড হয়নি। ইন্টারনেট সংযোগ দেখে পাতাটি আবার লোড করুন।" />
          </p>
        )}
        {shown ? (
          <p aria-live="polite" className="mt-3 rounded-xl bg-sunken px-3 py-2 text-sm text-ink">
            <span className="font-semibold tabular-nums">
              {num(formatSigned(shown[2], measure === "temperature" ? 2 : 1))} {unit}
            </span>{" "}
            <T en="per 10 years" bn="প্রতি ১০ বছরে" />
            {" · "}
            {shown[3] ? <T en="a clear change" bn="স্পষ্ট পরিবর্তন" /> : <T en="no clear change" bn="স্পষ্ট পরিবর্তন নেই" />}
            <span className="block text-xs text-ink-3 tabular-nums">
              {num(`${Math.abs(shown[0]).toFixed(1)}°${shown[0] >= 0 ? "N" : "S"}, ${Math.abs(shown[1]).toFixed(1)}°${shown[1] >= 0 ? "E" : "W"}`)}
            </span>
            <Link
              href={`/your-place?lat=${shown[0].toFixed(2)}&lon=${shown[1].toFixed(2)}`}
              className="mt-1 inline-flex min-h-8 items-center text-sm font-medium text-accent hover:underline"
            >
              <T en="Open the full report for this place" bn="এই জায়গার পূর্ণ রিপোর্ট দেখুন" />
            </Link>
          </p>
        ) : (
          <p className="mt-3 text-xs text-ink-3">
            <T en="Click a square to see its number." bn="সংখ্যা দেখতে একটি বর্গে ক্লিক করুন।" />
          </p>
        )}

        <button
          type="button"
          onClick={onZoomSouthAsia}
          className="mt-3 w-full rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <T en="Zoom into South Asia for the full detail" bn="সম্পূর্ণ বিবরণের জন্য দক্ষিণ এশিয়ায় যান" /> <span aria-hidden>→</span>
        </button>
      </aside>
    </div>
  );
}
