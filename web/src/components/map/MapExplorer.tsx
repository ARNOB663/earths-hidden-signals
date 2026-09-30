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
import { QuickGuide } from "@/components/ui/QuickGuide";
import { ShareButton } from "@/components/ui/ShareButton";
import { CompareDivider } from "./CompareDivider";
import { DIFF_WORDS, diffGradient, type DiffKind } from "./diffColors";
import { ForestLossChart } from "./ForestLossChart";
import type { MapFocus, MapView } from "./LeafletMap";
import { LegendBar } from "./LegendBar";
import { MapLoading } from "./MapLoading";
import { MapSheet, type SheetSnap } from "./MapSheet";
import { lossYearGradient } from "./lossColors";

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
    window.history.replaceState(null, "", query);
  }, [layer, date, yearRange, compareDate, view, diffOn]);

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

  const years = useMemo(() => [...new Set(dates.map((d) => d.slice(0, 4)))], [dates]);
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
    <div className="map-shell relative h-full overflow-hidden">
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
        />
        {compareDate && date && !diffSettings && (
          <CompareDivider split={split} onChange={setSplit} leftLabel={month(compareDate)} rightLabel={month(date)} />
        )}
        <QuickGuide
          id="explore"
          title={<T en="How to use the Satellite map" bn="স্যাটেলাইট মানচিত্র কীভাবে ব্যবহার করবেন" />}
          steps={[
            <T
              key="1"
              en="Pick what you want to see: heat, rain, greenness or forest loss."
              bn="কী দেখতে চান বেছে নিন: তাপ, বৃষ্টি, সবুজের পরিমাণ বা বন উজাড়।"
            />,
            <T key="2" en="Pick a month, or press Play to watch the years go by." bn="একটি মাস বেছে নিন, অথবা প্লে চেপে বছরগুলো একে একে দেখুন।" />,
            <T
              key="3"
              en='Turn on "Compare two years" to see a place then and now, side by side.'
              bn="&ldquo;দুই বছর তুলনা&rdquo; চালু করে একই জায়গা আগে ও এখন পাশাপাশি দেখুন।"
            />,
          ]}
          buttonClassName={`absolute left-3 top-3 ${panelHidden ? "lg:left-4 lg:top-[76px]" : "lg:left-[392px] lg:top-4"}`}
          cardClassName={panelHidden ? "lg:left-4 lg:top-[128px]" : "lg:left-[392px] lg:top-[68px]"}
        />
        {loading && (
          <div className={`pointer-events-none absolute left-1/2 top-16 z-[500] -translate-x-1/2 rounded-full bg-card px-4 py-1.5 text-sm text-ink-2 shadow-soft lg:top-4 ${panelHidden ? "" : "lg:left-[calc(50%+190px)]"}`}>
            <T en="Loading NASA imagery…" bn="নাসার ছবি লোড হচ্ছে…" />
          </div>
        )}
        <div className="absolute right-3 top-3 z-[500] flex rounded-full border border-line bg-card text-sm shadow-soft lg:bottom-10 lg:top-auto">
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
        <div className="absolute bottom-[calc(var(--sheet-peek,9rem)+0.75rem)] left-3 z-[500] w-[min(280px,calc(100%-1.5rem))] rounded-2xl bg-card p-3 shadow-soft lg:hidden">
          <ColourKey layer={layer} info={info} diff={diffSettings && compareDate && date ? { then: month(compareDate), now: month(date) } : null} />
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
            <div className="absolute bottom-4 left-4 z-[600] hidden w-72 rounded-2xl border border-line bg-card p-4 shadow-soft lg:block">
              <div className="mb-2 text-sm font-medium text-ink">
                <T en="Colour key" bn="রঙের অর্থ" />
              </div>
              <ColourKey layer={layer} info={info} diff={diffSettings && compareDate && date ? { then: month(compareDate), now: month(date) } : null} />
            </div>
          </>
        )}
      </div>

      <MapSheet
        id="map-controls"
        label={t("Map controls", "মানচিত্রের নিয়ন্ত্রণ")}
        className={`lg:absolute lg:bottom-4 lg:left-4 lg:top-4 lg:z-[600] lg:w-[360px] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-line lg:bg-card lg:shadow-soft lg:transition-[translate,visibility] lg:duration-300 ${
          panelHidden ? "lg:invisible lg:-translate-x-[calc(100%+2rem)]" : ""
        }`}
        bodyClassName="flex flex-col gap-6 p-5"
        peek={peek}
        snap={snap}
        onSnapChange={setSnap}
      >
        <section>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-semibold text-ink">
              <T en="What do you want to see?" bn="কী দেখতে চান?" />
            </h1>
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            {LAYERS.map((l) => {
              const active = l.id === layerId;
              const LayerIcon = LAYER_ICON[l.id];
              return (
                <button
                  key={l.id}
                  onClick={() => selectLayer(l)}
                  aria-pressed={active}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-all active:scale-[0.98] ${
                    active
                      ? "border-accent bg-accent-soft font-medium text-ink"
                      : "border-line text-ink-2 hover:border-ink-3 hover:text-ink"
                  } ${l.id === "forest-loss" ? "col-span-2" : ""}`}
                >
                  <LayerIcon size={20} weight={active ? "fill" : "regular"} className={active ? "text-accent" : ""} />
                  <T en={l.shortTitle} bn={l.bn.shortTitle} />
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            <T en={layer.description} bn={layer.bn.description} />
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">
            <T en="When?" bn="কখন?" />
          </h2>
          {layer.kind === "gibs" && date ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <IconButton label={t("Previous month", "আগের মাস")} onClick={() => stepDate(-1, "month")}>
                  <CaretLeft size={18} />
                </IconButton>
                <div className="flex-1 text-center text-2xl font-semibold tabular-nums text-ink">{month(date)}</div>
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
              <div className="flex items-center gap-2">
                <PlayButton playing={playing} onClick={togglePlay} />
                <label className="relative ml-auto">
                  <span className="sr-only">
                    <T en="Jump to year" bn="বছরে যান" />
                  </span>
                  <select
                    value={date.slice(0, 4)}
                    onChange={(e) => setIdx(nearestDateIndex(dates, `${e.target.value}${date.slice(4)}`))}
                    className="appearance-none rounded-full border border-line bg-card py-2 pl-4 pr-9 text-sm text-ink"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {year(y)}
                      </option>
                    ))}
                  </select>
                  <CaretDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                </label>
              </div>
              <p className="text-xs leading-relaxed text-ink-3">
                <T
                  en="Play shows the same month in every year, so you can see the long-term change without the seasons getting in the way."
                  bn="প্লে চাপলে প্রতি বছরের একই মাস দেখানো হয়, যাতে ঋতুর পার্থক্য বাদ দিয়ে দীর্ঘমেয়াদি পরিবর্তনটা দেখা যায়।"
                />
              </p>

              <div className="rounded-xl border border-line p-3.5">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-medium text-ink">
                      <T en="Compare two years" bn="দুই বছর তুলনা" />
                    </span>
                    <span className="block text-xs text-ink-3">
                      <T en="See a place then and now, side by side" bn="একই জায়গা আগে ও এখন, পাশাপাশি" />
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={compareOn}
                    onChange={(e) => setCompareOn(e.target.checked)}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                </label>
                {compareOn && effectiveThenYear && (
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
                    <p className="text-xs leading-relaxed text-ink-3">
                      {diffSettings ? (
                        <T
                          en={`Each colour shows how ${month(date)} differed from ${month(compareDate!)} at that spot. A single month can be unusual, so try a few years.`}
                          bn={`প্রতিটি রঙ দেখায় ওই জায়গায় ${month(date)} ${month(compareDate!)}-এর চেয়ে কতটা আলাদা ছিল। একটি মাস অস্বাভাবিক হতে পারে, তাই কয়েকটি বছর দেখুন।`}
                        />
                      ) : (
                        <T en="Drag the round handle on the map to slide between them." bn="মানচিত্রের গোল হাতলটি টেনে দুটির মধ্যে সরান।" />
                      )}
                    </p>
                  </div>
                )}
              </div>
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

        <section>
          <h2 className="text-lg font-semibold text-ink">
            <T en="Colour key" bn="রঙের অর্থ" />
          </h2>
          <div className="mt-3">
            <ColourKey layer={layer} info={info} diff={diffSettings && compareDate && date ? { then: month(compareDate), now: month(date) } : null} />
          </div>
        </section>

        {layer.kind === "forest-loss" && (
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

        <section className="rounded-xl bg-sunken p-4">
          <h2 className="text-sm font-semibold text-ink">
            <T en="Why it matters" bn="কেন গুরুত্বপূর্ণ" />
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            <T en={layer.relevance} bn={layer.bn.relevance} />
          </p>
          <a href={layer.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-10 items-center text-sm text-accent hover:underline">
            <T en="Data source:" bn="তথ্যের উৎস:" /> {layer.mission}
          </a>
          {info && !info.live && (
            <p className="mt-2 text-xs text-watch">
              <T
                en="Couldn't reach NASA's catalog; showing the saved list of dates."
                bn="নাসার তালিকায় পৌঁছানো যায়নি; সংরক্ষিত তারিখের তালিকা দেখানো হচ্ছে।"
              />
            </p>
          )}
        </section>

        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-ink-2 hover:text-ink">
            <T en="Map settings" bn="মানচিত্রের সেটিংস" />
            <CaretDown size={16} className="transition-transform group-open:rotate-180" />
          </summary>
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
        </details>
      </MapSheet>
    </div>
  );
}

function ColourKey({
  layer,
  info,
  diff,
}: {
  layer: LayerDef;
  info: GibsCatalog[string] | null;
  /** When comparing as a difference: the two months being compared. */
  diff?: { then: string; now: string } | null;
}) {
  const t = useT();
  if (layer.kind === "gibs" && diff) return <DiffLegend kind={layer.diff.kind} range={layer.diff.range} unit={[layer.diff.unit, layer.diff.unitBn]} {...diff} />;
  if (layer.kind === "gibs" && info?.legend)
    return <LegendBar legend={info.legend} unit={t(layer.displayUnit, layer.bn.unit ?? layer.displayUnit)} />;
  if (layer.kind === "forest-loss")
    return (
      <div>
        <div className="h-3 rounded-full" style={{ background: lossYearGradient() }} />
        <div className="mt-1.5 flex justify-between text-xs text-ink-3">
          <span>
            <T en={`Lost in ${layer.firstYear}`} bn={`${bnNum(layer.firstYear)} সালে উজাড়`} />
          </span>
          <span>
            <T en={`Lost in ${layer.lastYear}`} bn={`${bnNum(layer.lastYear)} সালে উজাড়`} />
          </span>
        </div>
      </div>
    );
  return (
    <p className="text-sm text-ink-3">
      <T en="Colour key unavailable." bn="রঙের অর্থ পাওয়া যায়নি।" />
    </p>
  );
}

/** Colour key for the difference view: "less" on the left, no change in the middle, "more" on the right. */
function DiffLegend({ kind, range, unit, then, now }: { kind: DiffKind; range: number; unit: [string, string]; then: string; now: string }) {
  const words = DIFF_WORDS[kind];
  const n = range < 1 ? range.toFixed(2) : String(range);
  return (
    <div>
      <div className="mb-2 text-xs text-ink-2">
        <T en={`${now} compared with ${then}`} bn={`${now}, ${then}-এর তুলনায়`} />
      </div>
      <div className="h-3 rounded-full" style={{ background: diffGradient(kind, "var(--mid)") }} />
      <div className="mt-1.5 grid grid-cols-3 text-xs">
        <span className="text-ink-2">
          <T en={words.less[0]} bn={words.less[1]} />
        </span>
        <span className="text-center text-ink-2">
          <T en="Same" bn="একই" />
        </span>
        <span className="text-right text-ink-2">
          <T en={words.more[0]} bn={words.more[1]} />
        </span>
        <span className="text-ink-3">
          <T en={`−${n} ${unit[0]} or more`} bn={`−${bnNum(n)} ${unit[1]} বা বেশি`} />
        </span>
        <span />
        <span className="text-right text-ink-3">
          <T en={`+${n} ${unit[0]} or more`} bn={`+${bnNum(n)} ${unit[1]} বা বেশি`} />
        </span>
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
      {playing ? <T en="Pause" bn="থামান" /> : <T en="Play through the years" bn="বছরগুলো চালান" />}
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
