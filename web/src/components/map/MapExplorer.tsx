"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { GibsCatalog } from "@/lib/gibs";
import { CATEGORY_LABEL, LAYERS, type LayerDef } from "@/lib/layers";
import { formatMonth, nearestDateIndex } from "@/lib/dates";
import { ForestLossChart } from "./ForestLossChart";
import { LegendBar } from "./LegendBar";
import { lossYearGradient } from "./lossColors";
import type { MapFocus } from "./LeafletMap";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-[#0b0f14] text-sm text-slate-500">Loading map…</div>
  ),
});

type Step = "month" | "year";

const PLAY_INTERVAL_MS = 1600;

export default function MapExplorer({ catalog }: { catalog: GibsCatalog }) {
  // The URL (?layer=…&date=… or ?layer=forest-loss&from=…&to=…) sets the starting view,
  // so a link can open the map on a specific variable and time.
  const params = useSearchParams();
  const [layerId, setLayerId] = useState(() => {
    const requested = params.get("layer");
    return LAYERS.some((l) => l.id === requested) ? requested! : LAYERS[0].id;
  });
  const [dateIndex, setDateIndex] = useState<Record<string, number>>(() => {
    const requested = params.get("date");
    return Object.fromEntries(
      Object.entries(catalog).map(([id, info]) => [
        id,
        requested && id === layerId ? nearestDateIndex(info.dates, requested) : info.dates.length - 1,
      ]),
    );
  });
  const forestDef = LAYERS.find((l) => l.kind === "forest-loss")!;
  const [yearRange, setYearRange] = useState<[number, number]>(() => {
    const [first, last] = forestDef.kind === "forest-loss" ? [forestDef.firstYear, forestDef.lastYear] : [2001, 2025];
    const clamp = (v: string | null, fallback: number) =>
      v && Number.isFinite(Number(v)) ? Math.min(last, Math.max(first, Math.round(Number(v)))) : fallback;
    const from = clamp(params.get("from"), first);
    return [from, Math.max(from, clamp(params.get("to"), last))];
  });
  const [opacity, setOpacity] = useState(0.85);
  const [showReference, setShowReference] = useState(true);
  const [step, setStep] = useState<Step>("year");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forestTotals, setForestTotals] = useState<number[] | null>(null);
  const [focus, setFocus] = useState<{ target: MapFocus; nonce: number }>({ target: "south-asia", nonce: 0 });

  const layer = LAYERS.find((l) => l.id === layerId)!;
  const info = layer.kind === "gibs" ? catalog[layer.id] : null;
  const dates = useMemo(() => info?.dates ?? [], [info]);
  const idx = dateIndex[layerId] ?? dates.length - 1;
  const date = dates[idx] ?? null;

  // Keep the address bar in sync so the current view can be copied and shared.
  useEffect(() => {
    const query =
      layer.kind === "gibs"
        ? `?layer=${layer.id}${date ? `&date=${date}` : ""}`
        : `?layer=${layer.id}&from=${yearRange[0]}&to=${yearRange[1]}`;
    window.history.replaceState(null, "", query);
  }, [layer, date, yearRange]);

  const setIdx = (next: number) =>
    setDateIndex((prev) => ({ ...prev, [layerId]: Math.min(dates.length - 1, Math.max(0, next)) }));

  /** Moves by one month, or to the same month in the next/previous year (skipping gaps). */
  const stepDate = (direction: 1 | -1, by: Step): boolean => {
    if (!date) return false;
    if (by === "month") {
      const next = idx + direction;
      if (next < 0 || next >= dates.length) return false;
      setIdx(next);
      return true;
    }
    const target = `${Number(date.slice(0, 4)) + direction}${date.slice(4)}`;
    const found = dates.indexOf(target);
    if (found < 0) return false;
    setIdx(found);
    return true;
  };

  // Animation: advance time until the end of the record, then stop.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (layer.kind === "forest-loss") {
        setYearRange(([start, end]) => {
          if (end >= layer.lastYear) {
            setPlaying(false);
            return [start, end];
          }
          return [start, end + 1];
        });
      } else if (!stepDate(1, step)) {
        setPlaying(false);
      }
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
    // stepDate is re-created each render; the effect re-subscribes whenever the date moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, layerId, idx, step]);

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (layer.kind === "forest-loss") {
      // Build up loss cumulatively from the start year.
      setYearRange(([start]) => [start, start]);
    } else if (idx >= dates.length - 1) {
      // Restart from the first matching month so the animation has somewhere to go.
      setIdx(step === "year" ? nearestDateIndex(dates, `${dates[0].slice(0, 4)}${date!.slice(4)}`) : 0);
    }
    setPlaying(true);
  };

  const selectLayer = (next: LayerDef) => {
    setPlaying(false);
    if (next.kind === "forest-loss") setForestTotals(null);
    setLayerId(next.id);
  };

  const years = useMemo(() => [...new Set(dates.map((d) => d.slice(0, 4)))], [dates]);

  return (
    <div className="flex h-full flex-col-reverse lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-t border-white/10 bg-[#0e141b] p-4 lg:w-[360px] lg:border-r lg:border-t-0">
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Variable</h2>
          <div className="grid grid-cols-1 gap-1.5">
            {LAYERS.map((l) => {
              const active = l.id === layerId;
              return (
                <button
                  key={l.id}
                  onClick={() => selectLayer(l)}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                    active ? "bg-sky-500/15 ring-1 ring-sky-400/50" : "hover:bg-white/5"
                  }`}
                >
                  <span>
                    <span className={`block text-sm ${active ? "text-white" : "text-slate-200"}`}>{l.title}</span>
                    <span className="block text-xs text-slate-500">{l.mission}</span>
                  </span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                    {CATEGORY_LABEL[l.category]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Time</h2>
          {layer.kind === "gibs" && date ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums text-white">{formatMonth(date)}</span>
                <span className="font-mono text-[11px] text-slate-500">
                  {formatMonth(dates[0])} – {formatMonth(dates[dates.length - 1])}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={dates.length - 1}
                value={idx}
                onChange={(e) => setIdx(Number(e.target.value))}
                aria-label="Month"
                className="w-full accent-sky-400"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <IconButton label="Previous year, same month" onClick={() => stepDate(-1, "year")}>« yr</IconButton>
                <IconButton label="Previous month" onClick={() => stepDate(-1, "month")}>‹ mo</IconButton>
                <IconButton label="Next month" onClick={() => stepDate(1, "month")}>mo ›</IconButton>
                <IconButton label="Next year, same month" onClick={() => stepDate(1, "year")}>yr »</IconButton>
                <select
                  value={date.slice(0, 4)}
                  onChange={(e) => setIdx(nearestDateIndex(dates, `${e.target.value}${date.slice(4)}`))}
                  aria-label="Jump to year"
                  className="ml-auto rounded-md border border-white/10 bg-[#0b0f14] px-2 py-1 text-sm text-slate-200"
                >
                  {years.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <PlayButton playing={playing} onClick={togglePlay} />
                <div className="flex rounded-md bg-white/5 p-0.5 text-xs">
                  {(["year", "month"] as Step[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStep(s)}
                      className={`rounded px-2 py-1 ${step === s ? "bg-white/10 text-white" : "text-slate-400"}`}
                    >
                      {s === "year" ? "Same month, each year" : "Every month"}
                    </button>
                  ))}
                </div>
              </div>
              {step === "year" && (
                <p className="text-xs leading-relaxed text-slate-500">
                  Stepping year-by-year in the same month removes the seasonal cycle, so what changes is the long-term
                  signal.
                </p>
              )}
            </div>
          ) : layer.kind === "forest-loss" ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums text-white">
                  {yearRange[0]} – {yearRange[1]}
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {layer.firstYear} – {layer.lastYear}
                </span>
              </div>
              <YearSlider
                label="From"
                value={yearRange[0]}
                min={layer.firstYear}
                max={layer.lastYear}
                onChange={(v) => setYearRange(([, end]) => [v, Math.max(v, end)])}
              />
              <YearSlider
                label="To"
                value={yearRange[1]}
                min={layer.firstYear}
                max={layer.lastYear}
                onChange={(v) => setYearRange(([start]) => [Math.min(start, v), v])}
              />
              <PlayButton playing={playing} onClick={togglePlay} />
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Legend</h2>
          {layer.kind === "gibs" && info?.legend ? (
            <LegendBar legend={info.legend} unit={layer.displayUnit} />
          ) : layer.kind === "forest-loss" ? (
            <div>
              <div className="h-3 rounded-sm ring-1 ring-white/10" style={{ background: lossYearGradient() }} />
              <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-400">
                <span>{layer.firstYear}</span>
                <span className="font-sans text-slate-500">year of loss</span>
                <span>{layer.lastYear}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Legend unavailable.</p>
          )}
        </section>

        {layer.kind === "forest-loss" && (
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Loss by year · current view
            </h2>
            <ForestLossChart totals={forestTotals} firstYear={layer.firstYear} yearRange={yearRange} />
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Relative index read from the map tiles, scaled to the peak year. It depends on zoom level and is not
              hectares; exact rates come from the Trend Analysis module.
            </p>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">About this layer</h2>
          <p className="text-sm leading-relaxed text-slate-300">{layer.description}</p>
          <p className="text-sm leading-relaxed text-slate-400">
            <span className="text-slate-300">Why it matters: </span>
            {layer.relevance}
          </p>
          <div className="flex items-center gap-3 text-xs">
            <a href={layer.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
              Dataset source ↗
            </a>
            {info && !info.live && (
              <span className="text-amber-400/80">NASA catalog unreachable, using saved date list</span>
            )}
          </div>
        </section>

        <section className="space-y-3 border-t border-white/10 pt-4">
          <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
            Opacity
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-40 accent-sky-400"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-slate-300">
            Borders &amp; place names
            <input
              type="checkbox"
              checked={showReference}
              onChange={(e) => setShowReference(e.target.checked)}
              className="h-4 w-4 accent-sky-400"
            />
          </label>
        </section>
      </aside>

      <div className="relative h-[58vh] min-h-[320px] flex-1 lg:h-auto">
        <LeafletMap
          layer={layer}
          date={date}
          yearRange={yearRange}
          opacity={opacity}
          showReference={showReference}
          focus={focus}
          onLoadingChange={setLoading}
          onForestStats={setForestTotals}
        />

        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-md bg-[#0b0f14]/85 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
          <div className="text-sm font-medium text-white">{layer.title}</div>
          <div className="font-mono text-xs text-slate-400">
            {layer.kind === "gibs" && date ? formatMonth(date) : `${yearRange[0]} – ${yearRange[1]}`}
            {loading && <span className="ml-2 text-sky-400">loading…</span>}
          </div>
        </div>

        <div className="absolute bottom-8 left-3 z-[500] flex gap-1 rounded-md bg-[#0b0f14]/85 p-1 ring-1 ring-white/10 backdrop-blur">
          {(["south-asia", "world"] as MapFocus[]).map((t) => (
            <button
              key={t}
              onClick={() => setFocus((f) => ({ target: t, nonce: f.nonce + 1 }))}
              className="rounded px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
            >
              {t === "south-asia" ? "South Asia" : "World"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-md border border-white/10 px-2 py-1 font-mono text-xs text-slate-300 hover:bg-white/5 hover:text-white"
    >
      {children}
    </button>
  );
}

function PlayButton({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-medium text-[#04121d] hover:bg-sky-400"
    >
      {playing ? "❚❚ Pause" : "▶ Play"}
    </button>
  );
}

function YearSlider(props: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-xs text-slate-400">
      <span className="w-8">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="flex-1 accent-sky-400"
      />
      <span className="w-10 text-right font-mono tabular-nums text-slate-200">{props.value}</span>
    </label>
  );
}
