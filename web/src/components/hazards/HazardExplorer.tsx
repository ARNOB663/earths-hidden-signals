"use client";

import { ArrowRight, CheckCircle, Fire, HandPointing, Hurricane, Mountains, Question, Warning, Waves } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Numbers, Stat } from "@/components/ui";
import { QuickGuide } from "@/components/ui/QuickGuide";
import {
  HAZARD_META,
  HAZARD_ORDER,
  ordinal,
  preparednessSignal,
  type CycloneTrack,
  type DriverResult,
  type FireGrid,
  type FloodEvent,
  type HazardId,
  type HazardZone,
  type LandslideEvent,
} from "@/lib/hazards";
import { bnNum } from "@/lib/bn";
import { T, useLang, useT } from "@/lib/i18n";
import { driverNameBn as DRIVER_BN, HAZARD_BN, unitBn, ZONE_BN } from "@/lib/names";
import { linkStrength, sureness } from "@/lib/plain";
import { ALPHA, formatP, formatSigned, type Manifest, type VariableId } from "@/lib/trends";
import { EVENT_TOKEN, FIRE_BREAKS, fireToken, FLOOD_ALERT_COLORS } from "./hazardColors";
import { YearBars } from "./YearBars";

const HazardMap = dynamic(() => import("./HazardMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-sunken text-sm text-ink-3">Loading map…</div>,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_BN = ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];

const STRENGTH_BN: Record<string, string> = { strong: "জোরালো", moderate: "মাঝারি", weak: "দুর্বল" };
const HAZARD_ICON = { flood: Waves, landslide: Mountains, wildfire: Fire, cyclone: Hurricane } as const;
/** Plain names for what we count. */
const EVENTS: Record<HazardId, { plural: string; bigYears: string }> = {
  flood: { plural: "flood alerts", bigYears: "big flood years" },
  landslide: { plural: "landslides", bigYears: "big landslide years" },
  wildfire: { plural: "fires spotted by satellite", bigYears: "big fire years" },
  cyclone: { plural: "cyclones", bigYears: "busy cyclone years" },
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
  const cyclones = useJson<CycloneTrack[]>(hazard === "cyclone" ? "/data/hazards/cyclones.json" : null);

  useEffect(() => {
    window.history.replaceState(null, "", `?hazard=${hazard}&zone=${zone.id}`);
  }, [hazard, zone.id]);

  const t = useT();

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
          cyclones={cyclones}
        />
        <div className="pointer-events-none absolute left-[58px] top-3 z-[500] flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm text-ink-2 shadow-soft">
          <HandPointing size={18} className="text-accent" />
          <T en="Click a dashed box to pick a region" bn="অঞ্চল বেছে নিতে ড্যাশ-দাগের বাক্সে ক্লিক করুন" />
        </div>
        <QuickGuide
          id="hazards"
          title={<T en="How to use Disaster risk" bn="দুর্যোগের ঝুঁকি পাতা কীভাবে ব্যবহার করবেন" />}
          steps={[
            <T key="1" en="Choose floods, landslides, wildfires or cyclones." bn="বন্যা, ভূমিধস, দাবানল বা ঘূর্ণিঝড় বেছে নিন।" />,
            <T
              key="2"
              en="Pick a region from the list, or click a dashed box on the map."
              bn="তালিকা থেকে একটি অঞ্চল বেছে নিন, অথবা মানচিত্রের ড্যাশ-দাগের বাক্সে ক্লিক করুন।"
            />,
            <T
              key="3"
              en='Check "This year": does the weather look like past disaster years?'
              bn="&ldquo;এই বছর&rdquo; দেখুন: আবহাওয়া কি আগের দুর্যোগের বছরগুলোর মতো?"
            />,
          ]}
          buttonClassName="absolute left-[58px] top-[60px]"
          cardClassName="absolute left-[58px] top-[108px]"
        />
        <div className="absolute bottom-10 left-3 z-[500] w-[min(300px,calc(100%-1.5rem))] rounded-2xl bg-card p-4 text-sm shadow-soft">
          <MapKey hazard={hazard} />
        </div>
      </div>

      <aside
        aria-label={t("Disaster details", "দুর্যোগের বিস্তারিত")}
        className="z-[600] flex flex-col gap-5 bg-card p-5 lg:absolute lg:bottom-4 lg:right-4 lg:top-4 lg:w-[420px] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-line lg:shadow-soft"
      >
        <section className="space-y-3">
          <h1 className="text-lg font-semibold text-ink">
            <T en="Is the weather raising disaster risk?" bn="আবহাওয়া কি দুর্যোগের ঝুঁকি বাড়াচ্ছে?" />
          </h1>
          <div role="radiogroup" aria-label={t("Type of disaster", "দুর্যোগের ধরন")} className="grid grid-cols-2 gap-1.5">
            {HAZARD_ORDER.map((h) => {
              const Icon = HAZARD_ICON[h];
              return (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={hazard === h}
                  onClick={() => selectHazard(h)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all active:scale-[0.98] ${
                    hazard === h ? "border-accent bg-accent-soft font-medium text-ink" : "border-line text-ink-2 hover:text-ink"
                  }`}
                >
                  <Icon size={18} weight={hazard === h ? "fill" : "regular"} className={hazard === h ? "text-accent" : ""} />
                  <T en={HAZARD_META[h].label} bn={HAZARD_BN[h].label} />
                </button>
              );
            })}
          </div>
          <p className="text-sm leading-relaxed text-ink-2">
            <T en={HAZARD_META[hazard].intro} bn={HAZARD_BN[hazard].intro} />
          </p>
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
                <T en={z.name} bn={ZONE_BN[z.id]?.name ?? z.name} />
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
    return (
      <span className="shrink-0 rounded-full bg-watch-soft px-2.5 py-0.5 text-xs font-medium text-watch">
        <T en="Watch" bn="নজর দিন" />
      </span>
    );
  if (s === "not-resembling")
    return (
      <span className="shrink-0 rounded-full bg-sunken px-2.5 py-0.5 text-xs text-ink-2">
        <T en="Normal" bn="স্বাভাবিক" />
      </span>
    );
  return (
    <span className="shrink-0 rounded-full bg-sunken px-2.5 py-0.5 text-xs text-ink-3">
      <T en="No clear link" bn="স্পষ্ট যোগসূত্র নেই" />
    </span>
  );
}

function ZoneAnswer({ zone, manifest }: { zone: HazardZone; manifest: Manifest }) {
  const meta = HAZARD_META[zone.hazard];
  const bn = HAZARD_BN[zone.hazard];
  const ev = EVENTS[zone.hazard];
  const lang = useLang();
  const signal = preparednessSignal(zone);
  const total = zone.counts.reduce((a, b) => a + b, 0);
  const thisYear = manifest.years[manifest.years.length - 1];
  const first = zone.years[0];
  const last = zone.years[zone.years.length - 1];
  const color = `var(${EVENT_TOKEN[zone.hazard]})`;

  return (
    <section className="space-y-6" aria-live="polite">
      <div>
        <h2 className="text-xl font-semibold text-ink">
          <T en={zone.name} bn={ZONE_BN[zone.id]?.name ?? zone.name} />
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          <T en={zone.description} bn={ZONE_BN[zone.id]?.description ?? zone.description} />
        </p>
      </div>

      {/* 1. This year */}
      {signal.kind === "resembles" && (
        <div className="rounded-2xl bg-watch-soft p-4">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <Warning size={22} weight="fill" className="text-watch" />
            <T en={`Watch this year (${thisYear})`} bn={`এই বছর নজর দিন (${bnNum(thisYear)})`} />
          </div>
          {signal.drivers.map((d) => {
            const share = d.risk === "higher" ? d.latest.percentile : 100 - d.latest.percentile;
            return (
              <p key={d.key} className="mt-2 text-sm leading-relaxed text-ink">
                <T
                  en={
                    <>
                      {d.label} was {d.risk === "higher" ? "higher" : "lower"} than in <strong>{share}% of years</strong> since{" "}
                      {manifest.years[0]}. That is like the {ev.bigYears} of the past.
                    </>
                  }
                  bn={
                    <>
                      {DRIVER_BN(d.key)} {bnNum(manifest.years[0])} সালের পর থেকে{" "}
                      <strong>{bnNum(share)}% বছরের চেয়ে {d.risk === "higher" ? "বেশি" : "কম"}</strong> ছিল। এটি আগের{" "}
                      {bn.bigYears}ের মতো।
                    </>
                  }
                />
              </p>
            );
          })}
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            <T
              en="A good time to prepare early. This compares with history; it is not a forecast."
              bn="আগেভাগে প্রস্তুতি নেওয়ার ভালো সময়। এটি অতীতের সাথে তুলনা; পূর্বাভাস নয়।"
            />
          </p>
        </div>
      )}
      {signal.kind === "not-resembling" && (
        <div className="rounded-2xl bg-sunken p-4">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <CheckCircle size={22} weight="fill" className="text-good" />
            <T en={`Normal this year (${thisYear})`} bn={`এই বছর স্বাভাবিক (${bnNum(thisYear)})`} />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            <T
              en={`Past ${ev.bigYears} came with unusual ${signal.drivers.map((d) => d.label.toLowerCase()).join(" and ")}. This year wasn't like that.`}
              bn={`আগের ${bn.bigYears}গুলোতে ${signal.drivers.map((d) => DRIVER_BN(d.key)).join(" ও ")} অস্বাভাবিক ছিল। এই বছর তেমন ছিল না।`}
            />
          </p>
        </div>
      )}
      {signal.kind === "no-link" && (
        <div className="rounded-2xl bg-sunken p-4">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <Question size={22} weight="fill" className="text-ink-3" />
            <T en="No clear weather link" bn="আবহাওয়ার সাথে স্পষ্ট যোগসূত্র নেই" />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {zone.hazard === "cyclone" ? (
              <T
                en="Sea warmth alone doesn't explain how many cyclones form each year, so we don't give a signal. Winds high in the atmosphere and natural cycles like El Niño matter too."
                bn="শুধু সাগরের উষ্ণতা দিয়ে প্রতি বছর কতগুলো ঘূর্ণিঝড় হয় তা বোঝা যায় না, তাই আমরা কোনো সংকেত দিই না। উঁচু বায়ুমণ্ডলের বাতাস ও এল নিনোর মতো প্রাকৃতিক চক্রও গুরুত্বপূর্ণ।"
              />
            ) : (
              <T
                en={`Weather alone doesn't explain the ${ev.plural} here, so we don't give a signal. Other things, like how people use the land or water coming from upstream, probably matter more.`}
                bn={`এখানে শুধু আবহাওয়া দিয়ে ${bn.plural} ব্যাখ্যা করা যায় না, তাই আমরা কোনো সংকেত দিই না। মানুষ জমি কীভাবে ব্যবহার করে বা উজান থেকে আসা পানির মতো অন্য বিষয় সম্ভবত বেশি গুরুত্বপূর্ণ।`}
              />
            )}
          </p>
        </div>
      )}

      {/* 2. What happened before */}
      <div>
        <h3 className="font-semibold text-ink">
          <T en="What happened before" bn="আগে কী ঘটেছে" />
        </h3>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en={`${total.toLocaleString()} ${ev.plural} from ${first} to ${last}${zone.severe !== undefined ? ` (${zone.severe} of them severe, 64 knots or more)` : ""}. Each bar is one year; the strongest colour marks the worst years.`}
            bn={`${bnNum(first)} থেকে ${bnNum(last)} সাল পর্যন্ত ${bnNum(total.toLocaleString("en-US"))}টি ${bn.plural}${zone.severe !== undefined ? ` (এর মধ্যে ${bnNum(zone.severe)}টি প্রবল, ৬৪ নট বা বেশি)` : ""}। প্রতিটি দণ্ড এক বছর; গাঢ় রঙ সবচেয়ে খারাপ বছরগুলো।`}
          />
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
            csvTitle={`${zone.name} ${ev.plural} per year`}
          />
        </div>
        {zone.eventTrend && (
          <p className="mt-2 text-sm text-ink-2">
            {zone.eventTrend.p < ALPHA ? (
              <T
                en={`Over time they are clearly ${zone.eventTrend.slopePerDecade > 0 ? "increasing" : "decreasing"} (${sureness(zone.eventTrend.p).short.toLowerCase()}).`}
                bn={`সময়ের সাথে এগুলো স্পষ্টভাবে ${zone.eventTrend.slopePerDecade > 0 ? "বাড়ছে" : "কমছে"} (${sureness(zone.eventTrend.p).shortBn})।`}
              />
            ) : (
              <T en="No clear rise or fall over the years." bn="বছরের পর বছর স্পষ্ট বৃদ্ধি বা হ্রাস নেই।" />
            )}
          </p>
        )}
        <div className="mt-4">
          <p className="mb-2 text-sm text-ink-2">
            <T en="Which months they happen in" bn="কোন কোন মাসে ঘটে" />
          </p>
          <YearBars
            labels={lang === "bn" ? MONTHS_BN : MONTHS}
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
        <h3 className="font-semibold text-ink">
          <T en="Does the weather explain it?" bn="আবহাওয়া কি এর ব্যাখ্যা দেয়?" />
        </h3>
        <div className="mt-3 space-y-2">
          {zone.drivers.map((d) => (
            <DriverRow key={d.key} driver={d} zone={zone} manifest={manifest} />
          ))}
        </div>
      </div>

      {/* 4. Who this helps */}
      <div>
        <h3 className="font-semibold text-ink">
          <T en="Who can use this" bn="কারা এটি ব্যবহার করতে পারেন" />
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {meta.affected.map((a, i) => (
            <span key={a} className="rounded-full bg-sunken px-3 py-1 text-sm text-ink-2">
              <T en={a} bn={bn.affected[i] ?? a} />
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
  // Most drivers are Climate trends variables; others (like sea warmth) carry their own unit.
  const vmeta = manifest.variables[variable] ?? {
    unit: d.unit ?? "",
    decimals: Math.max(0, (d.decimals ?? 2) - 1),
  };
  const custom = !manifest.variables[variable];
  const ev = EVENTS[zone.hazard];
  const bn = HAZARD_BN[zone.hazard];
  const rel = d.relationship;
  const warmthLike = variable === "temperature" || custom;
  const up = d.trend ? d.trend.slopePerDecade > 0 : false;
  const rate = d.trend ? formatSigned(d.trend.slopePerDecade, vmeta.decimals) : "";
  const trendWord = d.trend
    ? d.trend.p < ALPHA
      ? `${up ? (warmthLike ? "getting warmer" : "getting wetter") : warmthLike ? "getting cooler" : "getting drier"} (${rate} ${vmeta.unit} every 10 years)`
      : "no clear long-term change"
    : null;
  const trendWordBn = d.trend
    ? d.trend.p < ALPHA
      ? `${up ? (warmthLike ? "গরম হচ্ছে" : "বৃষ্টি বাড়ছে") : warmthLike ? "ঠান্ডা হচ্ছে" : "শুষ্ক হচ্ছে"} (প্রতি ১০ বছরে ${bnNum(rate)} ${unitBn(vmeta.unit)})`
      : "দীর্ঘমেয়াদে স্পষ্ট পরিবর্তন নেই"
    : null;

  return (
    <div className="rounded-xl border border-line p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ink">
          <T en={d.label} bn={DRIVER_BN(d.key)} />
        </span>
        {d.linked ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-ink">
            <T en="Linked" bn="যোগসূত্র আছে" />
          </span>
        ) : (
          <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-ink-3">
            <T en="Not linked" bn="যোগসূত্র নেই" />
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        <T
          en={`${
            rel === null
              ? "Too few events to test."
              : d.linked
                ? `${linkStrength(rel.rho)[0].toUpperCase()}${linkStrength(rel.rho).slice(1)} link: years with more ${ev.plural} had ${d.risk === "higher" ? "more" : "less"} ${d.label.toLowerCase().replace("temperature", "heat")}.`
                : `No clear link with ${ev.plural} here.`
          }${trendWord ? ` Over the years it is ${trendWord}.` : ""}`}
          bn={`${
            rel === null
              ? "যাচাই করার মতো যথেষ্ট ঘটনা নেই।"
              : d.linked
                ? `${STRENGTH_BN[linkStrength(rel.rho)]} যোগসূত্র: যে বছরগুলোতে ${bn.plural} বেশি, সেগুলোতে ${DRIVER_BN(d.key)} ${d.risk === "higher" ? "বেশি" : "কম"} ছিল।`
                : `এখানে ${bn.plural}-এর সাথে স্পষ্ট যোগসূত্র নেই।`
          }${trendWordBn ? ` বছরের পর বছর এটি ${trendWordBn}।` : ""}`}
        />
      </p>
      {!custom && (
        <Link
          href={`/trends?var=${variable}&season=${season}&zone=${zone.id}`}
          className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <T en="See this trend" bn="এই প্রবণতা দেখুন" /> <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

function MapKey({ hazard }: { hazard: HazardId }) {
  if (hazard === "cyclone")
    return (
      <div>
        <div className="mb-2 font-medium text-ink">
          <T en="Cyclone tracks, 1981–2025" bn="ঘূর্ণিঝড়ের গতিপথ, ১৯৮১–২০২৫" />
        </div>
        <ul className="space-y-1 text-ink-2">
          <li className="flex items-center gap-2">
            <span className="h-1 w-6 rounded bg-[var(--ev-cyclone)]" /> <T en="Severe (64 knots or more)" bn="প্রবল (৬৪ নট বা বেশি)" />
          </li>
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-6 rounded bg-[var(--ev-cyclone)] opacity-50" />{" "}
            <T en="Cyclone (34 knots or more)" bn="ঘূর্ণিঝড় (৩৪ নট বা বেশি)" />
          </li>
        </ul>
        <p className="mt-2 text-xs text-ink-3">
          <T en="IBTrACS (NOAA NCEI), tracks from IMD and JTWC." bn="IBTrACS (NOAA NCEI), IMD ও JTWC-এর গতিপথ।" />
        </p>
      </div>
    );
  if (hazard === "wildfire")
    return (
      <div>
        <div className="mb-2 font-medium text-ink">
          <T en="Fires per year (March–May)" bn="বছরে আগুনের সংখ্যা (মার্চ–মে)" />
        </div>
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
        <p className="mt-2 text-xs text-ink-3">
          <T en="Seen by NASA satellites, 2003–2024 average." bn="নাসার স্যাটেলাইটে দেখা, ২০০৩–২০২৪ সালের গড়।" />
        </p>
      </div>
    );
  if (hazard === "landslide")
    return (
      <div>
        <div className="mb-2 font-medium text-ink">
          <T en="Reported landslides" bn="খবরে আসা ভূমিধস" />
        </div>
        <p className="flex items-center gap-2 text-ink-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "var(--ev-landslide)" }} />{" "}
          <T en="One landslide (bigger dot = 10+ deaths)" bn="একটি ভূমিধস (বড় বিন্দু = ১০ জনের বেশি মৃত্যু)" />
        </p>
        <p className="mt-2 text-xs text-ink-3">
          <T en="NASA Global Landslide Catalog, 2007–2017." bn="নাসার বৈশ্বিক ভূমিধস তালিকা, ২০০৭–২০১৭।" />
        </p>
      </div>
    );
  return (
    <div>
      <div className="mb-2 font-medium text-ink">
        <T en="Flood alerts" bn="বন্যা সতর্কতা" />
      </div>
      <ul className="space-y-1 text-ink-2">
        {Object.entries(FLOOD_ALERT_COLORS).map(([level, c]) => (
          <li key={level} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: c }} />
            <T
              en={`${level === "Green" ? "Minor" : level === "Orange" ? "Serious" : "Severe"} (${level} alert)`}
              bn={`${level === "Green" ? "ছোট" : level === "Orange" ? "গুরুতর" : "ভয়াবহ"} (${level === "Green" ? "সবুজ" : level === "Orange" ? "কমলা" : "লাল"} সতর্কতা)`}
            />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-3">
        <T en="From GDACS (UN/EU), 2000–2025." bn="GDACS (জাতিসংঘ/ইইউ) থেকে, ২০০০–২০২৫।" />
      </p>
    </div>
  );
}
