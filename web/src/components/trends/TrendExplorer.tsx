"use client";

import { CaretDown, CloudRain, HandPointing, Minus, TrendDown, TrendUp, Thermometer } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Numbers, Segmented, Stat, Sureness, TrendLegend } from "@/components/ui";
import { QuickGuide } from "@/components/ui/QuickGuide";
import { describePlace } from "@/lib/places";
import { SEASON_PLAIN, sureness } from "@/lib/plain";
import {
  ALPHA,
  cellAt,
  cellCenter,
  colorLimit,
  formatP,
  formatSigned,
  resultKey,
  SEASON_ORDER,
  VARIABLE_ORDER,
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
  loading: () => <div className="grid h-full place-items-center bg-sunken text-sm text-ink-3">Loading map…</div>,
});

type Selection = { kind: "zone"; id: string } | { kind: "point"; lat: number; lon: number };

const HAZARD_WORD = { flood: "Flood-prone", landslide: "Landslide-prone", wildfire: "Wildfire-prone" } as const;

const WORDS: Record<VariableId, { up: string; down: string; less: string; more: string; label: string }> = {
  temperature: { up: "Getting warmer", down: "Getting cooler", less: "Cooling", more: "Warming", label: "Temperature" },
  rainfall: { up: "Getting wetter", down: "Getting drier", less: "Drier", more: "Wetter", label: "Rain" },
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

export default function TrendExplorer({ manifest, zones }: { manifest: Manifest; zones: Zone[] }) {
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

  const key = resultKey(variable, season);
  const meta = manifest.variables[variable];
  const grid = manifest.grids[variable];
  const summary = manifest.summaries[key];
  const currentStats = stats?.key === key ? stats.data : null;
  const words = WORDS[variable];

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
    const q = new URLSearchParams({ var: variable, season });
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
  }, [variable, season, selection]);

  const limit = useMemo(() => (currentStats ? colorLimit(currentStats.slopePerDecade) : 1), [currentStats]);

  const cell = selection.kind === "point" ? cellAt(grid, selection.lat, selection.lon) : null;
  const cellIndex = cell ? cell.i * grid.nLon + cell.j : null;
  const zone = selection.kind === "zone" ? zones.find((z) => z.id === selection.id)! : null;

  // What the answer panel shows for the current selection.
  const detail = useMemo((): Detail | null => {
    if (zone) {
      const r = zone.results[key];
      return {
        title: zone.id === "study-area" ? "All of South Asia" : zone.name,
        subtitle: zone.id === "study-area" ? "The average of every land square on the map." : zone.description,
        values: r.series,
        trend: r.trend,
        mean: r.mean,
        clear: null,
      };
    }
    if (cellIndex === null || !cell) return null;
    const { lat, lon } = cellCenter(grid, cell.i, cell.j);
    const title = describePlace(lat, lon);
    const subtitle = `One map square, about ${Math.round(grid.dLat * 111)} km across (${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E).`;
    if (!currentStats || currentStats.slopePerDecade[cellIndex] === null) {
      return { title, subtitle, values: null, trend: null, mean: null, clear: null, sea: !!currentStats };
    }
    const trend: TrendSummary = {
      slopePerDecade: currentStats.slopePerDecade[cellIndex]!,
      lowerPerDecade: currentStats.lowerPerDecade[cellIndex]!,
      upperPerDecade: currentStats.upperPerDecade[cellIndex]!,
      p: currentStats.p[cellIndex]!,
    };
    return {
      title,
      subtitle,
      values: series?.key === key ? series.data[cellIndex] : null,
      trend,
      mean: currentStats.mean[cellIndex],
      clear: currentStats.significant[cellIndex] === 1,
    };
  }, [zone, key, cellIndex, cell, grid, currentStats, series]);

  const years = manifest.years;
  const up = summary.significantIncrease;
  const down = summary.significantDecrease;

  return (
    <div className="relative flex h-full flex-col lg:block">
      <div className="relative h-[52vh] min-h-[320px] lg:absolute lg:inset-0 lg:h-auto">
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
        <div className="pointer-events-none absolute left-[58px] top-3 z-[500] flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm text-ink-2 shadow-soft">
          <HandPointing size={18} className="text-accent" />
          Click any square to see its story
        </div>
        <QuickGuide
          id="trends"
          title="How to use Climate trends"
          steps={[
            "Choose temperature or rain, and a time of year.",
            "Pick a region from the list, or click any square on the map.",
            "Read the answer: is it really changing, how fast, and how sure we are.",
          ]}
          buttonClassName="absolute left-[58px] top-[60px]"
          cardClassName="absolute left-[58px] top-[108px]"
        />
        <div className="absolute bottom-8 left-3 z-[500] w-[min(320px,calc(100%-6rem))] rounded-2xl bg-card p-3 shadow-soft sm:bottom-10 sm:p-4">
          <div className="mb-2 text-sm font-medium text-ink">
            Change every 10 years ({meta.unit})
          </div>
          <TrendLegend
            variable={variable}
            limit={limit}
            decimals={meta.decimals}
            decreaseWord={words.less}
            increaseWord={words.more}
            mobileCompact
          />
        </div>
        {error && (
          <div className="absolute inset-x-3 top-16 z-[500] rounded-xl bg-card px-4 py-3 text-sm text-ink shadow-soft">
            Couldn&apos;t load the results. Please refresh the page.
          </div>
        )}
      </div>

      <aside
        aria-label="Trend details"
        className="z-[600] flex flex-col gap-5 bg-card p-5 lg:absolute lg:bottom-4 lg:right-4 lg:top-4 lg:w-[400px] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-line lg:shadow-soft"
      >
        <section className="space-y-3">
          <h1 className="text-lg font-semibold text-ink">How is the climate changing?</h1>
          <Step n={1} label="What to look at">
            <Segmented
              label="What to look at"
              value={variable}
              onChange={setVariable}
              options={[
                { id: "temperature", label: "Temperature", icon: <Thermometer size={16} /> },
                { id: "rainfall", label: "Rain", icon: <CloudRain size={16} /> },
              ]}
            />
          </Step>
          <Step n={2} label="Which time of year">
            <Segmented
              label="Which time of year"
              value={season}
              onChange={setSeason}
              options={SEASON_ORDER.map((s) => ({ id: s, label: SEASON_PLAIN[s].label }))}
            />
            <p className="mt-1.5 text-xs text-ink-3">{SEASON_PLAIN[season].hint}</p>
          </Step>
          <Step n={3} label="Which place">
            <label className="relative block">
              <span className="sr-only">Choose a region</span>
              <select
                value={selection.kind === "zone" ? selection.id : ""}
                onChange={(e) => setSelection({ kind: "zone", id: e.target.value })}
                className="w-full appearance-none rounded-xl border border-line bg-card py-2.5 pl-3.5 pr-10 text-sm text-ink"
              >
                {selection.kind === "point" && <option value="">{detail?.title ?? "A map square"} (clicked)</option>}
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.id === "study-area" ? "All of South Asia" : `${z.name}${z.hazard ? ` · ${HAZARD_WORD[z.hazard]}` : ""}`}
                  </option>
                ))}
              </select>
              <CaretDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            </label>
            <p className="mt-1.5 text-xs text-ink-3">Or click any square on the map.</p>
          </Step>
        </section>

        <div className="h-px bg-line" />

        {detail ? (
          <Answer detail={detail} meta={meta} years={years} words={words} seasonLabel={SEASON_PLAIN[season].label} />
        ) : (
          <p className="text-sm text-ink-3">Pick a place to see its story.</p>
        )}

        <p className="rounded-xl bg-sunken p-3.5 text-sm leading-relaxed text-ink-2">
          Across the whole map, {up} of {summary.cells} squares show a clear rise
          {down > 0 ? ` and ${down} a clear fall` : " and none a clear fall"}.
          {summary.cells - up - down > 0 && ` The other ${summary.cells - up - down} show no clear change.`}
        </p>
      </aside>
    </div>
  );
}

interface Detail {
  title: string;
  subtitle: string;
  values: (number | null)[] | null;
  trend: TrendSummary | null;
  mean: number | null;
  /** Passed the map-wide check (single squares only). */
  clear: boolean | null;
  sea?: boolean;
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
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
  seasonLabel,
}: {
  detail: Detail;
  meta: VariableMeta;
  years: number[];
  words: (typeof WORDS)[VariableId];
  seasonLabel: string;
}) {
  const { trend } = detail;
  const [first, last] = [years[0], years[years.length - 1]];
  const real = trend ? trend.p < ALPHA : false;
  const upward = trend ? trend.slopePerDecade > 0 : false;
  // Headline numbers are rounded for reading; "Show the numbers" keeps one more digit.
  const d = meta.decimals;
  const dd = meta.decimals + 1;
  const total = trend ? (trend.slopePerDecade * (last - first)) / 10 : 0;
  const pct = trend && !meta.anomaly && detail.mean ? (trend.slopePerDecade / detail.mean) * 100 : null;
  const Arrow = !real ? Minus : upward ? TrendUp : TrendDown;

  return (
    <section className="space-y-4" aria-live="polite">
      <div>
        <h2 className="text-xl font-semibold text-ink">{detail.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{detail.subtitle}</p>
      </div>

      {detail.sea && <p className="text-sm text-ink-2">This square is mostly sea, so we don&apos;t analyse it. Try a land square.</p>}

      {trend && (
        <div className="rounded-2xl bg-sunken p-4">
          <div className="flex items-center gap-2 text-base font-semibold text-ink">
            <Arrow size={22} weight="bold" className={real ? "text-accent" : "text-ink-3"} />
            {real ? (upward ? words.up : words.down) : "No clear change"}
          </div>
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink">
            {formatSigned(trend.slopePerDecade, d)} {meta.unit}
          </div>
          <div className="text-sm text-ink-2">
            every 10 years
            {pct !== null && ` (${formatSigned(pct, 1)}% of the usual amount)`}
          </div>
          {real && (
            <p className="mt-2 text-sm text-ink-2">
              That adds up to about <strong className="font-semibold text-ink">{formatSigned(total, meta.decimals)} {meta.unit}</strong>{" "}
              since {first}.
            </p>
          )}
          <div className="mt-3">
            <Sureness p={trend.p} />
          </div>
          {!real && (
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              The ups and downs from year to year are bigger than any steady change, so we can&apos;t say it is really
              changing. That doesn&apos;t prove nothing is happening; the record just can&apos;t show it clearly.
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
          axisLabel={meta.anomaly ? `°C warmer than the 1951–1980 average` : `${meta.unit} of rain in the season`}
          zeroLine={meta.anomaly}
          lowerPerDecade={trend?.lowerPerDecade ?? null}
          upperPerDecade={trend?.upperPerDecade ?? null}
          title={`${detail.title} ${words.label.toLowerCase()} ${seasonLabel.toLowerCase()}`}
        />
      ) : (
        trend && <div className="h-56 animate-pulse rounded-xl bg-sunken" aria-label="Loading chart" />
      )}

      {trend && (
        <Numbers>
          <dl>
            <Stat label="Rate (Sen's slope)" value={`${formatSigned(trend.slopePerDecade, dd)} ${meta.unit}/decade`} />
            <Stat label="95% range of the rate" value={`${formatSigned(trend.lowerPerDecade, dd)} to ${formatSigned(trend.upperPerDecade, dd)}`} />
            <Stat label="p-value (Mann–Kendall, autocorrelation-corrected)" value={formatP(trend.p)} />
            <Stat label="How sure" value={sureness(trend.p).short} />
            {detail.clear !== null && <Stat label="Passes the map-wide check (FDR)" value={detail.clear ? "Yes" : "No"} />}
            {!meta.anomaly && detail.mean !== null && <Stat label="Average" value={`${detail.mean.toFixed(meta.decimals)} ${meta.unit}`} />}
            <Stat label="Data" value={meta.dataset} />
          </dl>
        </Numbers>
      )}
    </section>
  );
}
