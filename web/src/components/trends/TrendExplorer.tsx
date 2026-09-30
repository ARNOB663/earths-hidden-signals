"use client";

import {
  Cactus,
  CaretDown,
  CloudLightning,
  CloudRain,
  HandPointing,
  Minus,
  Thermometer,
  ThermometerHot,
  TrendDown,
  TrendUp,
  Umbrella,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Numbers, Segmented, Stat, Sureness, TrendLegend } from "@/components/ui";
import { MapLoading } from "@/components/map/MapLoading";
import { MapSheet, type SheetSnap } from "@/components/map/MapSheet";
import { QuickGuide } from "@/components/ui/QuickGuide";
import { ShareButton } from "@/components/ui/ShareButton";
import { bnNum } from "@/lib/bn";
import { T, useT } from "@/lib/i18n";
import { AGREEMENT_BN, DEFINITION_BN, PLACE_BN, unitBn, ZONE_BN } from "@/lib/names";
import { nearestPlace } from "@/lib/places";
import { SEASON_PLAIN, sureness } from "@/lib/plain";
import {
  AGREEMENT_TEXT,
  agreement,
  ALPHA,
  cellAt,
  cellCenter,
  colorLimit,
  formatP,
  formatSigned,
  resultKey,
  SEASON_ORDER,
  VARIABLE_ORDER,
  type Crosscheck,
  type Manifest,
  type SeasonId,
  type SeriesGrid,
  type TrendGrid,
  type TrendSummary,
  type VariableId,
  type VariableMeta,
  type Zone,
} from "@/lib/trends";
import { SeriesChart } from "./SeriesChart";

const TrendMap = dynamic(() => import("./TrendMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

type Selection = { kind: "zone"; id: string } | { kind: "point"; lat: number; lon: number };

const HAZARD_WORD = {
  flood: ["Flood-prone", "বন্যাপ্রবণ"],
  landslide: ["Landslide-prone", "ভূমিধসপ্রবণ"],
  wildfire: ["Wildfire-prone", "দাবানলপ্রবণ"],
  cyclone: ["Cyclone-prone", "ঘূর্ণিঝড়প্রবণ"],
} as const;

type Words = { up: string; down: string; less: string; more: string; label: string; axis: string };

/** English words, then the same in Bangla. */
const WORDS_BN: Record<VariableId, Words> = {
  temperature: { up: "গরম বাড়ছে", down: "ঠান্ডা হচ্ছে", less: "ঠান্ডা", more: "গরম", label: "তাপমাত্রা", axis: "১৯৫১–১৯৮০ সালের গড়ের চেয়ে কত °সে বেশি" },
  rainfall: { up: "বৃষ্টি বাড়ছে", down: "শুষ্ক হচ্ছে", less: "শুষ্ক", more: "ভেজা", label: "বৃষ্টি", axis: "মৌসুমে মোট বৃষ্টি (মিমি)" },
  "hot-months": { up: "অতিরিক্ত গরম মাস বাড়ছে", down: "অতিরিক্ত গরম মাস কমছে", less: "কম", more: "বেশি", label: "অতিরিক্ত গরম মাস", axis: "বছরে অতিরিক্ত গরম মাস" },
  "heavy-rain": { up: "অতি ভারী বৃষ্টির দিন বাড়ছে", down: "অতি ভারী বৃষ্টির দিন কমছে", less: "কম", more: "বেশি", label: "অতি ভারী বৃষ্টির দিন", axis: "বছরে অতি ভারী বৃষ্টির দিন" },
  "dry-spell": { up: "শুকনো সময় দীর্ঘ হচ্ছে", down: "শুকনো সময় ছোট হচ্ছে", less: "ছোট", more: "দীর্ঘ", label: "বর্ষায় শুকনো সময়", axis: "বর্ষায় দীর্ঘতম শুকনো সময় (দিন)" },
  "wettest-day": { up: "প্রবল বর্ষণ বাড়ছে", down: "প্রবল বর্ষণ কমছে", less: "কম", more: "বেশি", label: "সবচেয়ে বৃষ্টির দিন", axis: "সবচেয়ে বৃষ্টির দিনে বৃষ্টি (মিমি)" },
};

const WORDS: Record<VariableId, Words> = {
  temperature: {
    up: "Getting warmer",
    down: "Getting cooler",
    less: "Cooling",
    more: "Warming",
    label: "Temperature",
    axis: "°C warmer than the 1951–1980 average",
  },
  rainfall: { up: "Getting wetter", down: "Getting drier", less: "Drier", more: "Wetter", label: "Rain", axis: "mm of rain in the season" },
  "hot-months": {
    up: "More very hot months",
    down: "Fewer very hot months",
    less: "Fewer",
    more: "More",
    label: "Very hot months",
    axis: "very hot months in the year",
  },
  "heavy-rain": {
    up: "More heavy-rain days",
    down: "Fewer heavy-rain days",
    less: "Fewer",
    more: "More",
    label: "Heavy-rain days",
    axis: "very heavy rain days in the year",
  },
  "dry-spell": {
    up: "Longer dry spells",
    down: "Shorter dry spells",
    less: "Shorter",
    more: "Longer",
    label: "Monsoon dry spells",
    axis: "longest dry spell in the monsoon (days)",
  },
  "wettest-day": {
    up: "Heavier downpours",
    down: "Lighter downpours",
    less: "Lighter",
    more: "Heavier",
    label: "Wettest day",
    axis: "mm of rain on the wettest day",
  },
};

const VARIABLE_ICON: Record<VariableId, React.ReactNode> = {
  temperature: <Thermometer size={16} />,
  rainfall: <CloudRain size={16} />,
  "hot-months": <ThermometerHot size={16} />,
  "heavy-rain": <CloudLightning size={16} />,
  "wettest-day": <Umbrella size={16} />,
  "dry-spell": <Cactus size={16} />,
};

// Small in-memory cache so switching back and forth doesn't refetch.
const cache = new Map<string, Promise<unknown>>();
function fetchJson<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return r.json();
      }),
    );
  }
  return cache.get(url) as Promise<T>;
}

export default function TrendExplorer({
  manifest,
  zones,
  crosscheck,
}: {
  manifest: Manifest;
  zones: Zone[];
  crosscheck: Crosscheck;
}) {
  const params = useSearchParams();
  const [variable, setVariable] = useState<VariableId>(() => {
    const v = params.get("var") as VariableId;
    return VARIABLE_ORDER.includes(v) ? v : "temperature";
  });
  const [season, setSeason] = useState<SeasonId>(() => {
    const s = params.get("season") as SeasonId;
    return SEASON_ORDER.includes(s) ? s : "annual";
  });
  const [selection, setSelection] = useState<Selection>(() => {
    const z = params.get("zone");
    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    if (params.has("lat") && Number.isFinite(lat) && Number.isFinite(lon)) return { kind: "point", lat, lon };
    return { kind: "zone", id: zones.some((zone) => zone.id === z) ? z! : "study-area" };
  });
  const [stats, setStats] = useState<{ key: string; data: TrendGrid } | null>(null);
  const [series, setSeries] = useState<{ key: string; data: SeriesGrid } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = manifest.variables[variable];
  // Extremes exist only for the whole year; remember the chosen season for when the user switches back.
  const seasons = meta.seasons ?? SEASON_ORDER;
  const effSeason: SeasonId = seasons.includes(season) ? season : "annual";
  const key = resultKey(variable, effSeason);
  const grid = manifest.grids[variable];
  const summary = manifest.summaries[key];
  const currentStats = stats?.key === key ? stats.data : null;
  const words = WORDS[variable];
  const wordsBn = WORDS_BN[variable];
  const t = useT();

  useEffect(() => {
    let alive = true;
    fetchJson<TrendGrid>(`/data/trends/${key}.json`)
      .then((data) => alive && setStats({ key, data }))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [key]);

  // A square's yearly values are only needed once someone clicks it.
  useEffect(() => {
    if (selection.kind !== "point") return;
    let alive = true;
    fetchJson<SeriesGrid>(`/data/trends/${key}_series.json`)
      .then((data) => alive && setSeries({ key, data }))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [key, selection.kind]);

  // Shareable address: ?var=…&season=…&zone=… or &lat=…&lon=…
  const firstSync = useRef(true);
  useEffect(() => {
    const q = new URLSearchParams({ var: variable, season: effSeason });
    if (selection.kind === "zone") q.set("zone", selection.id);
    else {
      q.set("lat", selection.lat.toFixed(2));
      q.set("lon", selection.lon.toFixed(2));
    }
    if (firstSync.current && !window.location.search) {
      firstSync.current = false;
      return;
    }
    firstSync.current = false;
    window.history.replaceState(null, "", `?${q}`);
  }, [variable, effSeason, selection]);

  const limit = useMemo(() => (currentStats ? colorLimit(currentStats.slopePerDecade) : 1), [currentStats]);

  const cell = selection.kind === "point" ? cellAt(grid, selection.lat, selection.lon) : null;
  const cellIndex = cell ? cell.i * grid.nLon + cell.j : null;
  const zone = selection.kind === "zone" ? zones.find((z) => z.id === selection.id)! : null;

  // What the answer panel shows for the current selection.
  const detail = useMemo((): Detail | null => {
    if (zone) {
      const r = zone.results[key];
      const titleEn = zone.id === "study-area" ? "All of South Asia" : zone.name;
      return {
        titleEn,
        title: <T en={titleEn} bn={ZONE_BN[zone.id]?.name ?? titleEn} />,
        subtitle: (
          <T
            en={zone.id === "study-area" ? "The average of every land square on the map." : zone.description}
            bn={ZONE_BN[zone.id]?.description ?? zone.description}
          />
        ),
        values: r.series,
        trend: r.trend,
        mean: r.mean,
        clear: null,
        check: crosscheck.zones[zone.id]?.[key]?.cru ?? null,
      };
    }
    if (cellIndex === null || !cell) return null;
    const { lat, lon } = cellCenter(grid, cell.i, cell.j);
    const near = nearestPlace(lat, lon);
    const coords = `${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E`;
    const titleEn = near ? `${near.close ? "Around" : "Near"} ${near.place.name}` : coords;
    const nameBn = near ? (PLACE_BN[near.place.id] ?? near.place.name) : "";
    const title = <T en={titleEn} bn={near ? `${nameBn}${near.close ? "র আশপাশে" : "র কাছে"}` : bnNum(coords)} />;
    const km = Math.round(grid.dLat * 111);
    const subtitle = (
      <T
        en={`One map square, about ${km} km across (${coords}).`}
        bn={`একটি মানচিত্র-বর্গ, প্রায় ${bnNum(km)} কিমি চওড়া (${bnNum(coords)})।`}
      />
    );
    if (!currentStats || currentStats.slopePerDecade[cellIndex] === null) {
      return { titleEn, title, subtitle, values: null, trend: null, mean: null, clear: null, sea: !!currentStats };
    }
    const trend: TrendSummary = {
      slopePerDecade: currentStats.slopePerDecade[cellIndex]!,
      lowerPerDecade: currentStats.lowerPerDecade[cellIndex]!,
      upperPerDecade: currentStats.upperPerDecade[cellIndex]!,
      p: currentStats.p[cellIndex]!,
    };
    return {
      titleEn,
      title,
      subtitle,
      values: series?.key === key ? series.data[cellIndex] : null,
      trend,
      mean: currentStats.mean[cellIndex],
      clear: currentStats.significant[cellIndex] === 1,
    };
  }, [zone, key, cellIndex, cell, grid, currentStats, series, crosscheck]);

  const years = meta.years ?? manifest.years;
  const up = summary.significantIncrease;
  const down = summary.significantDecrease;

  // Phones: the one-glance answer shown in the panel's summary, above the full details.
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const peekTrend = detail?.trend ?? null;
  const peekReal = peekTrend ? peekTrend.p < ALPHA : false;
  const peekUp = peekTrend ? peekTrend.slopePerDecade > 0 : false;
  const PeekArrow = !peekReal ? Minus : peekUp ? TrendUp : TrendDown;
  const peekRate = peekTrend ? formatSigned(peekTrend.slopePerDecade, meta.decimals) : "";
  const peek = (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 truncate font-semibold text-ink">{detail?.title}</div>
        <div className="shrink-0 text-xs text-ink-3">
          <T en={words.label} bn={wordsBn.label} />
        </div>
      </div>
      {peekTrend ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <PeekArrow size={20} weight="bold" className={peekReal ? "text-accent" : "text-ink-3"} />
          <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
            <T en={`${peekRate} ${meta.unit}`} bn={`${bnNum(peekRate)} ${unitBn(meta.unit)}`} />
          </span>
          <span className="text-sm text-ink-2">
            <T
              en={`every 10 years · ${sureness(peekTrend.p).short}`}
              bn={`প্রতি ১০ বছরে · ${sureness(peekTrend.p).shortBn}`}
            />
          </span>
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-2">
          <T en="No data for this place." bn="এই জায়গার কোনো তথ্য নেই।" />
        </p>
      )}
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-3">
        <HandPointing size={14} className="text-accent" />
        <T en="Tap any square on the map · drag up for details" bn="মানচিত্রের যেকোনো বর্গে ট্যাপ করুন · বিস্তারিত দেখতে উপরে টানুন" />
      </p>
    </div>
  );

  return (
    <div className="map-shell relative h-full overflow-hidden">
      {/* Its own stacking layer, so Leaflet's controls and the map keys stay under the phone panel. */}
      <div className="absolute inset-0 isolate">
        <TrendMap
          grid={grid}
          stats={currentStats}
          variable={variable}
          meta={meta}
          limit={limit}
          zones={zones}
          selectedZone={zone?.id ?? null}
          selectedCell={cell}
          onSelectCell={(lat, lon) => setSelection({ kind: "point", lat, lon })}
        />
        <div className="pointer-events-none absolute left-[58px] top-3 z-[500] hidden items-center gap-2 rounded-full bg-card px-4 py-2 text-sm text-ink-2 shadow-soft lg:flex">
          <HandPointing size={18} className="text-accent" />
          <T en="Click any square to see its story" bn="যেকোনো বর্গে ক্লিক করে তার গল্প দেখুন" />
        </div>
        <QuickGuide
          id="trends"
          title={<T en="How to use Climate trends" bn="জলবায়ুর প্রবণতা পাতা কীভাবে ব্যবহার করবেন" />}
          steps={[
            <T key="1" en="Choose temperature or rain, and a time of year." bn="তাপমাত্রা বা বৃষ্টি বেছে নিন, আর বছরের কোন সময় তা বেছে নিন।" />,
            <T key="2" en="Pick a region from the list, or click any square on the map." bn="তালিকা থেকে একটি অঞ্চল বেছে নিন, অথবা মানচিত্রের যেকোনো বর্গে ক্লিক করুন।" />,
            <T key="3" en="Read the answer: is it really changing, how fast, and how sure we are." bn="উত্তর পড়ুন: সত্যিই বদলাচ্ছে কি না, কত দ্রুত, আর আমরা কতটা নিশ্চিত।" />,
          ]}
          buttonClassName="absolute left-3 top-3 lg:left-[58px] lg:top-[60px]"
          cardClassName="lg:left-[58px] lg:top-[108px]"
        />
        <div className="absolute bottom-[calc(var(--sheet-peek,9rem)+0.75rem)] left-3 z-[500] w-[min(320px,calc(100%-6rem))] rounded-2xl bg-card p-3 shadow-soft sm:p-4 lg:bottom-10">
          <div className="mb-2 text-sm font-medium text-ink">
            <T en={`Change every 10 years (${meta.unit})`} bn={`প্রতি ১০ বছরে পরিবর্তন (${unitBn(meta.unit)})`} />
          </div>
          <TrendLegend
            variable={variable}
            limit={limit}
            decimals={meta.decimals}
            decreaseWord={<T en={words.less} bn={wordsBn.less} />}
            increaseWord={<T en={words.more} bn={wordsBn.more} />}
            mobileCompact
          />
        </div>
        {error && (
          <div className="absolute inset-x-3 top-16 z-[500] rounded-xl bg-card px-4 py-3 text-sm text-ink shadow-soft">
            <T en="Couldn't load the results. Please refresh the page." bn="ফলাফল লোড করা যায়নি। পাতাটি আবার লোড করুন।" />
          </div>
        )}
      </div>

      <MapSheet
        id="trend-panel"
        label={t("Trend details", "প্রবণতার বিস্তারিত")}
        className="lg:absolute lg:bottom-4 lg:right-4 lg:top-4 lg:z-[600] lg:w-[400px] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-line lg:bg-card lg:shadow-soft"
        bodyClassName="flex flex-col gap-5 p-5"
        peek={peek}
        snap={snap}
        onSnapChange={setSnap}
        scrollKey={JSON.stringify(selection)}
        scrollTargetId="trend-answer"
      >
        <section className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-semibold text-ink">
              <T en="How is the climate changing?" bn="জলবায়ু কীভাবে বদলাচ্ছে?" />
            </h1>
            <ShareButton className="-mr-2 -mt-1.5" />
          </div>
          <Step n={1} label={<T en="What to look at" bn="কী দেখবেন" />}>
            <div role="radiogroup" aria-label={t("What to look at", "কী দেখবেন")} className="space-y-2">
              {(["average", "extreme"] as const).map((kind) => (
                <div key={kind}>
                  <div className="mb-1 text-xs text-ink-3">
                    {kind === "average" ? <T en="Averages" bn="গড়" /> : <T en="Extremes" bn="চরম অবস্থা" />}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLE_ORDER.filter((v) => (manifest.variables[v]?.kind ?? "average") === kind).map((v) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={variable === v}
                        onClick={() => setVariable(v)}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all active:scale-[0.98] ${
                          variable === v ? "border-accent bg-accent-soft font-medium text-ink" : "border-line text-ink-2 hover:text-ink"
                        }`}
                      >
                        {VARIABLE_ICON[v]}
                        <T en={WORDS[v].label} bn={WORDS_BN[v].label} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Step>
          {seasons.length > 1 ? (
            <Step n={2} label={<T en="Which time of year" bn="বছরের কোন সময়" />}>
              <Segmented
                label={t("Which time of year", "বছরের কোন সময়")}
                value={effSeason}
                onChange={setSeason}
                options={SEASON_ORDER.map((s) => ({ id: s, label: <T en={SEASON_PLAIN[s].label} bn={SEASON_PLAIN[s].bn} /> }))}
              />
              <p className="mt-1.5 text-xs text-ink-3">
                <T en={SEASON_PLAIN[effSeason].hint} bn={SEASON_PLAIN[effSeason].hintBn} />
              </p>
            </Step>
          ) : (
            <Step n={2} label={<T en="What this counts" bn="এটি কী গোনে" />}>
              <p className="rounded-xl bg-sunken p-3 text-sm leading-relaxed text-ink-2">
                <T
                  en={`${meta.definition} Counted over the whole year, ${years[0]}–${years[years.length - 1]}.`}
                  bn={`${DEFINITION_BN[variable] ?? meta.definition} সারা বছর ধরে গোনা, ${bnNum(years[0])}–${bnNum(years[years.length - 1])}।`}
                />
              </p>
            </Step>
          )}
          <Step n={3} label={<T en="Which place" bn="কোন জায়গা" />}>
            <label className="relative block">
              <span className="sr-only">
                <T en="Choose a region" bn="একটি অঞ্চল বেছে নিন" />
              </span>
              <select
                value={selection.kind === "zone" ? selection.id : ""}
                onChange={(e) => setSelection({ kind: "zone", id: e.target.value })}
                className="w-full appearance-none rounded-xl border border-line bg-card py-2.5 pl-3.5 pr-10 text-sm text-ink"
              >
                {selection.kind === "point" && (
                  <option value="">{t(`${detail?.titleEn ?? "A map square"} (clicked)`, "মানচিত্রে ক্লিক করা বর্গ")}</option>
                )}
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.id === "study-area"
                      ? t("All of South Asia", "সমগ্র দক্ষিণ এশিয়া")
                      : t(
                          `${z.name}${z.hazard ? ` · ${HAZARD_WORD[z.hazard][0]}` : ""}`,
                          `${ZONE_BN[z.id]?.name ?? z.name}${z.hazard ? ` · ${HAZARD_WORD[z.hazard][1]}` : ""}`,
                        )}
                  </option>
                ))}
              </select>
              <CaretDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            </label>
            <p className="mt-1.5 text-xs text-ink-3">
              <T en="Or click any square on the map." bn="অথবা মানচিত্রের যেকোনো বর্গে ক্লিক করুন।" />
            </p>
          </Step>
        </section>

        <div className="h-px bg-line" />

        {detail ? (
          <Answer
            detail={detail}
            meta={meta}
            years={years}
            words={words}
            wordsBn={wordsBn}
            seasonLabel={SEASON_PLAIN[effSeason].label}
          />
        ) : (
          <p className="text-sm text-ink-3">
            <T en="Pick a place to see its story." bn="একটি জায়গা বেছে নিয়ে তার গল্প দেখুন।" />
          </p>
        )}

        <p className="rounded-xl bg-sunken p-3.5 text-sm leading-relaxed text-ink-2">
          <T
            en={`Across the whole map, ${up} of ${summary.cells} squares show a clear rise${down > 0 ? ` and ${down} a clear fall` : " and none a clear fall"}.${summary.cells - up - down > 0 ? ` The other ${summary.cells - up - down} show no clear change.` : ""}`}
            bn={`পুরো মানচিত্রে ${bnNum(summary.cells)}টি বর্গের মধ্যে ${bnNum(up)}টিতে স্পষ্ট বৃদ্ধি${down > 0 ? ` এবং ${bnNum(down)}টিতে স্পষ্ট হ্রাস` : ", কোনোটিতেই স্পষ্ট হ্রাস নেই"}।${summary.cells - up - down > 0 ? ` বাকি ${bnNum(summary.cells - up - down)}টিতে স্পষ্ট পরিবর্তন নেই।` : ""}`}
          />
        </p>
      </MapSheet>
    </div>
  );
}

interface Detail {
  /** English title, used for file names. */
  titleEn: string;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  values: (number | null)[] | null;
  trend: TrendSummary | null;
  mean: number | null;
  /** Passed the map-wide check (single squares only). */
  clear: boolean | null;
  sea?: boolean;
  /** The same trend from the independent CRU TS record (regions only). */
  check?: TrendSummary | null;
}

function Step({ n, label, children }: { n: number; label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{n}</span>
        {label}
      </div>
      {children}
    </div>
  );
}

function Answer({
  detail,
  meta,
  years,
  words,
  wordsBn,
  seasonLabel,
}: {
  detail: Detail;
  meta: VariableMeta;
  years: number[];
  words: Words;
  wordsBn: Words;
  seasonLabel: string;
}) {
  const t = useT();
  const u = meta.unit;
  const ub = unitBn(meta.unit);
  const { trend } = detail;
  const [first, last] = [years[0], years[years.length - 1]];
  const real = trend ? trend.p < ALPHA : false;
  const upward = trend ? trend.slopePerDecade > 0 : false;
  // Headline numbers are rounded for reading; "Show the numbers" keeps one more digit.
  const d = meta.decimals;
  const dd = meta.decimals + 1;
  const total = trend ? (trend.slopePerDecade * (last - first)) / 10 : 0;
  // "% of the usual amount" only makes sense for amounts like rain, not for counts of extreme events.
  const pct = trend && !meta.anomaly && meta.kind !== "extreme" && detail.mean ? (trend.slopePerDecade / detail.mean) * 100 : null;
  const Arrow = !real ? Minus : upward ? TrendUp : TrendDown;

  return (
    <section id="trend-answer" className="scroll-mt-4 space-y-4" aria-live="polite">
      <div>
        <h2 className="text-xl font-semibold text-ink">{detail.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{detail.subtitle}</p>
      </div>

      {detail.sea && (
        <p className="text-sm text-ink-2">
          <T
            en="This square is mostly sea, so we don't analyse it. Try a land square."
            bn="এই বর্গের বেশিরভাগই সাগর, তাই আমরা এটি বিশ্লেষণ করি না। একটি স্থলভাগের বর্গ বেছে নিন।"
          />
        </p>
      )}

      {trend && (
        <div className="rounded-2xl bg-sunken p-4">
          <div className="flex items-center gap-2 text-base font-semibold text-ink">
            <Arrow size={22} weight="bold" className={real ? "text-accent" : "text-ink-3"} />
            {real ? (
              <T en={upward ? words.up : words.down} bn={upward ? wordsBn.up : wordsBn.down} />
            ) : (
              <T en="No clear change" bn="স্পষ্ট পরিবর্তন নেই" />
            )}
          </div>
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink">
            <T
              en={`${formatSigned(trend.slopePerDecade, d)} ${u}`}
              bn={`${bnNum(formatSigned(trend.slopePerDecade, d))} ${ub}`}
            />
          </div>
          <div className="text-sm text-ink-2">
            <T
              en={`every 10 years${pct !== null ? ` (${formatSigned(pct, 1)}% of the usual amount)` : ""}`}
              bn={`প্রতি ১০ বছরে${pct !== null ? ` (স্বাভাবিক পরিমাণের ${bnNum(formatSigned(pct, 1))}%)` : ""}`}
            />
          </div>
          {real && (
            <p className="mt-2 text-sm text-ink-2">
              <T
                en={
                  <>
                    That adds up to about{" "}
                    <strong className="font-semibold text-ink">
                      {formatSigned(total, meta.decimals)} {u}
                    </strong>{" "}
                    since {first}.
                  </>
                }
                bn={
                  <>
                    {bnNum(first)} সাল থেকে মোট প্রায়{" "}
                    <strong className="font-semibold text-ink">
                      {bnNum(formatSigned(total, meta.decimals))} {ub}
                    </strong>
                    ।
                  </>
                }
              />
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Sureness p={trend.p} />
            {detail.check && (
              <span className="inline-flex items-center rounded-full bg-sunken px-3 py-1.5 text-sm text-ink-2">
                <T en={AGREEMENT_TEXT[agreement(trend, detail.check)]} bn={AGREEMENT_BN[agreement(trend, detail.check)]} />
              </span>
            )}
          </div>
          {!real && (
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              <T
                en="The ups and downs from year to year are bigger than any steady change, so we can't say it is really changing. That doesn't prove nothing is happening; the record just can't show it clearly."
                bn="বছরে বছরে ওঠানামা যেকোনো স্থির পরিবর্তনের চেয়ে বড়, তাই আমরা বলতে পারি না যে এটি সত্যিই বদলাচ্ছে। এর মানে এই নয় যে কিছুই ঘটছে না; শুধু এই রেকর্ড তা স্পষ্টভাবে দেখাতে পারে না।"
              />
            </p>
          )}
        </div>
      )}

      {detail.values ? (
        <SeriesChart
          years={years}
          values={detail.values}
          slopePerDecade={trend?.slopePerDecade ?? null}
          unit={meta.unit}
          decimals={meta.decimals}
          axisLabel={t(words.axis, wordsBn.axis)}
          zeroLine={meta.anomaly}
          lowerPerDecade={trend?.lowerPerDecade ?? null}
          upperPerDecade={trend?.upperPerDecade ?? null}
          title={`${detail.titleEn} ${words.label.toLowerCase()} ${seasonLabel.toLowerCase()}`}
        />
      ) : (
        trend && <div className="h-56 animate-pulse rounded-xl bg-sunken" aria-label={t("Loading chart", "চার্ট লোড হচ্ছে")} />
      )}

      {trend && (
        <Numbers>
          <dl>
            <Stat label="Rate (Sen's slope)" value={`${formatSigned(trend.slopePerDecade, dd)} ${meta.unit}/decade`} />
            <Stat label="95% range of the rate" value={`${formatSigned(trend.lowerPerDecade, dd)} to ${formatSigned(trend.upperPerDecade, dd)}`} />
            <Stat label="p-value (Mann–Kendall, autocorrelation-corrected)" value={formatP(trend.p)} />
            <Stat label="How sure" value={<T en={sureness(trend.p).short} bn={sureness(trend.p).shortBn} />} />
            {detail.clear !== null && <Stat label="Passes the map-wide check (FDR)" value={detail.clear ? "Yes" : "No"} />}
            {!meta.anomaly && detail.mean !== null && <Stat label="Average" value={`${detail.mean.toFixed(meta.decimals)} ${meta.unit}`} />}
            <Stat label="Data" value={meta.dataset} />
            {detail.check && (
              <Stat
                label="Same trend in CRU TS 4.10 (independent)"
                value={`${formatSigned(detail.check.slopePerDecade, dd)} ${meta.unit}/decade (${formatP(detail.check.p)})`}
              />
            )}
          </dl>
        </Numbers>
      )}
    </section>
  );
}
