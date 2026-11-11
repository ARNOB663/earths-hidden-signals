"use client";

// World view of Disaster risk: disaster hotspots on every continent, each with its recorded
// events, its changing rainy season, whether its disasters follow the weather, and its
// 2041–2060 outlook. Short by design: pick a hotspot, read four lines.

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CaretDown } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createBaseMap, type BaseMap } from "@/components/map/baseMap";
import { bnNum } from "@/lib/bn";
import { T, useLang } from "@/lib/i18n";
import { cssVar, useTheme } from "@/lib/theme";

type Hazard = "flood" | "drought" | "cyclone" | "landslide";
type Spread = { median: number; min: number; max: number; agree: number | null };

export interface Hotspot {
  id: string;
  name: string;
  hazard: Hazard;
  bbox: [number, number, number, number];
  description: string;
  events: { years: number[]; counts: number[]; total: number; severe: number; notable: { date: string; alert: string; title: string }[] };
  climate: { warming: { perDecade: number; p: number } | null; wetSeason: { perDecade: number; p: number } | null; wetMonths: number[] };
  link: { rho: number; p: number; n: number; linked: boolean } | null;
  future: Record<"ssp245" | "ssp585", Record<"tMean" | "wetSeason" | "wetYear" | "dryYear" | "hotYear", Spread>> | null;
}

export interface Hotspots {
  models: string[];
  future: [number, number];
  regions: Hotspot[];
}

const WORDS: Record<Hazard, { en: string; bn: string; events: [string, string]; token: string }> = {
  flood: { en: "Floods", bn: "বন্যা", events: ["flood alerts", "বন্যা সতর্কতা"], token: "--cool-3" },
  drought: { en: "Droughts", bn: "খরা", events: ["drought alerts", "খরা সতর্কতা"], token: "--warm-3" },
  cyclone: { en: "Cyclones", bn: "ঘূর্ণিঝড়", events: ["cyclones", "ঘূর্ণিঝড়"], token: "--ev-cyclone" },
  landslide: { en: "Landslides", bn: "ভূমিধস", events: ["landslides", "ভূমিধস"], token: "--ev-landslide" },
};
/** Bangla names and one-line descriptions for the hotspots (the data file is English). */
const BN: Record<string, [string, string]> = {
  "bengal-delta": ["গঙ্গা-ব্রহ্মপুত্র-মেঘনা ব-দ্বীপ", "নিচু ব-দ্বীপ, যেখানে তিনটি বড় নদী সাগরে মেশে।"],
  "indus-plain": ["সিন্ধু সমভূমি", "সমতল, ঘন চাষের প্লাবনভূমি; ২০১০ ও ২০২২ সালের মহাবন্যা।"],
  yangtze: ["ইয়াংসি নদীর মধ্য ও নিম্ন অববাহিকা", "চীনের বিশাল নদী অববাহিকা, কোটি কোটি মানুষের বাস।"],
  "sahel-niger": ["সাহেল: নাইজার ও চাদ হ্রদ অববাহিকা", "আধা-শুষ্ক অঞ্চল, যেখানে কয়েক দশকের খরার পর এখন বর্ষার বন্যা হয়।"],
  "central-europe": ["মধ্য ইউরোপ: রাইন ও দানিউব", "২০০২, ২০১৩ ও ২০২১ সালের মতো নদী-বন্যা।"],
  mississippi: ["নিম্ন মিসিসিপি উপত্যকা", "উত্তর আমেরিকার সবচেয়ে বড় নদী অববাহিকার মোহনা।"],
  "horn-of-africa": ["আফ্রিকার শৃঙ্গ", "বছরে দুই বর্ষা; ২০১০ থেকে বারবার বৃষ্টি হয়নি।"],
  "southern-africa": ["দক্ষিণ আফ্রিকা অঞ্চল", "গ্রীষ্মে বৃষ্টির অঞ্চল, এল নিনোর খরায় আক্রান্ত।"],
  philippines: ["ফিলিপাইন", "পৃথিবীতে সবচেয়ে বেশি টাইফুন-আক্রান্ত জায়গাগুলোর একটি।"],
  "caribbean-gulf": ["ক্যারিবীয় ও উপসাগরীয় উপকূল", "আটলান্টিকের হারিকেনের পথ।"],
  "mozambique-madagascar": ["মোজাম্বিক ও মাদাগাস্কার", "দক্ষিণ-পশ্চিম ভারত মহাসাগরের ঘূর্ণিঝড়, যেমন ইডাই (২০১৯)।"],
  "central-america": ["মধ্য আমেরিকা", "খাড়া আগ্নেয় ঢাল আর প্রবল বৃষ্টি।"],
  "northern-andes": ["উত্তর আন্দিজ", "নবীন পর্বত, পাহাড়ের গায়ে ঘনবসতি শহর।"],
  himalaya: ["হিমালয়", "খাড়া বর্ষার ঢাল; বছরে হাজার হাজার ভূমিধস।"],
};
const ORDER: Hazard[] = ["flood", "drought", "cyclone", "landslide"];
const ALPHA = 0.05;

export default function WorldHazards({ data, onZoomSouthAsia }: { data: Hotspots; onZoomSouthAsia: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const base = useRef<BaseMap | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const theme = useTheme();
  const bn = useLang() === "bn";
  const [filter, setFilter] = useState<Hazard | "all">("all");
  const [selected, setSelected] = useState<string>(data.regions.find((r) => r.id === "yangtze")?.id ?? data.regions[0].id);
  const shown = useMemo(() => data.regions.filter((r) => filter === "all" || r.hazard === filter), [data, filter]);
  const region = data.regions.find((r) => r.id === selected) ?? shown[0];
  const nameOf = (r: Hotspot) => (bn && BN[r.id] ? BN[r.id][0] : r.name);

  useEffect(() => {
    const b = createBaseMap(host.current!, { center: [15, 20], zoom: 2 }, theme, "topright");
    // Fit the hotspots into the part of the map the panel doesn't cover.
    const wide = window.innerWidth >= 640;
    b.map.setMinZoom(1); // phones need one more level out to see every continent
    b.map.fitBounds([[-32, -100], [52, 130]], { animate: false, paddingTopLeft: [8, 56], paddingBottomRight: wide ? [400, 8] : [8, Math.round(host.current!.clientHeight * 0.5)] });
    base.current = b;
    layer.current = L.layerGroup().addTo(b.map);
    return () => b.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    base.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    for (const r of shown) {
      const [la0, la1, lo0, lo1] = r.bbox;
      const on = r.id === region?.id;
      const color = cssVar(WORDS[r.hazard].token);
      const rect = L.rectangle(
        [
          [la0, lo0],
          [la1, lo1],
        ],
        { pane: "data", color, weight: on ? 3 : 1.5, fillColor: color, fillOpacity: on ? 0.35 : 0.18, dashArray: on ? undefined : "4 4" },
      );
      rect.bindTooltip(nameOf(r), { sticky: true });
      rect.on("click", () => setSelected(r.id));
      group.addLayer(rect);
    }
    // nameOf only changes with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, region, theme, bn]);

  const num = (s: string | number) => (bn ? bnNum(String(s)) : String(s));

  return (
    <div className="relative h-full">
      <div ref={host} className="absolute inset-0 bg-sunken" />

      <aside className="absolute bottom-3 left-3 right-3 z-[500] max-h-[48%] overflow-y-auto overscroll-contain rounded-2xl bg-card p-4 shadow-soft sm:bottom-auto sm:left-auto sm:right-3 sm:top-16 sm:max-h-[calc(100%-5rem)] sm:w-[380px]">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(["all", ...ORDER] as const).map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={filter === h}
              onClick={() => setFilter(h)}
              className={`rounded-full border px-3 py-1.5 transition-colors ${filter === h ? "border-transparent bg-accent-strong text-accent-ink" : "border-line text-ink-2 hover:text-ink"}`}
            >
              {h === "all" ? <T en="All" bn="সব" /> : <T en={WORDS[h].en} bn={WORDS[h].bn} />}
            </button>
          ))}
        </div>

        <label className="mt-3 block text-xs text-ink-3" htmlFor="hotspot">
          <T en="Hotspot" bn="ঝুঁকিপূর্ণ অঞ্চল" />
        </label>
        <select
          id="hotspot"
          value={region?.id}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink"
        >
          {shown.map((r) => (
            <option key={r.id} value={r.id}>
              {nameOf(r)}
            </option>
          ))}
        </select>

        {region && (
          <div className="mt-4 space-y-4">
            <div>
              <h2 aria-live="polite" className="text-lg font-semibold text-ink">{nameOf(region)}</h2>
              <p className="text-sm text-ink-2">{bn && BN[region.id] ? BN[region.id][1] : region.description}</p>
            </div>

            {/* Events */}
            <div>
              <p className="text-sm text-ink">
                <span className="text-2xl font-semibold tabular-nums">{num(region.events.total.toLocaleString("en-US"))}</span>{" "}
                <T
                  en={`${WORDS[region.hazard].events[0]}, ${region.events.years[0]}–${region.events.years.at(-1)}`}
                  bn={`${WORDS[region.hazard].events[1]}, ${bnNum(region.events.years[0])}–${bnNum(region.events.years.at(-1)!)}`}
                />
              </p>
              <Bars counts={region.events.counts} color={`var(${WORDS[region.hazard].token})`} />
            </div>

            {/* Climate + link, one line each */}
            <ul className="space-y-1.5 text-sm text-ink-2">
              {region.climate.warming && (
                <li>
                  <T
                    en={`Warming ${region.climate.warming.perDecade > 0 ? "+" : ""}${region.climate.warming.perDecade.toFixed(2)} °C per decade${region.climate.warming.p < ALPHA ? " (clear)" : ""}.`}
                    bn={`উষ্ণতা প্রতি দশকে ${region.climate.warming.perDecade > 0 ? "+" : ""}${bnNum(region.climate.warming.perDecade.toFixed(2))} °সে${region.climate.warming.p < ALPHA ? " (স্পষ্ট)" : ""}।`}
                  />
                </li>
              )}
              {region.climate.wetSeason && (
                <li>
                  <T
                    en={`Rainy season ${region.climate.wetSeason.perDecade > 0 ? "+" : ""}${region.climate.wetSeason.perDecade.toFixed(1)}% per decade${region.climate.wetSeason.p < ALPHA ? " (clear)" : " (no clear change)"}.`}
                    bn={`বর্ষা মৌসুম প্রতি দশকে ${region.climate.wetSeason.perDecade > 0 ? "+" : ""}${bnNum(region.climate.wetSeason.perDecade.toFixed(1))}%${region.climate.wetSeason.p < ALPHA ? " (স্পষ্ট)" : " (স্পষ্ট পরিবর্তন নেই)"}।`}
                  />
                </li>
              )}
              <li className="font-medium text-ink">
                {region.link?.linked ? (
                  <T
                    en={`Disasters follow the weather here: more ${WORDS[region.hazard].events[0]} in ${region.hazard === "drought" ? "drier" : "wetter"} years.`}
                    bn={`এখানে দুর্যোগ আবহাওয়ার পিছু নেয়: ${region.hazard === "drought" ? "শুষ্ক" : "ভেজা"} বছরে বেশি ${WORDS[region.hazard].events[1]}।`}
                  />
                ) : region.link ? (
                  <T en="No clear link with the rainy season here." bn="এখানে বর্ষা মৌসুমের সাথে স্পষ্ট যোগসূত্র নেই।" />
                ) : (
                  <T en="Cyclones depend on the ocean, not local rain: no rain link tested." bn="ঘূর্ণিঝড় সাগরের ওপর নির্ভর করে, স্থানীয় বৃষ্টির ওপর নয়: বৃষ্টির যোগসূত্র পরীক্ষা করা হয়নি।" />
                )}
              </li>
            </ul>

            {region.future && <Future region={region} years={data.future} models={data.models.length} />}

            <Link
              href={`/your-place?lat=${((region.bbox[0] + region.bbox[1]) / 2).toFixed(2)}&lon=${((region.bbox[2] + region.bbox[3]) / 2).toFixed(2)}&name=${encodeURIComponent(nameOf(region))}`}
              className="inline-flex min-h-10 items-center text-sm font-medium text-accent hover:underline"
            >
              <T en="Open a full report for this area" bn="এই এলাকার পূর্ণ রিপোর্ট দেখুন" />
            </Link>

            {region.events.notable.length > 0 && (
              <details className="group rounded-xl border border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink">
                  <T en="Biggest recorded events" bn="নথিভুক্ত সবচেয়ে বড় ঘটনা" />
                  <CaretDown size={16} aria-hidden className="text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="space-y-1 border-t border-line px-3 py-2 text-xs text-ink-2">
                  {region.events.notable.map((e, i) => (
                    <li key={i}>
                      <span className="tabular-nums text-ink-3">{e.date}</span> · {e.title}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onZoomSouthAsia}
          className="mt-4 w-full rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <T en="Zoom into South Asia for the full detail" bn="সম্পূর্ণ বিবরণের জন্য দক্ষিণ এশিয়ায় যান" /> <span aria-hidden>→</span>
        </button>
      </aside>
    </div>
  );
}

function Bars({ counts, color }: { counts: number[]; color: string }) {
  const max = Math.max(1, ...counts);
  return (
    <div aria-hidden className="mt-2 flex h-10 items-end gap-px">
      {counts.map((c, i) => (
        <span key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(4, (c / max) * 100)}%`, background: c ? color : "var(--line)" }} />
      ))}
    </div>
  );
}

function Future({ region, years, models }: { region: Hotspot; years: [number, number]; models: number }) {
  const [sc, setSc] = useState<"ssp245" | "ssp585">("ssp245");
  const f = region.future![sc];
  const key = region.hazard === "drought" ? "dryYear" : region.hazard === "cyclone" ? "hotYear" : "wetYear";
  const label = { dryYear: ["Very dry rainy seasons", "অতি শুকনো বর্ষা"], hotYear: ["Very hot years", "অতি গরম বছর"], wetYear: ["Very wet rainy seasons", "অতি ভেজা বর্ষা"] }[key];
  const filled = Math.min(10, Math.max(1, Math.round(f[key].median * 10)));
  return (
    <div className="rounded-xl bg-sunken p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          <T en={`By ${years[0]}–${years[1]}`} bn={`${bnNum(years[0])}–${bnNum(years[1])} সালের মধ্যে`} />
        </p>
        <div className="flex rounded-full bg-card p-0.5 text-xs">
          {(
            [
              ["ssp245", "Middle road", "মাঝামাঝি"],
              ["ssp585", "High emissions", "উচ্চ নিঃসরণ"],
            ] as const
          ).map(([id, en, bnl]) => (
            <button key={id} type="button" aria-pressed={sc === id} onClick={() => setSc(id)} className={`min-h-7 rounded-full px-2.5 py-1 transition-colors ${sc === id ? "bg-accent-strong text-accent-ink" : "text-ink-2 hover:text-ink"}`}>
              <T en={en} bn={bnl} />
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-2">
        <T en={label[0]} bn={label[1]} />
      </p>
      <div className="mt-1 space-y-1 text-xs">
        <DotRow label={<T en="Today" bn="আজ" />} filled={1} />
        <DotRow label={<T en="Then" bn="তখন" />} filled={filled} strong />
      </div>
      <p className="mt-2 text-xs text-ink-2">
        <T
          en={`+${f.tMean.median.toFixed(1)} °C; rainy season ${f.wetSeason.median > 0 ? "+" : ""}${f.wetSeason.median.toFixed(0)}% (${f.wetSeason.agree ?? 0} of ${models} models agree).`}
          bn={`+${bnNum(f.tMean.median.toFixed(1))} °সে; বর্ষা মৌসুম ${f.wetSeason.median > 0 ? "+" : ""}${bnNum(f.wetSeason.median.toFixed(0))}% (${bnNum(models)}টি মডেলের ${bnNum(f.wetSeason.agree ?? 0)}টি একমত)।`}
        />
      </p>
    </div>
  );
}

function DotRow({ label, filled, strong }: { label: React.ReactNode; filled: number; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-ink-2">{label}</span>
      <span aria-hidden className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < filled ? (strong ? "bg-[var(--warm-3)]" : "bg-ink-2") : "border border-line bg-card"}`} />
        ))}
      </span>
      <span className="sr-only">
        <T en={`${filled} of 10`} bn={`১০টির মধ্যে ${bnNum(filled)}টি`} />
      </span>
    </div>
  );
}
