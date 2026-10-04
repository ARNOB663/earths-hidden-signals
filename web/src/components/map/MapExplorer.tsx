"use client";

import {
  CaretDown,
  CaretLeft,
  CaretRight,
  Drop,
  GlobeHemisphereEast,
  Leaf,
  MapPin,
  Pause,
  Play,
  SidebarSimple,
  Sun,
  Thermometer,
  TreeEvergreen,
  X,
  type Icon,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { bnMonth, bnNum } from "@/lib/bn";
import { formatMonth, nearestDateIndex } from "@/lib/dates";
import { T, useLang, useT } from "@/lib/i18n";
import type { GibsCatalog } from "@/lib/gibs";
import { LAYERS, type LayerDef } from "@/lib/layers";
import { ShareButton } from "@/components/ui/ShareButton";
import { CompareDivider } from "./CompareDivider";
import { ForestLossChart } from "./ForestLossChart";
import type { MapFocus, MapView } from "./LeafletMap";
import { MapLoading } from "./MapLoading";
import { MapSheet, type SheetSnap } from "./MapSheet";
import type { MapPlace, MapPlaceData } from "@/lib/mapPlaces";
import { COUNTRY_BN } from "@/lib/names";
import { MapPlaceSearch } from "./MapPlaceSearch";
import { PlaceClimateContext, PlaceDataDetails } from "./PlaceClimateContext";
import styles from "./MapExplorer.module.css";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

const PLAY_INTERVAL_MS = 1600;

const LAYER_ICON: Record<string, Icon> = {
  "lst-day": Sun,
  "air-temp": Thermometer,
  precip: Drop,
  ndvi: Leaf,
  "forest-loss": TreeEvergreen,
};

export default function MapExplorer({ catalog, placeData }: { catalog: GibsCatalog; placeData: MapPlaceData }) {
  // The URL (?layer=…&date=… or ?layer=forest-loss&from=…&to=…) sets the starting view,
  // so a link can open the map on a specific variable and time.
  const params = useSearchParams();
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(() => placeData.places.find(p => p.id === params.get("place") && p.id !== "study-area") ?? null);
  const contextPlace = selectedPlace ?? placeData.places.find(p => p.id === "study-area")!;
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
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forestTotals, setForestTotals] = useState<number[] | null>(null);
  const [focus, setFocus] = useState<{ target: MapFocus; nonce: number }>({ target: "south-asia", nonce: 0 });
  // Compare mode: left of the divider shows the same month in `thenYear`.
  const [compareOn, setCompareOn] = useState(() => params.has("compare"));
  const [thenYear, setThenYear] = useState<string | null>(() => params.get("compare"));
  // Compare either by sliding between the two images, or as one map of the difference.
  const [compareView, setCompareView] = useState<"slide" | "diff">(() => (params.get("view") === "diff" ? "diff" : "slide"));
  const [split, setSplit] = useState(0.6);
  // Map position from the link (?at=lat,lon,zoom), kept up to date as the map moves.
  const [view, setView] = useState<MapView | null>(() => {
    const [lat, lon, zoom] = (params.get("at") ?? "").split(",").map(Number);
    return [lat, lon, zoom].every(Number.isFinite) && Math.abs(lat) <= 85 && zoom >= 2 && zoom <= 12 ? { lat, lon, zoom } : null;
  });
  const [initialView] = useState(view);
  // On large screens the controls float over the map; hiding them frees the whole map.
  const [panelHidden, setPanelHidden] = useState(false);

  const layer = LAYERS.find((l) => l.id === layerId)!;
  const info = layer.kind === "gibs" ? catalog[layer.id] : null;
  const dates = useMemo(() => info?.dates ?? [], [info]);
  const idx = dateIndex[layerId] ?? dates.length - 1;
  const date = dates[idx] ?? null;

  // The "then" date for compare mode: the chosen year, same month as the main date (or the first year).
  const monthYears = useMemo(
    () => (date ? dates.filter((d) => d.slice(4) === date.slice(4)).map((d) => d.slice(0, 4)) : []),
    [dates, date],
  );
  const effectiveThenYear = thenYear && monthYears.includes(thenYear) ? thenYear : (monthYears[0] ?? null);
  const compareDate =
    compareOn && layer.kind === "gibs" && date && effectiveThenYear ? `${effectiveThenYear}${date.slice(4)}` : null;
  const diffSettings =
    compareDate && compareView === "diff" && layer.kind === "gibs" && info?.values
      ? { values: info.values, range: layer.diff.range, kind: layer.diff.kind }
      : null;
  const diffOn = diffSettings !== null;

  // Keep the address bar in sync so the current view (layer, time and map position) can be copied and shared.
  useEffect(() => {
    const at = view ? `&at=${view.lat.toFixed(2)},${view.lon.toFixed(2)},${view.zoom}` : "";
    const query =
      layer.kind === "gibs"
        ? `?layer=${layer.id}${date ? `&date=${date}` : ""}${compareDate ? `&compare=${compareDate.slice(0, 4)}` : ""}${diffOn ? "&view=diff" : ""}${at}`
        : `?layer=${layer.id}&from=${yearRange[0]}&to=${yearRange[1]}${at}`;
    window.history.replaceState(null, "", `${query}${selectedPlace ? `&place=${encodeURIComponent(selectedPlace.id)}` : ""}`);
  }, [layer, date, yearRange, compareDate, view, diffOn, selectedPlace]);

  const setIdx = (next: number) =>
    setDateIndex((prev) => ({ ...prev, [layerId]: Math.min(dates.length - 1, Math.max(0, next)) }));

  /** Moves by one month, or to the same month in the next year (skipping gaps). */
  const stepDate = (direction: 1 | -1, by: "month" | "year"): boolean => {
    if (!date) return false;
    if (by === "month") {
      const next = idx + direction;
      if (next < 0 || next >= dates.length) return false;
      setIdx(next);
      return true;
    }
    const found = dates.indexOf(`${Number(date.slice(0, 4)) + direction}${date.slice(4)}`);
    if (found < 0) return false;
    setIdx(found);
    return true;
  };

  // Play steps through the same month each year, so the seasons don't hide the long-term change.
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
      } else if (!stepDate(1, "year")) {
        setPlaying(false);
      }
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
    // stepDate is re-created each render; the effect re-subscribes whenever the date moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, layerId, idx]);

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (layer.kind === "forest-loss") {
      // Build up loss year by year from the start year.
      setYearRange(([start]) => [start, start]);
    } else if (!dates.includes(`${Number(date!.slice(0, 4)) + 1}${date!.slice(4)}`)) {
      // Already at the end: restart from the first year with this month.
      setIdx(nearestDateIndex(dates, `${dates[0].slice(0, 4)}${date!.slice(4)}`));
    }
    setPlaying(true);
  };

  const selectLayer = (next: LayerDef) => {
    setPlaying(false);
    if (next.kind === "forest-loss") setForestTotals(null);
    setLayerId(next.id);
  };

  const lang = useLang();
  const t = useT();
  const month = (d: string) => (lang === "bn" ? bnMonth(d) : formatMonth(d));
  const year = (y: string | number) => (lang === "bn" ? bnNum(y) : String(y));

  // Phones: the layer, the month (with previous/next) and Play stay in the panel's summary,
  // so the time can change while the map stays in view.
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const PeekIcon = LAYER_ICON[layer.id];
  const peek = (
    <div className="min-w-0">
      <p className="mb-2 truncate text-xs font-medium text-ink-2">{t(contextPlace.name, COUNTRY_BN[contextPlace.name] ?? contextPlace.name)}</p>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 font-semibold text-ink">
          <PeekIcon size={18} weight="fill" className="shrink-0 text-accent" />
          <span className="truncate">
            <T en={layer.shortTitle} bn={layer.bn.shortTitle} />
          </span>
        </div>
        {compareDate && (
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-ink">
            {diffSettings ? (
              <T en={`change since ${month(compareDate)}`} bn={`${month(compareDate)} থেকে পরিবর্তন`} />
            ) : (
              <T en={`vs ${month(compareDate)}`} bn={`${month(compareDate)}-এর সাথে তুলনা`} />
            )}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {layer.kind === "gibs" && date ? (
          <>
            <IconButton label={t("Previous month", "আগের মাস")} onClick={() => stepDate(-1, "month")}>
              <CaretLeft size={18} />
            </IconButton>
            <div className="min-w-0 flex-1 text-center text-lg font-semibold tabular-nums text-ink">{month(date)}</div>
            <IconButton label={t("Next month", "পরের মাস")} onClick={() => stepDate(1, "month")}>
              <CaretRight size={18} />
            </IconButton>
          </>
        ) : (
          <div className="min-w-0 flex-1 text-lg font-semibold tabular-nums text-ink">
            {year(yearRange[0])} – {year(yearRange[1])}
          </div>
        )}
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent-strong px-4 text-sm font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
        >
          {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
          {playing ? <T en="Pause" bn="থামান" /> : <T en="Play" bn="চালান" />}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-3">
        <T en="Drag up to change the layer, compare two years and more" bn="স্তর বদলাতে, দুই বছর তুলনা করতে ও আরও দেখতে উপরে টানুন" />
      </p>
    </div>
  );

  return (
    <div className={`map-shell relative h-full overflow-hidden ${styles.shell}`}>
      <MapPlaceSearch key={selectedPlace?.id ?? "default"} places={placeData.places} selected={selectedPlace} onSelect={place => { setSelectedPlace(place); setPanelHidden(false); }} />
      {/* Its own stacking layer, so Leaflet's controls and the map keys stay under the phone panel. */}
      <div className="absolute inset-0 isolate">
        <LeafletMap
          layer={layer}
          date={date}
          yearRange={yearRange}
          opacity={opacity}
          showReference={showReference}
          focus={focus}
          onLoadingChange={setLoading}
          onForestStats={setForestTotals}
          compareDate={compareDate}
          split={split}
          initialView={initialView}
          onViewChange={setView}
          diff={diffSettings}
          selectedPlace={selectedPlace}
          panelHidden={panelHidden}
        />
        {compareDate && date && !diffSettings && (
          <CompareDivider split={split} onChange={setSplit} leftLabel={month(compareDate)} rightLabel={month(date)} />
        )}
        {loading && (
          <div className={`pointer-events-none absolute left-1/2 top-16 z-[500] -translate-x-1/2 rounded-full bg-card px-4 py-1.5 text-sm text-ink-2 shadow-soft lg:top-4 ${panelHidden ? "" : "lg:left-[calc(50%+190px)]"}`}>
            <T en="Loading NASA imagery…" bn="নাসার ছবি লোড হচ্ছে…" />
          </div>
        )}
        <div className={`absolute right-3 top-[148px] z-[500] flex rounded-full border border-line bg-card text-sm shadow-soft lg:bottom-10 lg:top-auto ${styles.focusControls}`}>
          {(["south-asia", "world"] as MapFocus[]).map((target) => (
            <button
              key={target}
              onClick={() => setFocus((f) => ({ target, nonce: f.nonce + 1 }))}
              aria-label={target === "south-asia" ? t("Zoom to South Asia", "দক্ষিণ এশিয়ায় যান") : t("Show the whole world", "পুরো বিশ্ব দেখুন")}
              className="flex h-10 items-center gap-1.5 px-3 text-ink-2 transition-colors hover:bg-sunken hover:text-ink lg:px-3.5"
            >
              {target === "south-asia" ? <MapPin size={16} /> : <GlobeHemisphereEast size={16} />}
              <span className="hidden lg:inline">
                {target === "south-asia" ? <T en="South Asia" bn="দক্ষিণ এশিয়া" /> : <T en="World" bn="বিশ্ব" />}
              </span>
            </button>
          ))}
          <span className="w-px self-stretch bg-line" aria-hidden />
          <ShareButton />
        </div>
        {panelHidden && (
          <>
            <div className="absolute left-4 top-4 z-[600] hidden items-center gap-3 rounded-full border border-line bg-card py-1.5 pl-1.5 pr-4 text-sm shadow-soft lg:flex">
              <button
                onClick={() => setPanelHidden(false)}
                aria-expanded={false}
                aria-controls="map-controls"
                className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-3.5 py-2 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
              >
                <SidebarSimple size={16} weight="fill" />
                <T en="Show controls" bn="নিয়ন্ত্রণ দেখান" />
              </button>
              <span className="font-medium text-ink">
                <T en={layer.shortTitle} bn={layer.bn.shortTitle} />
              </span>
              <span className="tabular-nums text-ink-2">
                {layer.kind === "gibs" && date
                  ? compareDate
                    ? `${month(compareDate)} ↔ ${month(date)}`
                    : month(date)
                  : `${year(yearRange[0])} – ${year(yearRange[1])}`}
              </span>
            </div>
          </>
        )}
      </div>

      <MapSheet
        id="map-controls"
        label={t("Map controls", "মানচিত্রের নিয়ন্ত্রণ")}
        className={`lg:absolute lg:bottom-4 lg:left-4 lg:top-4 lg:z-[600] lg:w-[340px] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-line lg:bg-card lg:shadow-soft lg:transition-[translate,visibility] lg:duration-300 ${
          panelHidden ? "lg:invisible lg:-translate-x-[calc(100%+2rem)]" : ""
        }`}
        bodyClassName="flex flex-col gap-4 p-4"
        peek={peek}
        snap={snap}
        onSnapChange={setSnap}
      >
        <section>
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-ink">{t(contextPlace.name, COUNTRY_BN[contextPlace.name] ?? contextPlace.name)}</p>
            {selectedPlace && <button type="button" onClick={() => setSelectedPlace(null)} aria-label={t("Clear place selection", "নির্বাচিত স্থান মুছুন")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sunken"><X size={16} /></button>}
          </div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-sm font-medium text-ink">
              <T en={layer.shortTitle} bn={layer.bn.shortTitle} />
            </h1>
            {layer.kind === "gibs" && date && <p className="text-xs tabular-nums text-ink-3">{t("Map", "মানচিত্র")} · {month(date)}</p>}
            <button
              onClick={() => setPanelHidden(true)}
              aria-expanded={!panelHidden}
              aria-controls="map-controls"
              title={t("Hide this panel to see more of the map", "মানচিত্র বড় করে দেখতে এই অংশটি লুকান")}
              className="-mr-1.5 -mt-1 hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink lg:inline-flex"
            >
              <SidebarSimple size={17} />
              <T en="Hide" bn="লুকান" />
            </button>
          </div>
          <PlaceClimateContext place={contextPlace} layer={layer} date={date} />
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium text-ink-3"><T en="Explore" bn="দেখুন" /></p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "lst-day", category: "heat", label: "Heat", bn: "তাপ" },
                { id: "precip", category: "water", label: "Rain", bn: "বৃষ্টি" },
                { id: "ndvi", category: "vegetation", label: "Green", bn: "সবুজ" },
                { id: "forest-loss", category: "forest", label: "Forest", bn: "বন" },
              ].map(group => {
                const target = LAYERS.find(l => l.id === group.id)!;
                const active = layer.category === group.category;
                const Icon = LAYER_ICON[group.id];
                return <button key={group.id} type="button" aria-pressed={active}
                  onClick={() => selectLayer(active ? layer : target)}
                  className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] transition-colors ${active ? "border-accent bg-accent-soft font-medium text-ink" : "border-line text-ink-2 hover:border-ink-3 hover:text-ink"}`}>
                  <Icon size={16} className={active ? "text-accent" : ""} aria-hidden /><T en={group.label} bn={group.bn} />
                </button>;
              })}
            </div>
            {layer.category === "heat" && <div className="mt-2 flex gap-2" role="group" aria-label={t("Heat measurement", "তাপের পরিমাপ")}>
              {[["lst-day", "Land", "মাটি"], ["air-temp", "Air", "বাতাস"]].map(([id, en, bn]) => <button key={id} type="button" aria-pressed={layer.id === id} onClick={() => selectLayer(LAYERS.find(l => l.id === id)!)}
                className={`min-h-8 flex-1 rounded-full text-xs ${layer.id === id ? "bg-sunken font-medium text-ink" : "text-ink-3 hover:bg-sunken"}`}><T en={en} bn={bn} /></button>)}
            </div>}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            <T en="Time" bn="সময়" />
          </h2>
          {layer.kind === "gibs" && date ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <IconButton label={t("Previous month", "আগের মাস")} onClick={() => stepDate(-1, "month")}>
                  <CaretLeft size={18} />
                </IconButton>
                <div className="flex-1 text-center text-lg font-semibold tabular-nums text-ink">{month(date)}</div>
                <IconButton label={t("Next month", "পরের মাস")} onClick={() => stepDate(1, "month")}>
                  <CaretRight size={18} />
                </IconButton>
              </div>
              <input
                type="range"
                min={0}
                max={dates.length - 1}
                value={idx}
                onChange={(e) => setIdx(Number(e.target.value))}
                aria-label={t("Choose a month", "একটি মাস বেছে নিন")}
                className="h-8 w-full cursor-pointer accent-[var(--accent)]"
              />
              <div className="flex justify-between text-xs text-ink-3">
                <span>{month(dates[0])}</span>
                <span>{month(dates[dates.length - 1])}</span>
              </div>
              <div className="flex items-center gap-3">
                <PlayButton playing={playing} onClick={togglePlay} />
                <button
                  type="button"
                  onClick={() => setCompareOn((current) => !current)}
                  aria-pressed={compareOn}
                  className={`min-h-10 flex-1 rounded-full border px-3 text-xs font-medium transition-colors ${compareOn ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-ink-3 hover:text-ink"}`}
                >
                  <T en={`⇄ Compare with ${monthYears[0] ?? "2000"}`} bn={`⇄ ${monthYears[0] ?? "2000"}-এর সাথে তুলনা`} />
                </button>
              </div>
              {compareOn && (
                <div className="rounded-xl border border-line p-3">
                {effectiveThenYear && (
                  <div className="mt-3 space-y-2 text-sm text-ink-2">
                    <div role="radiogroup" aria-label={t("How to compare", "কীভাবে তুলনা করবেন")} className="grid grid-cols-2 gap-1 rounded-full bg-sunken p-1">
                      {(
                        [
                          ["slide", "Slide", "স্লাইড"],
                          ["diff", "Difference", "পার্থক্য"],
                        ] as const
                      ).map(([value, en, bn]) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={compareView === value}
                          onClick={() => setCompareView(value)}
                          disabled={value === "diff" && !info?.values}
                          className={`min-h-9 rounded-full text-sm transition-colors disabled:opacity-40 ${
                            compareView === value ? "bg-card font-medium text-ink shadow-soft" : "text-ink-2 hover:text-ink"
                          }`}
                        >
                          <T en={en} bn={bn} />
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center justify-between gap-3">
                      {diffSettings ? <T en="Then" bn="আগে" /> : <T en="Left side" bn="বাম পাশ" />}
                      <span className="relative">
                        <select
                          value={effectiveThenYear}
                          onChange={(e) => setThenYear(e.target.value)}
                          className="appearance-none rounded-full border border-line bg-card py-1.5 pl-3.5 pr-8 text-sm text-ink"
                        >
                          {monthYears.map((y) => (
                            <option key={y} value={y}>
                              {month(`${y}${date.slice(4)}`)}
                            </option>
                          ))}
                        </select>
                        <CaretDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
                      </span>
                    </label>
                    <div className="flex items-center justify-between gap-3">
                      {diffSettings ? <T en="Now" bn="এখন" /> : <T en="Right side" bn="ডান পাশ" />}
                      <span className="font-medium text-ink">{month(date)}</span>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>
          ) : layer.kind === "forest-loss" ? (
            <div className="mt-3 space-y-3">
              <div className="text-center text-2xl font-semibold tabular-nums text-ink">
                {year(yearRange[0])} – {year(yearRange[1])}
              </div>
              <YearSlider
                label={t("From", "থেকে")}
                value={yearRange[0]}
                min={layer.firstYear}
                max={layer.lastYear}
                onChange={(v) => setYearRange(([, end]) => [v, Math.max(v, end)])}
              />
              <YearSlider
                label={t("To", "পর্যন্ত")}
                value={yearRange[1]}
                min={layer.firstYear}
                max={layer.lastYear}
                onChange={(v) => setYearRange(([start]) => [Math.min(start, v), v])}
              />
              <PlayButton playing={playing} onClick={togglePlay} />
              <p className="text-xs leading-relaxed text-ink-3">
                <T
                  en="Play adds one year at a time, so you can watch forest loss spread."
                  bn="প্লে চাপলে এক এক বছর যোগ হয়, ফলে বন উজাড় কীভাবে ছড়াচ্ছে দেখা যায়।"
                />
              </p>
            </div>
          ) : null}
        </section>

        {layer.kind === "forest-loss" && !selectedPlace && (
          <section>
            <h2 className="text-lg font-semibold text-ink">
              <T en="Forest lost each year" bn="প্রতি বছর কতটা বন উজাড়" />
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              <T
                en="For the area you can see on the map. Move or zoom the map to compare places."
                bn="মানচিত্রে এখন যে এলাকা দেখা যাচ্ছে তার জন্য। জায়গা তুলনা করতে মানচিত্র সরান বা বড়-ছোট করুন।"
              />
            </p>
            <div className="mt-3">
              <ForestLossChart totals={forestTotals} firstYear={layer.firstYear} yearRange={yearRange} />
            </div>
          </section>
        )}

        <PlaceDataDetails key={`${contextPlace.id}-${layer.id}`} place={contextPlace} layer={layer} date={date} />

        <section className="border-t border-line pt-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            <T en="Map display" bn="মানচিত্র প্রদর্শন" />
          </h2>
          <div className="mt-3 space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              <T en="See-through" bn="স্বচ্ছতা" />
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={1.2 - opacity}
                onChange={(e) => setOpacity(1.2 - Number(e.target.value))}
                className="h-8 w-40 cursor-pointer accent-[var(--accent)]"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-ink-2">
              <T en="Show country borders and city names" bn="দেশের সীমানা ও শহরের নাম দেখান" />
              <input
                type="checkbox"
                checked={showReference}
                onChange={(e) => setShowReference(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>
          </div>
        </section>
      </MapSheet>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-2 transition-all hover:bg-sunken hover:text-ink active:scale-95"
    >
      {children}
    </button>
  );
}

function PlayButton({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
    >
      {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
      {playing ? <T en="Pause" bn="থামান" /> : <T en="Animate years" bn="বছর চালান" />}
    </button>
  );
}

function YearSlider(props: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm text-ink-2">
      <span className="w-10">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="h-8 flex-1 cursor-pointer accent-[var(--accent)]"
      />
      <span className="w-10 text-right font-medium tabular-nums text-ink">{props.value}</span>
    </label>
  );
}
