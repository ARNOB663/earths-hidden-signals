"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  HAZARD_META,
  HAZARD_ORDER,
  ordinal,
  preparednessSignal,
  type DriverResult,
  type FireGrid,
  type FloodEvent,
  type HazardId,
  type HazardZone,
  type LandslideEvent,
} from "@/lib/hazards";
import { ALPHA, formatP, formatSigned, type Manifest, type VariableId } from "@/lib/trends";
import { FIRE_BREAKS, fireColor, FLOOD_ALERT_COLORS, LANDSLIDE_COLOR } from "./hazardColors";
import { YearBars } from "./YearBars";

const HazardMap = dynamic(() => import("./HazardMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-500">Loading map…</div>,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EVENT_COLOR: Record<HazardId, string> = { flood: "#3987e5", landslide: LANDSLIDE_COLOR, wildfire: "#d95926" };

function useJson<T>(url: string | null): T | null {
  const [data, setData] = useState<{ url: string; value: T } | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url)
      .then((r) => r.json())
      .then((value) => alive && setData({ url, value }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url]);
  return data && data.url === url ? data.value : null;
}

export default function HazardExplorer({ zones, manifest }: { zones: HazardZone[]; manifest: Manifest }) {
  const params = useSearchParams();
  const [hazard, setHazard] = useState<HazardId>(() => {
    const h = params.get("hazard") as HazardId;
    return HAZARD_ORDER.includes(h) ? h : "wildfire";
  });
  const hazardZones = zones.filter((z) => z.hazard === hazard);
  const [zoneId, setZoneId] = useState<string>(() => {
    const z = zones.find((zone) => zone.id === params.get("zone") && zone.hazard === hazard);
    return z?.id ?? zones.find((zone) => zone.hazard === hazard)!.id;
  });
  const zone = hazardZones.find((z) => z.id === zoneId) ?? hazardZones[0];

  const landslides = useJson<LandslideEvent[]>(hazard === "landslide" ? "/data/hazards/landslides.json" : null);
  const floods = useJson<FloodEvent[]>(hazard === "flood" ? "/data/hazards/floods.json" : null);
  const fires = useJson<FireGrid>(hazard === "wildfire" ? "/data/hazards/fires_grid.json" : null);

  useEffect(() => {
    window.history.replaceState(null, "", `?hazard=${hazard}&zone=${zone.id}`);
  }, [hazard, zone.id]);

  const selectHazard = (h: HazardId) => {
    setHazard(h);
    setZoneId(zones.find((z) => z.hazard === h)!.id);
  };

  const meta = HAZARD_META[hazard];

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-b border-white/10 bg-[#0e141b] p-4 lg:w-[300px] lg:border-b-0 lg:border-r">
        <section>
          <Heading>Hazard</Heading>
          <div className="flex rounded-md bg-white/5 p-0.5">
            {HAZARD_ORDER.map((h) => (
              <button
                key={h}
                onClick={() => selectHazard(h)}
                className={`flex-1 rounded px-2 py-1.5 text-xs transition-colors ${
                  hazard === h ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {HAZARD_META[h].label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{meta.intro}</p>
        </section>

        <section>
          <Heading>Regions</Heading>
          <div className="space-y-1">
            {hazardZones.map((z) => {
              const signal = preparednessSignal(z);
              return (
                <button
                  key={z.id}
                  onClick={() => setZoneId(z.id)}
                  className={`w-full rounded-md px-2.5 py-2 text-left transition-colors ${
                    z.id === zone.id ? "bg-sky-500/15 ring-1 ring-sky-400/50" : "hover:bg-white/5"
                  }`}
                >
                  <span className={`block text-sm ${z.id === zone.id ? "text-white" : "text-slate-200"}`}>{z.name}</span>
                  <span className="text-[11px] text-slate-500">
                    {z.counts.reduce((a, b) => a + b, 0).toLocaleString()} {meta.eventsPlural} ·{" "}
                    {signal.kind === "resembles"
                      ? "conditions resemble past high-event years"
                      : signal.kind === "not-resembling"
                        ? "linked drivers, no current match"
                        : "no reliable climate link"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <Heading>Map key</Heading>
          {hazard === "wildfire" && (
            <div className="space-y-1 text-xs text-slate-400">
              <div className="flex h-3 overflow-hidden rounded-sm">
                {FIRE_BREAKS.map((b) => (
                  <span key={b} className="flex-1" style={{ background: fireColor(b)! }} />
                ))}
              </div>
              <div className="flex justify-between font-mono text-[10px]">
                {FIRE_BREAKS.map((b) => (
                  <span key={b}>{b}+</span>
                ))}
              </div>
              <p>Average fire detections per year, March–May, per 0.5° cell (NASA FIRMS MODIS, 2003–2024).</p>
            </div>
          )}
          {hazard === "landslide" && (
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: LANDSLIDE_COLOR }} /> One reported landslide
              (larger = 10+ deaths), NASA Global Landslide Catalog 2007–2017.
            </p>
          )}
          {hazard === "flood" && (
            <ul className="space-y-1 text-xs text-slate-400">
              {Object.entries(FLOOD_ALERT_COLORS).map(([level, color]) => (
                <li key={level} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {level} alert (GDACS)
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">Dashed boxes are the analysis regions; click one to select it.</p>
        </section>
      </aside>

      <div className="relative h-[50vh] min-h-[300px] flex-1 lg:h-auto">
        <HazardMap
          hazard={hazard}
          zones={hazardZones}
          selectedZone={zone.id}
          onSelectZone={setZoneId}
          landslides={landslides}
          floods={floods}
          fires={fires}
        />
      </div>

      <aside className="w-full shrink-0 overflow-y-auto border-t border-white/10 bg-[#0e141b] p-4 lg:w-[420px] lg:border-l lg:border-t-0">
        <ZoneDetail zone={zone} manifest={manifest} />
      </aside>
    </div>
  );
}

function ZoneDetail({ zone, manifest }: { zone: HazardZone; manifest: Manifest }) {
  const meta = HAZARD_META[zone.hazard];
  const signal = preparednessSignal(zone);
  const total = zone.counts.reduce((a, b) => a + b, 0);
  const firstYear = zone.years[0];
  const lastYear = zone.years[zone.years.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{meta.label} region</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{zone.name}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">{zone.description}</p>
      </div>

      {/* 1. Preparedness signal */}
      <section
        className={`rounded-md p-3 ring-1 ${
          signal.kind === "resembles" ? "bg-amber-400/10 ring-amber-400/40" : "bg-white/[0.03] ring-white/10"
        }`}
      >
        <Heading>Preparedness signal · {manifest.years[manifest.years.length - 1]}</Heading>
        {signal.kind === "resembles" && (
          <>
            <p className="flex items-start gap-2 text-sm font-medium text-amber-200">
              <span aria-hidden>▲</span> Current conditions resemble those seen in past high-{meta.eventNoun} years.
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
              {signal.drivers.map((d) => (
                <li key={d.key}>
                  {d.label} in {d.latest.year} was {d.risk === "higher" ? "higher" : "lower"} than{" "}
                  {d.risk === "higher" ? d.latest.percentile : 100 - d.latest.percentile}% of years since {manifest.years[0]}.
                  In the worst {meta.eventNoun} years it averaged the {ordinal(d.highEventYearsPercentile!)} percentile.
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Worth raising monitoring and readiness. This is a comparison with history, not a forecast that a disaster will
              happen.
            </p>
          </>
        )}
        {signal.kind === "not-resembling" && (
          <p className="text-sm text-slate-300">
            Past high-{meta.eventNoun} years here came with unusual {signal.drivers.map((d) => d.label.toLowerCase()).join(" and ")},
            but {manifest.years[manifest.years.length - 1]} conditions are not in that range.
          </p>
        )}
        {signal.kind === "no-link" && (
          <p className="text-sm text-slate-300">
            No climate driver showed a statistically reliable link with {meta.eventsPlural} in this region, so we don&apos;t
            issue a signal. Other factors (land use, reporting, human ignition) may matter more here.
          </p>
        )}
      </section>

      {/* 2. Event record */}
      <section>
        <Heading>
          Past {meta.eventsPlural} · {firstYear}–{lastYear}
        </Heading>
        <p className="mb-3 text-sm text-slate-400">
          {total.toLocaleString()} in total. Bold bars are the top-25% years.
        </p>
        <YearBars
          labels={zone.years}
          values={zone.counts}
          highlight={new Set(zone.highEventYears)}
          color={EVENT_COLOR[zone.hazard]}
          unit={meta.eventsPlural}
          ariaLabel={`${meta.eventsPlural} per year in ${zone.name}`}
          labelEvery={zone.years.length > 12 ? 5 : 2}
        />
        {zone.eventTrend && (
          <p className="mt-3 text-sm text-slate-300">
            {zone.eventTrend.p < ALPHA ? (
              <>
                <span className="font-medium text-white">
                  Significant {zone.eventTrend.slopePerDecade > 0 ? "increase" : "decrease"}
                </span>
                : {formatSigned(zone.eventTrend.slopePerDecade, 0)} {meta.eventsPlural} per decade (95% range{" "}
                {formatSigned(zone.eventTrend.lowerPerDecade, 0)} to {formatSigned(zone.eventTrend.upperPerDecade, 0)},{" "}
                {formatP(zone.eventTrend.p)}).
              </>
            ) : (
              <>
                <span className="font-medium text-white">No detectable trend</span> in yearly counts (
                {formatSigned(zone.eventTrend.slopePerDecade, 0)} {meta.eventsPlural} per decade, {formatP(zone.eventTrend.p)}).
              </>
            )}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">Source: {zone.eventSource}</p>

        <div className="mt-4">
          <p className="mb-2 text-xs text-slate-400">When in the year they happen (all years)</p>
          <YearBars
            labels={MONTHS}
            values={zone.monthly}
            color={EVENT_COLOR[zone.hazard]}
            unit={meta.eventsPlural}
            ariaLabel={`${meta.eventsPlural} by month in ${zone.name}`}
            height={48}
            labelEvery={2}
          />
        </div>
      </section>

      {/* 3. Climate drivers */}
      <section>
        <Heading>Climate drivers</Heading>
        <div className="space-y-3">
          {zone.drivers.map((d) => (
            <DriverCard key={d.key} driver={d} zone={zone} manifest={manifest} />
          ))}
        </div>
      </section>

      {/* 4. Who is affected */}
      <section>
        <Heading>Who this helps</Heading>
        <div className="flex flex-wrap gap-1.5">
          {meta.affected.map((a) => (
            <span key={a} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/10">
              {a}
            </span>
          ))}
        </div>
      </section>

      <p className="text-xs leading-relaxed text-slate-500">
        Links here are correlations, not proof of cause. Event records have gaps: news-based landslide reports miss remote
        events, and satellites miss fires under clouds or smoke.
        {zone.hazard === "wildfire" &&
          " The MODIS satellites' overpass times drifted after about 2020, which can lower recent fire counts, so read the latest years of the fire trend with care."}
        {zone.hazard === "flood" && " GDACS has issued more alerts in recent years partly because its coverage improved."}
      </p>
    </div>
  );
}

function DriverCard({ driver: d, zone, manifest }: { driver: DriverResult; zone: HazardZone; manifest: Manifest }) {
  const [variable, season] = d.key.split("_") as [VariableId, string];
  const vmeta = manifest.variables[variable];
  const meta = HAZARD_META[zone.hazard];
  const rel = d.relationship;

  return (
    <div className="rounded-md bg-white/[0.03] p-3 ring-1 ring-white/10">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-white">{d.label}</span>
        <Link
          href={`/trends?var=${variable}&season=${season}&zone=${zone.id}`}
          className="shrink-0 text-xs text-sky-400 hover:underline"
        >
          See trend →
        </Link>
      </div>

      {d.trend && (
        <p className="mt-1 text-sm text-slate-300">
          Long-term: {formatSigned(d.trend.slopePerDecade, vmeta.decimals + 1)} {vmeta.unit} per decade,{" "}
          {d.trend.p < ALPHA ? (
            <span className="text-white">significant ({formatP(d.trend.p)})</span>
          ) : (
            <span>not significant ({formatP(d.trend.p)})</span>
          )}
          .
        </p>
      )}

      <p className="mt-1 text-sm text-slate-300">
        {rel === null ? (
          "Too few events to test a link."
        ) : d.linked ? (
          <>
            <span className="text-white">Linked:</span> years with more {meta.eventsPlural} had{" "}
            {d.risk === "higher" ? "higher" : "lower"} {d.label.toLowerCase()} (ρ = {rel.rho.toFixed(2)},{" "}
            {formatP(rel.p)}, n = {rel.n}).
          </>
        ) : (
          <>
            No reliable link with {meta.eventsPlural} (ρ = {rel.rho.toFixed(2)}, {formatP(rel.p)}, n = {rel.n}).
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {d.latest.year}: {ordinal(d.latest.percentile)} percentile of {manifest.years[0]}–{d.latest.year}
        {d.highEventYearsPercentile !== null && ` · high-event years averaged the ${ordinal(d.highEventYearsPercentile)}`}
      </p>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{children}</h3>;
}
