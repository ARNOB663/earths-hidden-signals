"use client";

import { ArrowRight, CheckCircle, Fire, HandPointing, Mountains, Question, Warning, Waves } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Numbers, Segmented, Stat } from "@/components/ui";
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
import { linkStrength, sureness } from "@/lib/plain";
import { ALPHA, formatP, formatSigned, type Manifest, type VariableId } from "@/lib/trends";
import { EVENT_TOKEN, FIRE_BREAKS, fireToken, FLOOD_ALERT_COLORS } from "./hazardColors";
import { YearBars } from "./YearBars";

const HazardMap = dynamic(() => import("./HazardMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-sunken text-sm text-ink-3">Loading map…</div>,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HAZARD_ICON = { flood: Waves, landslide: Mountains, wildfire: Fire } as const;
/** Plain names for what we count. */
const EVENTS: Record<HazardId, { plural: string; bigYears: string }> = {
  flood: { plural: "flood alerts", bigYears: "big flood years" },
  landslide: { plural: "landslides", bigYears: "big landslide years" },
  wildfire: { plural: "fires spotted by satellite", bigYears: "big fire years" },
};

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
    return HAZARD_ORDER.includes(h) ? h : "flood";
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

  return (
    <div className="relative flex h-full flex-col lg:block">
      <div className="relative h-[52vh] min-h-[320px] lg:absolute lg:inset-0 lg:h-auto">
        <HazardMap
          hazard={hazard}
          zones={hazardZones}
          selectedZone={zone.id}
          onSelectZone={setZoneId}
          landslides={landslides}
          floods={floods}
          fires={fires}
        />
        <div className="pointer-events-none absolute left-[58px] top-3 z-[500] flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm text-ink-2 shadow-soft">
          <HandPointing size={18} className="text-accent" />
          Click a dashed box to pick a region
        </div>
        <div className="absolute bottom-10 left-3 z-[500] w-[min(300px,calc(100%-1.5rem))] rounded-2xl bg-card p-4 text-sm shadow-soft">
          <MapKey hazard={hazard} />
        </div>
      </div>

      <aside
        aria-label="Disaster details"
        className="z-[600] flex flex-col gap-5 bg-card p-5 lg:absolute lg:bottom-4 lg:right-4 lg:top-4 lg:w-[420px] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-line lg:shadow-soft"
      >
        <section className="space-y-3">
          <h1 className="text-lg font-semibold text-ink">Is the weather raising disaster risk?</h1>
          <Segmented
            label="Type of disaster"
            value={hazard}
            onChange={selectHazard}
            options={HAZARD_ORDER.map((h) => {
              const Icon = HAZARD_ICON[h];
              return { id: h, label: HAZARD_META[h].label, icon: <Icon size={16} /> };
            })}
          />
          <p className="text-sm leading-relaxed text-ink-2">{HAZARD_META[hazard].intro}</p>
          <div className="space-y-1.5">
            {hazardZones.map((z) => (
              <button
                key={z.id}
                onClick={() => setZoneId(z.id)}
                aria-pressed={z.id === zone.id}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all active:scale-[0.99] ${
                  z.id === zone.id ? "border-accent bg-accent-soft font-medium text-ink" : "border-line text-ink-2 hover:border-ink-3"
                }`}
              >
                {z.name}
                <SignalBadge zone={z} />
              </button>
            ))}
          </div>
        </section>

        <div className="h-px bg-line" />
        <ZoneAnswer zone={zone} manifest={manifest} />
      </aside>
    </div>
  );
}

function SignalBadge({ zone }: { zone: HazardZone }) {
  const s = preparednessSignal(zone).kind;
  if (s === "resembles")
    return <span className="shrink-0 rounded-full bg-watch-soft px-2.5 py-0.5 text-xs font-medium text-watch">Watch</span>;
  if (s === "not-resembling")
    return <span className="shrink-0 rounded-full bg-sunken px-2.5 py-0.5 text-xs text-ink-2">Normal</span>;
  return <span className="shrink-0 rounded-full bg-sunken px-2.5 py-0.5 text-xs text-ink-3">No clear link</span>;
}

function ZoneAnswer({ zone, manifest }: { zone: HazardZone; manifest: Manifest }) {
  const meta = HAZARD_META[zone.hazard];
  const ev = EVENTS[zone.hazard];
  const signal = preparednessSignal(zone);
  const total = zone.counts.reduce((a, b) => a + b, 0);
  const thisYear = manifest.years[manifest.years.length - 1];
  const first = zone.years[0];
  const last = zone.years[zone.years.length - 1];
  const color = `var(${EVENT_TOKEN[zone.hazard]})`;

  return (
    <section className="space-y-6" aria-live="polite">
      <div>
        <h2 className="text-xl font-semibold text-ink">{zone.name}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{zone.description}</p>
      </div>

      {/* 1. This year */}
      {signal.kind === "resembles" && (
        <div className="rounded-2xl bg-watch-soft p-4">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <Warning size={22} weight="fill" className="text-watch" />
            Watch this year ({thisYear})
          </div>
          {signal.drivers.map((d) => (
            <p key={d.key} className="mt-2 text-sm leading-relaxed text-ink">
              {d.label} was {d.risk === "higher" ? "higher" : "lower"} than in{" "}
              <strong>{d.risk === "higher" ? d.latest.percentile : 100 - d.latest.percentile}% of years</strong> since{" "}
              {manifest.years[0]}. That is like the {ev.bigYears} of the past.
            </p>
          ))}
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            A good time to prepare early. This compares with history; it is not a forecast.
          </p>
        </div>
      )}
      {signal.kind === "not-resembling" && (
        <div className="rounded-2xl bg-sunken p-4">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <CheckCircle size={22} weight="fill" className="text-good" />
            Normal this year ({thisYear})
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Past {ev.bigYears} came with unusual {signal.drivers.map((d) => d.label.toLowerCase()).join(" and ")}. This year
            wasn&apos;t like that.
          </p>
        </div>
      )}
      {signal.kind === "no-link" && (
        <div className="rounded-2xl bg-sunken p-4">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <Question size={22} weight="fill" className="text-ink-3" />
            No clear weather link
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Weather alone doesn&apos;t explain the {ev.plural} here, so we don&apos;t give a signal. Other things, like how
            people use the land or water coming from upstream, probably matter more.
          </p>
        </div>
      )}

      {/* 2. What happened before */}
      <div>
        <h3 className="font-semibold text-ink">What happened before</h3>
        <p className="mt-1 text-sm text-ink-2">
          {total.toLocaleString()} {ev.plural} from {first} to {last}. Each bar is one year; the strongest colour marks the worst
          years.
        </p>
        <div className="mt-3">
          <YearBars
            labels={zone.years}
            values={zone.counts}
            highlight={new Set(zone.highEventYears)}
            color={color}
            unit={ev.plural}
            ariaLabel={`${ev.plural} per year in ${zone.name}`}
            labelEvery={zone.years.length > 12 ? 5 : 2}
          />
        </div>
        {zone.eventTrend && (
          <p className="mt-2 text-sm text-ink-2">
            {zone.eventTrend.p < ALPHA
              ? `Over time they are clearly ${zone.eventTrend.slopePerDecade > 0 ? "increasing" : "decreasing"} (${sureness(zone.eventTrend.p).short.toLowerCase()}).`
              : "No clear rise or fall over the years."}
          </p>
        )}
        <div className="mt-4">
          <p className="mb-2 text-sm text-ink-2">Which months they happen in</p>
          <YearBars
            labels={MONTHS}
            values={zone.monthly}
            color={color}
            unit={ev.plural}
            ariaLabel={`${ev.plural} by month in ${zone.name}`}
            height={52}
            labelEvery={2}
          />
        </div>
      </div>

      {/* 3. What drives it */}
      <div>
        <h3 className="font-semibold text-ink">Does the weather explain it?</h3>
        <div className="mt-3 space-y-2">
          {zone.drivers.map((d) => (
            <DriverRow key={d.key} driver={d} zone={zone} manifest={manifest} />
          ))}
        </div>
      </div>

      {/* 4. Who this helps */}
      <div>
        <h3 className="font-semibold text-ink">Who can use this</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {meta.affected.map((a) => (
            <span key={a} className="rounded-full bg-sunken px-3 py-1 text-sm text-ink-2">
              {a}
            </span>
          ))}
        </div>
      </div>

      <Numbers>
        <dl>
          {zone.drivers.map((d) =>
            d.relationship ? (
              <Stat
                key={d.key}
                label={`${d.label}: link (Spearman ρ, detrended)`}
                value={`ρ = ${d.relationship.rho.toFixed(2)}, ${formatP(d.relationship.p)}, n = ${d.relationship.n}`}
              />
            ) : null,
          )}
          {zone.drivers.map((d) => (
            <Stat
              key={`${d.key}-pct`}
              label={`${d.label}: ${d.latest.year} percentile / worst years`}
              value={`${ordinal(d.latest.percentile)} / ${d.highEventYearsPercentile === null ? "–" : ordinal(d.highEventYearsPercentile)}`}
            />
          ))}
          {zone.eventTrend && (
            <Stat
              label="Event trend (Sen's slope, per decade)"
              value={`${formatSigned(zone.eventTrend.slopePerDecade, 0)} (${formatP(zone.eventTrend.p)})`}
            />
          )}
          <Stat label="Event record" value={zone.eventSource} />
        </dl>
        <p className="mt-2 text-xs text-ink-3">
          A link is a correlation, not proof of cause. Records have gaps: news-based landslide reports miss remote places,
          satellites miss fires under cloud, and GDACS covers more floods in recent years.
        </p>
      </Numbers>
    </section>
  );
}

function DriverRow({ driver: d, zone, manifest }: { driver: DriverResult; zone: HazardZone; manifest: Manifest }) {
  const [variable, season] = d.key.split("_") as [VariableId, string];
  const vmeta = manifest.variables[variable];
  const ev = EVENTS[zone.hazard];
  const rel = d.relationship;
  const trendWord = d.trend
    ? d.trend.p < ALPHA
      ? `${d.trend.slopePerDecade > 0 ? (variable === "temperature" ? "getting warmer" : "getting wetter") : variable === "temperature" ? "getting cooler" : "getting drier"} (${formatSigned(d.trend.slopePerDecade, vmeta.decimals)} ${vmeta.unit} every 10 years)`
      : "no clear long-term change"
    : null;

  return (
    <div className="rounded-xl border border-line p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ink">{d.label}</span>
        {d.linked ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-ink">Linked</span>
        ) : (
          <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-ink-3">Not linked</span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        {rel === null
          ? "Too few events to test."
          : d.linked
            ? `${linkStrength(rel.rho)[0].toUpperCase()}${linkStrength(rel.rho).slice(1)} link: years with more ${ev.plural} had ${d.risk === "higher" ? "more" : "less"} ${d.label.toLowerCase().replace("temperature", "heat")}.`
            : `No clear link with ${ev.plural} here.`}
        {trendWord && ` Over the years it is ${trendWord}.`}
      </p>
      <Link
        href={`/trends?var=${variable}&season=${season}&zone=${zone.id}`}
        className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline"
      >
        See this trend <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function MapKey({ hazard }: { hazard: HazardId }) {
  if (hazard === "wildfire")
    return (
      <div>
        <div className="mb-2 font-medium text-ink">Fires per year (March–May)</div>
        <div className="flex gap-0.5 overflow-hidden rounded-md">
          {FIRE_BREAKS.map((b) => (
            <span key={b} className="h-3.5 flex-1" style={{ background: `var(${fireToken(b)})` }} />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-ink-3">
          {FIRE_BREAKS.map((b) => (
            <span key={b}>{b}+</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">Seen by NASA satellites, 2003–2024 average.</p>
      </div>
    );
  if (hazard === "landslide")
    return (
      <div>
        <div className="mb-2 font-medium text-ink">Reported landslides</div>
        <p className="flex items-center gap-2 text-ink-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "var(--ev-landslide)" }} /> One landslide (bigger dot =
          10+ deaths)
        </p>
        <p className="mt-2 text-xs text-ink-3">NASA Global Landslide Catalog, 2007–2017.</p>
      </div>
    );
  return (
    <div>
      <div className="mb-2 font-medium text-ink">Flood alerts</div>
      <ul className="space-y-1 text-ink-2">
        {Object.entries(FLOOD_ALERT_COLORS).map(([level, c]) => (
          <li key={level} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: c }} />
            {level === "Green" ? "Minor" : level === "Orange" ? "Serious" : "Severe"} ({level} alert)
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-3">From GDACS (UN/EU), 2000–2025.</p>
    </div>
  );
}
