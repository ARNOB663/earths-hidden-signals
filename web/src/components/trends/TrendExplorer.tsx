"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ALPHA,
  cellAt,
  cellCenter,
  colorLimit,
  divergingGradient,
  formatP,
  formatSigned,
  resultKey,
  SEASON_ORDER,
  VARIABLE_ORDER,
  verdict,
  type Manifest,
  type SeasonId,
  type SeriesGrid,
  type TrendGrid,
  type TrendSummary,
  type VariableId,
  type Zone,
} from "@/lib/trends";
import { SeriesChart } from "./SeriesChart";

const TrendMap = dynamic(() => import("./TrendMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-500">Loading map…</div>,
});

type Selection = { kind: "zone"; id: string } | { kind: "point"; lat: number; lon: number };

const HAZARD_LABEL = { flood: "Flood", landslide: "Landslide", wildfire: "Wildfire" } as const;

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

  useEffect(() => {
    let alive = true;
    fetchJson<TrendGrid>(`/data/trends/${key}.json`)
      .then((data) => alive && setStats({ key, data }))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [key]);

  // Cell time series are only needed once someone clicks a cell.
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

  // What the detail panel shows for the current selection.
  const detail = useMemo(() => {
    if (zone) {
      const r = zone.results[key];
      return { title: zone.name, subtitle: zone.description, values: r.series, trend: r.trend, mean: r.mean, fdr: null };
    }
    if (cellIndex === null || !cell) return null;
    const { lat, lon } = cellCenter(grid, cell.i, cell.j);
    const title = `Grid cell ${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
    const subtitle = `${grid.dLat}° × ${grid.dLon}° cell (about ${Math.round(grid.dLat * 111)} km across).`;
    if (!currentStats || currentStats.slopePerDecade[cellIndex] === null) {
      return { title, subtitle, values: null, trend: null, mean: null, fdr: null, sea: !!currentStats };
    }
    const trend: TrendSummary = {
      slopePerDecade: currentStats.slopePerDecade[cellIndex]!,
      lowerPerDecade: currentStats.lowerPerDecade[cellIndex]!,
      upperPerDecade: currentStats.upperPerDecade[cellIndex]!,
      p: currentStats.p[cellIndex]!,
    };
    const values = series?.key === key ? series.data[cellIndex] : null;
    return {
      title,
      subtitle,
      values,
      trend,
      mean: currentStats.mean[cellIndex],
      fdr: currentStats.significant[cellIndex] === 1,
    };
  }, [zone, key, cellIndex, cell, grid, currentStats, series]);

  const years = manifest.years;
  const unitPerDecade = `${meta.unit} per decade`;
  const nYears = years.length - 1;
  const pct = (v: number) => (summary.cells ? Math.round((v / summary.cells) * 100) : 0);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Controls */}
      <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-b border-white/10 bg-[#0e141b] p-4 lg:w-[300px] lg:border-b-0 lg:border-r">
        <section>
          <Heading>Variable</Heading>
          <Segmented
            options={VARIABLE_ORDER.map((v) => ({ id: v, label: manifest.variables[v].label }))}
            value={variable}
            onChange={(v) => setVariable(v as VariableId)}
          />
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            <a href={meta.datasetUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
              {meta.dataset}
            </a>
            , {years[0]}–{years[years.length - 1]}
          </p>
        </section>

        <section>
          <Heading>Season</Heading>
          <Segmented
            options={SEASON_ORDER.map((s) => ({ id: s, label: manifest.seasons[s].label.replace(/ \(.*\)/, "") }))}
            value={season}
            onChange={(s) => setSeason(s as SeasonId)}
          />
          <p className="mt-2 text-xs text-slate-500">{manifest.seasons[season].label}</p>
        </section>

        <section>
          <Heading>Trend per decade</Heading>
          <div className="h-3 rounded-sm ring-1 ring-white/10" style={{ background: divergingGradient(variable) }} />
          <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-400">
            <span>{formatSigned(-limit, meta.decimals + 1)}</span>
            <span>0</span>
            <span>{formatSigned(limit, meta.decimals + 1)}</span>
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>{meta.decrease}</span>
            <span>{meta.unit}</span>
            <span>{meta.increase}</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-400">
            <li className="flex items-center gap-2">
              <span className="relative h-3 w-5 rounded-sm bg-slate-400/80">
                <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
              </span>
              Solid with dot: significant after the map-wide check
            </li>
            <li className="flex items-center gap-2">
              <span className="h-3 w-5 rounded-sm bg-slate-400/25" />
              Faded: not significant
            </li>
          </ul>
        </section>

        <section className="rounded-md bg-white/[0.03] p-3 ring-1 ring-white/10">
          <Heading>Across all {summary.cells} land cells</Heading>
          <dl className="space-y-1 text-sm">
            <Row label={`Significant ${meta.increase}`} value={`${summary.significantIncrease} (${pct(summary.significantIncrease)}%)`} />
            <Row label={`Significant ${meta.decrease}`} value={`${summary.significantDecrease} (${pct(summary.significantDecrease)}%)`} />
            <Row
              label="No detectable trend"
              value={`${summary.cells - summary.significantIncrease - summary.significantDecrease} (${pct(
                summary.cells - summary.significantIncrease - summary.significantDecrease,
              )}%)`}
            />
            <Row label="Median trend" value={`${formatSigned(summary.medianSlopePerDecade, meta.decimals + 1)} ${meta.unit}`} />
          </dl>
        </section>

        <section>
          <Heading>Regions</Heading>
          <div className="space-y-1">
            {zones.map((z) => {
              const active = selection.kind === "zone" && selection.id === z.id;
              const t = z.results[key].trend;
              return (
                <button
                  key={z.id}
                  onClick={() => setSelection({ kind: "zone", id: z.id })}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    active ? "bg-sky-500/15 text-white ring-1 ring-sky-400/50" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{z.name}</span>
                    {z.hazard && <span className="text-[11px] text-slate-500">{HAZARD_LABEL[z.hazard]} zone</span>}
                  </span>
                  {t && (
                    <span className={`shrink-0 font-mono text-xs ${t.p < ALPHA ? "text-slate-200" : "text-slate-500"}`}>
                      {formatSigned(t.slopePerDecade, meta.decimals + 1)}
                      {t.p < ALPHA ? "" : " ns"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Per-decade trend of the region&apos;s average; &quot;ns&quot; = not significant. Or click any cell on the map.
          </p>
        </section>
      </aside>

      {/* Map */}
      <div className="relative h-[55vh] min-h-[320px] flex-1 lg:h-auto">
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
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-md bg-[#0b0f14]/85 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
          <div className="text-sm font-medium text-white">
            {meta.label} trend · {manifest.seasons[season].label}
          </div>
          <div className="font-mono text-xs text-slate-400">
            {years[0]}–{years[years.length - 1]} · {unitPerDecade}
          </div>
        </div>
        {error && (
          <div className="absolute inset-x-3 bottom-8 z-[500] rounded-md bg-red-950/90 px-3 py-2 text-sm text-red-200">
            Couldn&apos;t load results: {error}
          </div>
        )}
      </div>

      {/* Detail */}
      <aside className="w-full shrink-0 overflow-y-auto border-t border-white/10 bg-[#0e141b] p-4 lg:w-[400px] lg:border-l lg:border-t-0">
        {detail ? (
          <DetailPanel
            detail={detail}
            meta={meta}
            years={years}
            nYears={nYears}
            unitPerDecade={unitPerDecade}
            seasonLabel={manifest.seasons[season].label}
          />
        ) : (
          <p className="text-sm text-slate-500">Select a region or click a cell on the map.</p>
        )}
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
  fdr: boolean | null;
  sea?: boolean;
}

function DetailPanel({
  detail,
  meta,
  years,
  nYears,
  unitPerDecade,
  seasonLabel,
}: {
  detail: Detail;
  meta: Manifest["variables"][VariableId];
  years: number[];
  nYears: number;
  unitPerDecade: string;
  seasonLabel: string;
}) {
  const { trend } = detail;
  const v = trend ? verdict(trend, meta, years) : null;
  const d = meta.decimals + 1;
  const relative =
    trend && !meta.anomaly && detail.mean ? (trend.slopePerDecade / detail.mean) * 100 : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold leading-snug text-white">{detail.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">{detail.subtitle}</p>
        <p className="mt-1 text-xs text-slate-500">
          {meta.label} · {seasonLabel}
        </p>
      </div>

      {detail.sea && <p className="text-sm text-slate-400">This cell is mostly sea, so it isn&apos;t analysed. Click a land cell.</p>}

      {trend && v && (
        <>
          <div className="rounded-md bg-white/[0.03] p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full ${v.tone === "none" ? "bg-slate-500" : "bg-sky-400"}`}
              />
              {v.headline}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums text-white">
                {formatSigned(trend.slopePerDecade, d)}
              </span>
              <span className="text-sm text-slate-400">{unitPerDecade}</span>
            </div>
            {relative !== null && (
              <div className="text-sm text-slate-400">
                {formatSigned(relative, 1)}% of the average {meta.label.toLowerCase()} per decade
              </div>
            )}
            <dl className="mt-3 space-y-1 text-sm">
              <Row
                label="95% range of the rate"
                value={`${formatSigned(trend.lowerPerDecade, d)} to ${formatSigned(trend.upperPerDecade, d)}`}
              />
              <Row
                label={`Change over ${years[0]}–${years[years.length - 1]}`}
                value={`${formatSigned((trend.slopePerDecade * nYears) / 10, meta.decimals)} ${meta.unit}`}
              />
              <Row label="Significance" value={formatP(trend.p)} />
              {detail.fdr !== null && (
                <Row label="Map-wide check (FDR)" value={detail.fdr ? "passes" : "does not pass"} />
              )}
              {!meta.anomaly && detail.mean !== null && (
                <Row label="Average" value={`${detail.mean.toFixed(meta.decimals)} ${meta.unit}`} />
              )}
            </dl>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{v.explanation}</p>
        </>
      )}

      {detail.values ? (
        <SeriesChart
          years={years}
          values={detail.values}
          slopePerDecade={trend?.slopePerDecade ?? null}
          unit={meta.unit}
          decimals={meta.decimals}
          axisLabel={meta.anomaly ? `${meta.unit} vs ${meta.baseline}` : `${meta.unit} per season`}
          zeroLine={meta.anomaly}
        />
      ) : (
        trend && <p className="text-sm text-slate-500">Loading time series…</p>
      )}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{children}</h2>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right tabular-nums text-slate-100">{value}</dd>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex rounded-md bg-white/5 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded px-2 py-1.5 text-xs transition-colors ${
            value === o.id ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
