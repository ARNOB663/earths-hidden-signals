"use client";

// Climate trend explorer: pick a measure and a season, see where it is changing on the map, then
// pick a region or a map square to read what is changing, by how much, and whether the change is
// statistically clear. Every number comes from the committed analysis output in /data/trends/;
// nothing is computed here beyond formatting and the total-change arithmetic (rate × years).

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { MapLoading } from "@/components/signal/MapLoading";
import { CONTROL } from "@/components/ui";
import { bnNum } from "@/lib/bn";
import { downloadCsv, slug } from "@/lib/download";
import { T, useLang } from "@/lib/i18n";
import { AGREEMENT_BN, DEFINITION_BN, PLACE_BN, unitBn, ZONE_BN } from "@/lib/names";
import { nearestPlace } from "@/lib/places";
import {
  AGREEMENT_TEXT,
  ALPHA,
  agreement,
  cellAt,
  cellCenter,
  colorLimit,
  formatP,
  formatSigned,
  resultKey,
  SEASON_ORDER,
  trendLegendTokens,
  VARIABLE_ORDER,
  type Crosscheck,
  type Manifest,
  type SeasonId,
  type SeriesGrid,
  type TrendGrid,
  type TrendSummary,
  type VariableId,
  type Zone,
} from "@/lib/trends";
import { SeriesChart } from "./SeriesChart";

const TrendMap = dynamic(() => import("./TrendMap"), { ssr: false, loading: () => <MapLoading /> });

type Selection = { kind: "zone"; id: string } | { kind: "point"; lat: number; lon: number };

/** Pettitt turning points per region and result key (analysis/turning.py). */
export type Turning = Record<string, Record<string, { year: number; before: number; after: number; p: number }>>;

type Words = { label: string; up: string; down: string; axis: string };

const WORDS: Record<VariableId, Words> = {
  temperature: { label: "Temperature", up: "warmed", down: "cooled", axis: "°C above the 1951–1980 average" },
  rainfall: { label: "Rainfall", up: "got wetter", down: "got drier", axis: "Season total rain (mm)" },
  "hot-months": { label: "Very hot months", up: "has more very hot months", down: "has fewer very hot months", axis: "Very hot months per year" },
  "heavy-rain": { label: "Very heavy rain days", up: "has more very heavy rain days", down: "has fewer very heavy rain days", axis: "Very heavy rain days per year" },
  "wettest-day": { label: "Wettest day", up: "has a wetter wettest day", down: "has a less wet wettest day", axis: "Rain on the wettest day (mm)" },
  "dry-spell": { label: "Monsoon dry spell", up: "has longer monsoon dry spells", down: "has shorter monsoon dry spells", axis: "Longest monsoon dry spell (days)" },
};

const WORDS_BN: Record<VariableId, Words> = {
  temperature: { label: "তাপমাত্রা", up: "উষ্ণ হয়েছে", down: "শীতল হয়েছে", axis: "১৯৫১–১৯৮০ সালের গড়ের চেয়ে কত °সে বেশি" },
  rainfall: { label: "বৃষ্টি", up: "বেশি ভেজা হয়েছে", down: "শুষ্ক হয়েছে", axis: "মৌসুমে মোট বৃষ্টি (মিমি)" },
  "hot-months": { label: "অতিরিক্ত গরম মাস", up: "অতিরিক্ত গরম মাস বেড়েছে", down: "অতিরিক্ত গরম মাস কমেছে", axis: "বছরে অতিরিক্ত গরম মাস" },
  "heavy-rain": { label: "অতি ভারী বৃষ্টির দিন", up: "অতি ভারী বৃষ্টির দিন বেড়েছে", down: "অতি ভারী বৃষ্টির দিন কমেছে", axis: "বছরে অতি ভারী বৃষ্টির দিন" },
  "wettest-day": { label: "সবচেয়ে বৃষ্টির দিন", up: "সবচেয়ে বৃষ্টির দিনে বৃষ্টি বেড়েছে", down: "সবচেয়ে বৃষ্টির দিনে বৃষ্টি কমেছে", axis: "সবচেয়ে বৃষ্টির দিনে বৃষ্টি (মিমি)" },
  "dry-spell": { label: "বর্ষায় শুকনো সময়", up: "বর্ষার শুকনো সময় দীর্ঘ হয়েছে", down: "বর্ষার শুকনো সময় ছোট হয়েছে", axis: "বর্ষায় দীর্ঘতম শুকনো সময় (দিন)" },
};

const SEASON_WORDS: Record<SeasonId, { en: string; bn: string; hint: string; hintBn: string }> = {
  annual: { en: "Whole year", bn: "সারা বছর", hint: "Jan–Dec", hintBn: "জানু–ডিসে" },
  "pre-monsoon": { en: "Hot season", bn: "গরমের মৌসুম", hint: "Mar–May", hintBn: "মার্চ–মে" },
  monsoon: { en: "Rainy season", bn: "বর্ষাকাল", hint: "Jun–Sep", hintBn: "জুন–সেপ্টে" },
};

const HAZARD_WORD = {
  flood: ["Flood-prone", "বন্যাপ্রবণ"],
  landslide: ["Landslide-prone", "ভূমিধসপ্রবণ"],
  wildfire: ["Wildfire-prone", "দাবানলপ্রবণ"],
} as const;

interface Loaded {
  key: string;
  stats: TrendGrid;
  series: SeriesGrid;
}

interface Reading {
  kind: "zone" | "point";
  title: string;
  /** How the place reads mid-sentence: "across the whole study area", "in the Indus plain", "around Dhaka". */
  where: string;
  titleBn: string;
  subtitle: string;
  subtitleBn: string;
  values: (number | null)[];
  trend: TrendSummary | null;
  /** Map squares are judged by the map-wide (FDR) test; regions by their own p-value. */
  clear: boolean;
  /** A map square whose own p-value passes but the map-wide check does not. */
  passesAloneOnly: boolean;
  check: { ours: TrendSummary | null; cru: TrendSummary | null } | null;
  /** A clear turning point (p < 0.05) in this region's record, if any. */
  split: { year: number; before: number; after: number; p: number } | null;
}

export default function TrendExplorer({
  manifest,
  zones,
  crosscheck,
  turning,
}: {
  manifest: Manifest;
  zones: Zone[];
  crosscheck: Crosscheck;
  turning: Turning;
}) {
  const lang = useLang();
  const bn = lang === "bn";
  const [variable, setVariable] = useState<VariableId>("temperature");
  const [season, setSeason] = useState<SeasonId>("annual");
  const [selection, setSelection] = useState<Selection>({ kind: "zone", id: "study-area" });
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const meta = manifest.variables[variable];
  const seasons = meta.seasons ?? SEASON_ORDER;
  const activeSeason: SeasonId = seasons.includes(season) ? season : "annual";
  const key = resultKey(variable, activeSeason);
  const years = meta.years ?? manifest.years;
  const grid = manifest.grids[variable];
  const unit = bn ? unitBn(meta.unit) : meta.unit;
  const num = (s: string) => (bn ? bnNum(s) : s);

  // Per-square results and series for the chosen measure. Small files (≤ 150 KB), fetched on demand.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/data/trends/${key}.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch(`/data/trends/${key}_series.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([stats, series]: [TrendGrid, SeriesGrid]) => {
        if (!cancelled) {
          setLoaded({ key, stats, series });
          setFailed(null);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(key);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const stats = loaded?.key === key ? loaded.stats : null;
  const limit = useMemo(() => (stats ? colorLimit(stats.slopePerDecade) : 1), [stats]);
  const summary = manifest.summaries[key];

  const selectedCell = selection.kind === "point" ? cellAt(grid, selection.lat, selection.lon) : null;
  const selectedZone = selection.kind === "zone" ? selection.id : null;

  const reading: Reading | null = useMemo(() => {
    if (selection.kind === "zone") {
      const zone = zones.find((z) => z.id === selection.id);
      const result = zone?.results[key];
      if (!zone || !result) return null;
      const hazard = zone.hazard ? HAZARD_WORD[zone.hazard] : null;
      return {
        kind: "zone",
        title: zone.name,
        where: zone.id === "study-area" ? "across the whole study area" : `in the ${zone.name}`,
        titleBn: ZONE_BN[zone.id]?.name ?? zone.name,
        subtitle: hazard ? `${hazard[0]} region · average of its land squares` : "Average of every land square on the map",
        subtitleBn: hazard ? `${hazard[1]} অঞ্চল · এর স্থলভাগের বর্গগুলোর গড়` : "মানচিত্রের সব স্থলবর্গের গড়",
        values: result.series,
        trend: result.trend,
        clear: !!result.trend && result.trend.p < ALPHA,
        passesAloneOnly: false,
        check: crosscheck.zones[zone.id]?.[key] ?? null,
        split: (() => {
          const t = turning[zone.id]?.[key];
          return t && t.p < ALPHA ? t : null;
        })(),
      };
    }
    if (!stats || !loaded || !selectedCell) return null;
    const k = selectedCell.i * grid.nLon + selectedCell.j;
    const slope = stats.slopePerDecade[k];
    const p = stats.p[k];
    const values = loaded.series[k];
    if (slope === null || p === null || !values) return null;
    const { lat, lon } = cellCenter(grid, selectedCell.i, selectedCell.j);
    const near = nearestPlace(lat, lon);
    const coords = `${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E`;
    const placeBn = near ? (PLACE_BN[near.place.id] ?? near.place.name) : "";
    const clear = stats.significant[k] === 1;
    return {
      kind: "point",
      title: near ? `${near.close ? "Around" : "Near"} ${near.place.name}` : `Square at ${coords}`,
      where: near ? `${near.close ? "around" : "near"} ${near.place.name}` : `in the square at ${coords}`,
      titleBn: near ? `${placeBn}-এর ${near.close ? "আশেপাশে" : "কাছে"}` : `${bnNum(coords)}-এর বর্গ`,
      subtitle: `Map square centred on ${coords} (${grid.dLat}° × ${grid.dLon}°)`,
      subtitleBn: `${bnNum(coords)} কেন্দ্রিক মানচিত্র-বর্গ (${bnNum(grid.dLat)}° × ${bnNum(grid.dLon)}°)`,
      values,
      trend: {
        slopePerDecade: slope,
        lowerPerDecade: stats.lowerPerDecade[k] ?? slope,
        upperPerDecade: stats.upperPerDecade[k] ?? slope,
        p,
      },
      clear,
      passesAloneOnly: !clear && p < ALPHA,
      check: null,
      split: null,
    };
  }, [selection, zones, key, crosscheck, turning, stats, loaded, selectedCell, grid]);

  const onSelectCell = (lat: number, lon: number) => setSelection({ kind: "point", lat, lon });

  const download = () => {
    if (!stats) return;
    const rows: (string | number | null)[][] = [];
    stats.slopePerDecade.forEach((s, k) => {
      if (s === null) return;
      const { lat, lon } = cellCenter(grid, Math.floor(k / grid.nLon), k % grid.nLon);
      rows.push([lat, lon, s, stats.lowerPerDecade[k], stats.upperPerDecade[k], stats.p[k], stats.significant[k]]);
    });
    downloadCsv(
      `trend-map-${slug(key)}.csv`,
      ["lat", "lon", `slope_${meta.unit}_per_decade`, "lower95", "upper95", "p", "significant_fdr"],
      rows,
      `${meta.label}, ${manifest.seasons[activeSeason].label}, ${years[0]}–${years[years.length - 1]}. ${meta.dataset}. ${manifest.method.test}; ${manifest.method.slope}; ${manifest.method.multipleTesting}.`,
    );
  };

  return (
    <div>
      {/* ── Controls ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <fieldset>
          <legend className="text-xs font-medium text-ink-3">
            <T en="What to look at" bn="কী দেখবেন" />
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {VARIABLE_ORDER.map((v) => {
              const active = v === variable;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setVariable(v)}
                  className={`${CONTROL.button} ${CONTROL.transition} ${CONTROL.focusRing} rounded-full border px-3.5 text-sm font-medium ${
                    active ? "border-transparent bg-accent-strong text-accent-ink" : "border-line bg-card text-ink-2 hover:text-ink"
                  }`}
                >
                  {bn ? WORDS_BN[v].label : WORDS[v].label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-xs font-medium text-ink-3">
            <T en="Time of year" bn="বছরের কোন সময়" />
          </legend>
          <div className="mt-1.5 inline-flex rounded-full border border-line bg-card p-1">
            {SEASON_ORDER.map((s) => {
              const available = seasons.includes(s);
              const active = s === activeSeason;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!available}
                  aria-pressed={active}
                  onClick={() => setSeason(s)}
                  title={available ? undefined : bn ? "এই পরিমাপ শুধু সারা বছরের জন্য" : "This measure is whole-year only"}
                  className={`${CONTROL.segment} ${CONTROL.transition} ${CONTROL.focusRing} rounded-full px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                    active ? "bg-accent-strong text-accent-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {bn ? SEASON_WORDS[s].bn : SEASON_WORDS[s].en}
                  <span className="ml-1 hidden text-xs opacity-75 sm:inline">({bn ? SEASON_WORDS[s].hintBn : SEASON_WORDS[s].hint})</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {meta.definition && (
        <p className="mt-3 text-sm text-ink-3">
          <T en={meta.definition} bn={DEFINITION_BN[variable] ?? meta.definition} />
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* ── Map ── */}
        <div className="min-w-0">
          <div className="relative isolate h-[380px] overflow-hidden rounded-2xl border border-line bg-sunken sm:h-[480px] lg:h-[560px]">
            <TrendMap
              grid={grid}
              stats={stats}
              variable={variable}
              meta={meta}
              limit={limit}
              zones={zones}
              selectedZone={selectedZone}
              selectedCell={selectedCell}
              onSelectCell={onSelectCell}
            />
            {failed === key && (
              <p role="alert" className="absolute inset-x-4 top-4 z-[500] rounded-lg bg-card px-3 py-2 text-sm text-ink shadow-soft">
                <T en="The trend map could not be loaded. Try reloading the page." bn="প্রবণতার মানচিত্র লোড করা যায়নি। পাতাটি আবার লোড করুন।" />
              </p>
            )}
          </div>

          {/* Colour key: words at both ends, the numeric limit, and what faded squares mean. */}
          <div className="mt-3 text-xs text-ink-2">
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-right sm:w-36">{bn ? WORDS_BN[variable].down : WORDS[variable].down}</span>
              <span aria-hidden className="flex h-3 flex-1 overflow-hidden rounded-full border border-line">
                {trendLegendTokens(variable).map((tok) => (
                  <span key={tok} className="flex-1" style={{ background: `var(${tok})` }} />
                ))}
              </span>
              <span className="w-28 shrink-0 sm:w-36">{bn ? WORDS_BN[variable].up : WORDS[variable].up}</span>
            </div>
            <p className="mt-1 text-center tabular-nums text-ink-3">
              {num(formatSigned(-limit, meta.decimals + 1))} … 0 … {num(formatSigned(limit, meta.decimals + 1))} {unit}{" "}
              <T en="per 10 years" bn="প্রতি ১০ বছরে" />
            </p>
            <p className="mt-2 text-ink-3">
              <T
                en="Solid squares: a clear change that passes the map-wide significance check. Faded squares: no clear change. Dashed boxes are the hazard regions. Click any square or pick a region."
                bn="গাঢ় বর্গ: স্পষ্ট পরিবর্তন, যা পুরো মানচিত্রের তাৎপর্য-পরীক্ষায় উত্তীর্ণ। হালকা বর্গ: স্পষ্ট পরিবর্তন নেই। ড্যাশ-রেখার বাক্স হলো দুর্যোগ অঞ্চল। যেকোনো বর্গে ক্লিক করুন বা একটি অঞ্চল বেছে নিন।"
              />
            </p>
            {summary && (
              <p className="mt-2 rounded-lg border border-line bg-card px-3 py-2 text-ink-2">
                <T
                  en={`Across ${summary.cells} land squares: ${summary.significantIncrease} show a clear ${meta.increase}, ${summary.significantDecrease} a clear ${meta.decrease}, and ${summary.cells - summary.significantIncrease - summary.significantDecrease} no clear change.`}
                  bn={`${bnNum(summary.cells)}টি স্থলবর্গের মধ্যে: ${bnNum(summary.significantIncrease)}টিতে স্পষ্ট বৃদ্ধি, ${bnNum(summary.significantDecrease)}টিতে স্পষ্ট হ্রাস, আর ${bnNum(summary.cells - summary.significantIncrease - summary.significantDecrease)}টিতে স্পষ্ট পরিবর্তন নেই।`}
                />{" "}
                <button type="button" onClick={download} disabled={!stats} className="font-medium text-accent underline-offset-2 hover:underline disabled:opacity-50">
                  <T en="Download this map (CSV)" bn="এই মানচিত্র ডাউনলোড (CSV)" />
                </button>
              </p>
            )}
          </div>
        </div>

        {/* ── Reading for the selected region or square ── */}
        <aside aria-live="polite" className="min-w-0 rounded-2xl border border-line bg-card p-5 shadow-soft">
          <label className="text-xs font-medium text-ink-3" htmlFor="trend-region">
            <T en="Region" bn="অঞ্চল" />
          </label>
          <select
            id="trend-region"
            value={selectedZone ?? ""}
            onChange={(e) => setSelection({ kind: "zone", id: e.target.value })}
            className={`${CONTROL.button} ${CONTROL.focusRing} mt-1 w-full rounded-lg border border-line bg-page px-3 text-sm text-ink`}
          >
            {selectedZone === null && <option value="">{bn ? "মানচিত্রের বর্গ (নিচে)" : "Map square (below)"}</option>}
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {bn ? (ZONE_BN[z.id]?.name ?? z.name) : z.name}
              </option>
            ))}
          </select>

          {!reading ? (
            <p className="mt-6 text-sm text-ink-3">
              {selection.kind === "point" && stats ? (
                <T en="No land data in this square. Pick a coloured square." bn="এই বর্গে স্থলভাগের তথ্য নেই। একটি রঙিন বর্গ বেছে নিন।" />
              ) : (
                <T en="Loading…" bn="লোড হচ্ছে…" />
              )}
            </p>
          ) : (
            <ReadingPanel reading={reading} variable={variable} season={activeSeason} manifest={manifest} years={years} />
          )}
        </aside>
      </div>
    </div>
  );
}

function ReadingPanel({
  reading,
  variable,
  season,
  manifest,
  years,
}: {
  reading: Reading;
  variable: VariableId;
  season: SeasonId;
  manifest: Manifest;
  years: number[];
}) {
  const bn = useLang() === "bn";
  const meta = manifest.variables[variable];
  const words = bn ? WORDS_BN[variable] : WORDS[variable];
  const unit = bn ? unitBn(meta.unit) : meta.unit;
  const num = (s: string) => (bn ? bnNum(s) : s);
  const d = meta.decimals + 1;
  const tr = reading.trend;
  const first = years[0];
  const last = years[years.length - 1];
  const seasonName = bn ? SEASON_WORDS[season].bn : SEASON_WORDS[season].en;

  let verdict: { en: string; bn: string; tone: string };
  if (!tr) verdict = { en: "Not enough data", bn: "যথেষ্ট তথ্য নেই", tone: "bg-sunken text-ink-2" };
  else if (!reading.clear) verdict = { en: "No clear trend", bn: "স্পষ্ট প্রবণতা নেই", tone: "bg-sunken text-ink-2" };
  else if (tr.slopePerDecade > 0) verdict = { en: "Clear increase", bn: "স্পষ্ট বৃদ্ধি", tone: "bg-accent-soft text-accent" };
  else verdict = { en: "Clear decrease", bn: "স্পষ্ট হ্রাস", tone: "bg-accent-soft text-accent" };

  const total = tr ? (tr.slopePerDecade / 10) * (last - first) : 0;
  const place = bn ? reading.titleBn : reading.title;
  const seasonEn = season === "annual" ? "" : season === "monsoon" ? " in the rainy season" : " in the hot season";
  const seasonBn = season === "annual" ? "" : `${seasonName}-এ `;
  // Singular subjects, so "… has risen" reads correctly for every measure.
  const measureEn = {
    temperature: "Temperature",
    rainfall: "Rainfall",
    "hot-months": "The number of very hot months",
    "heavy-rain": "The number of very heavy rain days",
    "wettest-day": "Rain on the wettest day",
    "dry-spell": "The longest monsoon dry spell",
  }[variable];

  let story: string;
  if (!tr) {
    story = bn ? "এখানে প্রবণতা নির্ণয়ের মতো যথেষ্ট বছর নেই।" : "There are not enough years here to test for a trend.";
  } else if (reading.clear) {
    const rising = tr.slopePerDecade > 0;
    const dir = rising ? words.up : words.down;
    story = bn
      ? `${bnNum(first)} থেকে ${place}-এ ${seasonBn}${words.label} প্রতি ১০ বছরে ${bnNum(Math.abs(tr.slopePerDecade).toFixed(d))} ${unit} ${rising ? "বেড়েছে" : "কমেছে"} (${dir}), ${bnNum(last - first)} বছরে মোট প্রায় ${bnNum(Math.abs(total).toFixed(meta.decimals))} ${unit}। এমন স্থির পরিবর্তন কাকতালীয়ভাবে খুব কমই দেখা যায় (${bnNum(formatP(tr.p))})।`
      : `${measureEn}${seasonEn} ${reading.where} has ${rising ? "risen" : "fallen"} by ${Math.abs(tr.slopePerDecade).toFixed(d)} ${unit} every 10 years since ${first}, about ${Math.abs(total).toFixed(meta.decimals)} ${unit} over ${last - first} years. A change this steady would very rarely appear by chance (${formatP(tr.p)}).`;
  } else {
    story = bn
      ? `${place}-এ ${seasonBn}${words.label} নিয়ে স্পষ্ট প্রবণতা নেই। হিসাবটি প্রতি ১০ বছরে ${bnNum(formatSigned(tr.slopePerDecade, d))} ${unit}, কিন্তু বছর-বছর ওঠানামা এত বড় যে এটি কাকতালীয়ও হতে পারে (${bnNum(formatP(tr.p))})। "প্রবণতা নেই" বলাটাও একটি ফলাফল।`
      : `No clear trend in ${measureEn.toLowerCase()}${seasonEn} ${reading.where}. The best estimate is ${formatSigned(tr.slopePerDecade, d)} ${unit} every 10 years, but year-to-year swings are large enough that this could be chance (${formatP(tr.p)}). "No clear trend" is a result too.`;
  }

  const agree = reading.check?.ours && reading.check.cru ? agreement(reading.check.ours, reading.check.cru) : null;

  return (
    <div className="mt-5">
      <h3 className="text-xl font-semibold tracking-tight text-ink">{place}</h3>
      <p className="mt-0.5 text-xs text-ink-3">{bn ? reading.subtitleBn : reading.subtitle}</p>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${verdict.tone}`}>
          <T en={verdict.en} bn={verdict.bn} />
        </span>
        {tr && (
          <span className="text-2xl font-semibold tabular-nums text-ink">
            {num(formatSigned(tr.slopePerDecade, d))} <span className="text-base font-medium text-ink-2">{unit}</span>
            <span className="ml-1 text-sm font-normal text-ink-3">
              <T en="/ 10 years" bn="/ ১০ বছর" />
            </span>
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-2">{story}</p>
      {reading.passesAloneOnly && (
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          <T
            en="This square passes the test on its own, but not the stricter map-wide check that guards against false alarms when hundreds of squares are tested at once, so we don't call it clear."
            bn="এই বর্গটি নিজে পরীক্ষায় উত্তীর্ণ, কিন্তু শত শত বর্গ একসাথে পরীক্ষা করলে ভুল সংকেত ঠেকাতে যে কঠোর পরীক্ষা লাগে তাতে নয়, তাই আমরা একে স্পষ্ট বলি না।"
          />
        </p>
      )}

      <div className="mt-4">
        <SeriesChart
          years={years}
          values={reading.values}
          slopePerDecade={tr?.slopePerDecade ?? null}
          lowerPerDecade={tr?.lowerPerDecade ?? null}
          upperPerDecade={tr?.upperPerDecade ?? null}
          unit={meta.unit}
          decimals={meta.decimals}
          axisLabel={WORDS[variable].axis}
          axisLabelBn={WORDS_BN[variable].axis}
          zeroLine={meta.anomaly}
          title={`${reading.title} ${meta.label}, ${manifest.seasons[season].label}`}
          split={reading.split}
        />
      </div>

      {reading.split && (
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">
            <T en="Turning point: " bn="মোড় পরিবর্তন: " />
          </span>
          <T
            en={`the record splits most sharply around ${reading.split.year}. Average ${reading.split.before.toFixed(meta.decimals)} ${meta.unit} before, ${reading.split.after.toFixed(meta.decimals)} ${meta.unit} from then on (Pettitt test, ${formatP(reading.split.p)}). A steady trend also splits near its middle, so this says when the record is most different, not that the change switched on that year.`}
            bn={`রেকর্ডটি সবচেয়ে স্পষ্টভাবে ভাগ হয় ${bnNum(reading.split.year)}-এর কাছে। আগে গড় ${bnNum(reading.split.before.toFixed(meta.decimals))} ${unit}, তারপর থেকে ${bnNum(reading.split.after.toFixed(meta.decimals))} ${unit} (পেটিট পরীক্ষা, ${bnNum(formatP(reading.split.p))})। স্থির প্রবণতাও মাঝামাঝি ভাগ হয়, তাই এটি বলে রেকর্ড কখন সবচেয়ে আলাদা, পরিবর্তন ঠিক সেই বছরে শুরু হয়েছে তা নয়।`}
          />
        </p>
      )}

      {agree && (
        <p className="mt-3 rounded-lg border border-line px-3 py-2 text-xs leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">{bn ? AGREEMENT_BN[agree] : AGREEMENT_TEXT[agree]}</span>
          {" · "}
          <T
            en={`CRU TS (University of East Anglia), built from weather stations: ${formatSigned(reading.check!.cru!.slopePerDecade, d)} ${meta.unit} / 10 years, ${formatP(reading.check!.cru!.p)}.`}
            bn={`CRU TS (ইউনিভার্সিটি অব ইস্ট অ্যাংলিয়া), আবহাওয়া কেন্দ্রের তথ্য থেকে: প্রতি ১০ বছরে ${bnNum(formatSigned(reading.check!.cru!.slopePerDecade, d))} ${unit}, ${bnNum(formatP(reading.check!.cru!.p))}।`}
          />
        </p>
      )}

      <details className="group mt-4 rounded-lg border border-line">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-ink">
          <T en="Show the numbers" bn="সংখ্যাগুলো দেখুন" />
        </summary>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-line px-3 py-3 text-xs">
          {tr && (
            <>
              <dt className="text-ink-3">Sen&apos;s slope</dt>
              <dd className="tabular-nums text-ink">
                {formatSigned(tr.slopePerDecade, d)} {meta.unit} / decade
              </dd>
              <dt className="text-ink-3">95% CI</dt>
              <dd className="tabular-nums text-ink">
                {formatSigned(tr.lowerPerDecade, d)} to {formatSigned(tr.upperPerDecade, d)}
              </dd>
              <dt className="text-ink-3">Mann–Kendall</dt>
              <dd className="tabular-nums text-ink">
                {formatP(tr.p)} {reading.clear ? "(significant)" : "(not significant)"}
              </dd>
            </>
          )}
          <dt className="text-ink-3">Test</dt>
          <dd className="text-ink">{manifest.method.test}</dd>
          {reading.kind === "point" && (
            <>
              <dt className="text-ink-3">Map-wide</dt>
              <dd className="text-ink">{manifest.method.multipleTesting}</dd>
            </>
          )}
          <dt className="text-ink-3">Period</dt>
          <dd className="tabular-nums text-ink">
            {first}–{last} ({years.length} years)
          </dd>
          <dt className="text-ink-3">Data</dt>
          <dd className="text-ink">
            <a href={meta.datasetUrl} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
              {meta.dataset}
            </a>
          </dd>
        </dl>
      </details>
    </div>
  );
}
