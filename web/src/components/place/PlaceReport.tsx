"use client";

// A climate report for any place on Earth: its own warming stripes, what changed since 1981, what
// NASA's projections say for 2041–2060, disasters recorded nearby, and what to prepare for.
// Everything is read from the committed data in /data/global/; place names come from Open-Meteo.

import { useEffect, useMemo, useRef, useState } from "react";
import { WarmingStripes } from "@/components/home/WarmingStripes";
import { bnNum } from "@/lib/bn";
import { T, useLang } from "@/lib/i18n";
import { downloadCard } from "./drawCard";
import {
  computeReport,
  findTwin,
  geocode,
  loadData,
  loadStripes,
  RADIUS_KM,
  signed,
  type Data,
  type Place,
  type Report,
  type Scenario,
} from "./placeData";

const QUICK: Place[] = [
  { name: "Dhaka", detail: "Bangladesh", lat: 23.81, lon: 90.41 },
  { name: "Lagos", detail: "Nigeria", lat: 6.45, lon: 3.4 },
  { name: "Jakarta", detail: "Indonesia", lat: -6.2, lon: 106.85 },
  { name: "Houston", detail: "United States", lat: 29.76, lon: -95.37 },
  { name: "Madrid", detail: "Spain", lat: 40.42, lon: -3.7 },
  { name: "Lima", detail: "Peru", lat: -12.05, lon: -77.04 },
];

export default function PlaceReport() {
  const lang = useLang();
  const bn = lang === "bn";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [stripes, setStripes] = useState<number[] | null>(null);
  const [scenario, setScenario] = useState<Scenario>("ssp245");
  const [copied, setCopied] = useState(false);
  const [other, setOther] = useState<Place | null>(null);
  const [otherStripes, setOtherStripes] = useState<number[] | null>(null);
  const [cmpQuery, setCmpQuery] = useState("");
  const [cmpResults, setCmpResults] = useState<Place[]>([]);
  const [noTwin, setNoTwin] = useState(false);
  const reportRef = useRef<HTMLElement>(null);

  // Open a shared link: ?lat=..&lon=..&name=..
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const lat = Number(q.get("lat"));
    const lon = Number(q.get("lon"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read a shared link once on load
    if (q.has("lat") && Number.isFinite(lat) && Number.isFinite(lon)) setPlace({ name: q.get("name") || "", detail: q.get("in") || "", lat, lon });
    const lat2 = Number(q.get("lat2"));
    const lon2 = Number(q.get("lon2"));
    if (q.has("lat2") && Number.isFinite(lat2) && Number.isFinite(lon2))
      setOther({ name: q.get("name2") || "", detail: q.get("in2") || "", lat: lat2, lon: lon2, twin: q.get("twin") === "1" });
  }, []);

  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    loadData().then((d) => !cancelled && setData(d));
    loadStripes(place.lat, place.lon).then((v) => !cancelled && setStripes(v));
    reportRef.current?.focus();
    return () => {
      cancelled = true;
    };
  }, [place]);

  useEffect(() => {
    if (!other) return;
    let cancelled = false;
    loadStripes(other.lat, other.lon).then((v) => !cancelled && setOtherStripes(v));
    return () => {
      cancelled = true;
    };
  }, [other]);

  useEffect(() => {
    if (!place) return;
    const q = new URLSearchParams({ lat: place.lat.toFixed(2), lon: place.lon.toFixed(2), name: place.name, in: place.detail });
    if (other) {
      q.set("lat2", other.lat.toFixed(2));
      q.set("lon2", other.lon.toFixed(2));
      q.set("name2", other.name);
      if (other.detail) q.set("in2", other.detail);
      if (other.twin) q.set("twin", "1");
    }
    window.history.replaceState(null, "", `?${q}`);
  }, [place, other]);

  const search = async (e?: React.FormEvent, given?: string) => {
    e?.preventDefault();
    const name = (given ?? query).trim();
    if (name.length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const list = await geocode(name, bn ? "bn" : "en");
      setResults(list);
      if (list.length === 0) setSearchError(bn ? "কোনো জায়গা পাওয়া যায়নি। বানান দেখুন বা কাছের শহর লিখুন।" : "No place found. Check the spelling or try a nearby town.");
    } catch {
      setSearchError(bn ? "জায়গা খোঁজা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।" : "Place search is unavailable. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  };

  // A search handed over from another page: /your-place?q=Sylhet
  useEffect(() => {
    const given = new URLSearchParams(window.location.search).get("q");
    if (!given) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill once from the link
    setQuery(given);
    search(undefined, given);
    // Runs once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPlace({ name: bn ? "আপনার অবস্থান" : "Your location", detail: "", lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setSearchError(bn ? "অবস্থান পাওয়া যায়নি। নাম লিখে খুঁজুন।" : "Your location isn't available. Search by name instead."),
    );
  };

  const report = useMemo(() => (place && data ? computeReport(place, data, scenario) : null), [place, data, scenario]);
  const otherReport = useMemo(() => (other && data ? computeReport(other, data, scenario) : null), [other, data, scenario]);

  const showTwin = () => {
    if (!place || !data) return;
    const t = findTwin(place, data);
    setNoTwin(!t);
    setOther(t);
  };

  const compareSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cmpQuery.trim().length < 2) return;
    try {
      setCmpResults(await geocode(cmpQuery.trim(), bn ? "bn" : "en"));
    } catch {
      setCmpResults([]);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address bar still holds the link */
    }
  };

  const n = (s: string | number) => (bn ? bnNum(String(s)) : String(s));

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-12 sm:px-6 lg:pt-16">
      <h1 className="max-w-[20ch] text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
        <T en="How is the climate changing where you live?" bn="আপনার এলাকায় জলবায়ু কীভাবে বদলাচ্ছে?" />
      </h1>

      <form onSubmit={search} className="mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor="place-q" className="sr-only">
          <T en="Town or city" bn="শহর বা এলাকা" />
        </label>
        <input
          id="place-q"
          name="place"
          type="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={bn ? "শহর বা এলাকার নাম, যেমন সিলেট…" : "Any town or city, e.g. Nairobi…"}
          className="min-h-12 flex-1 rounded-full border border-line bg-card px-5 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={searching}
          className="min-h-12 rounded-full bg-accent-strong px-6 font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {searching ? <T en="Searching…" bn="খোঁজা হচ্ছে…" /> : <T en="Find" bn="খুঁজুন" />}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={useMyLocation} className="rounded-full border border-line px-3 py-1.5 text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
          <T en="Use my location" bn="আমার অবস্থান" />
        </button>
        {QUICK.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => {
              setResults([]);
              setPlace(p);
            }}
            className="rounded-full px-3 py-1.5 text-ink-2 transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {p.name}
          </button>
        ))}
      </div>
      {searchError && (
        <p role="alert" className="mt-3 text-sm text-ink">
          {searchError}
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-3 max-w-2xl divide-y divide-line rounded-2xl border border-line bg-card" aria-label={bn ? "খোঁজার ফল" : "Search results"}>
          {results.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button
                type="button"
                onClick={() => {
                  setResults([]);
                  setPlace(p);
                }}
                className="flex w-full items-baseline justify-between gap-3 px-5 py-3 text-left hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="font-medium text-ink">{p.name}</span>
                <span className="truncate text-sm text-ink-3">{p.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {place && (
        <article ref={reportRef} tabIndex={-1} aria-live="polite" className="mt-14 outline-none">
          <h2 className="text-5xl font-semibold leading-none tracking-tight text-ink sm:text-7xl">{place.name || (bn ? "এই জায়গা" : "This place")}</h2>
          <p className="mt-2 text-sm text-ink-3">
            {place.detail && `${place.detail} `}({n(place.lat.toFixed(2))}°, {n(place.lon.toFixed(2))}°)
          </p>

          <div className="mt-6 h-28 w-full overflow-hidden rounded-xl sm:h-40">
            {stripes ? (
              <WarmingStripes values={stripes} label={`${place.name}: one stripe per year of temperature, 1981 to 2025. Blue years were cooler, red warmer.`} />
            ) : (
              <div className="h-full w-full motion-safe:animate-pulse bg-sunken" />
            )}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-ink-3">
            <span>{n(1981)}</span>
            <span>
              <T en="Each stripe is one year here" bn="প্রতিটি দাগ এখানকার এক বছর" />
            </span>
            <span>{n(2025)}</span>
          </div>

          {!report ? (
            <p className="mt-10 text-ink-3">
              <T en="Loading NASA data…" bn="নাসার তথ্য লোড হচ্ছে…" />
            </p>
          ) : !report.temp ? (
            <p className="mt-10 text-ink-2">
              <T
                en="No land data here. The record covers land from 55°S to 75°N; try a town on land nearby."
                bn="এখানে স্থলভাগের তথ্য নেই। রেকর্ড ৫৫° দক্ষিণ থেকে ৭৫° উত্তরের স্থলভাগ জুড়ে; কাছের কোনো শহর চেষ্টা করুন।"
              />
            </p>
          ) : (
            <>
              <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
                <section>
                  <h3 className="text-lg font-semibold text-ink">
                    <T en="Since 1981" bn="১৯৮১ থেকে" />
                  </h3>
                  <Fact
                    big={`${n(signed(report.temp[2] * 4.4, 1))} °${bn ? "সে" : "C"}`}
                    line={
                      report.temp[3] ? (
                        <T en="warmer, a clear change." bn="বেশি গরম, স্পষ্ট পরিবর্তন।" />
                      ) : (
                        <T en="change in temperature, not yet clear." bn="তাপমাত্রার পরিবর্তন, এখনো স্পষ্ট নয়।" />
                      )
                    }
                  />
                  {report.wet && (
                    <Fact
                      big={`${n(signed(report.wet[2], 0))}%`}
                      line={
                        report.wet[3] ? (
                          <T
                            en={`rainy-season rain every 10 years: clearly ${report.wet[2] > 0 ? "wetter" : "drier"}.`}
                            bn={`প্রতি ১০ বছরে বর্ষার বৃষ্টি: স্পষ্টভাবে ${report.wet[2] > 0 ? "বেশি ভেজা" : "শুষ্ক"}।`}
                          />
                        ) : (
                          <T en="rainy-season rain every 10 years: no clear change yet." bn="প্রতি ১০ বছরে বর্ষার বৃষ্টি: এখনো স্পষ্ট পরিবর্তন নেই।" />
                        )
                      }
                    />
                  )}
                </section>

                <section>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold text-ink">
                      <T en={`By ${data!.future.future[0]}–${data!.future.future[1]}`} bn={`${n(data!.future.future[0])}–${n(data!.future.future[1])} সালের মধ্যে`} />
                    </h3>
                    <div role="radiogroup" aria-label={bn ? "নিঃসরণের পথ" : "Emissions path"} className="flex rounded-full bg-sunken p-0.5 text-xs">
                      {(
                        [
                          ["ssp245", "Middle road", "মাঝামাঝি পথ"],
                          ["ssp585", "High emissions", "উচ্চ নিঃসরণ"],
                        ] as const
                      ).map(([id, en, bnl]) => (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={scenario === id}
                          onClick={() => setScenario(id)}
                          className={`rounded-full px-3 py-1 transition-colors ${scenario === id ? "bg-card font-medium text-ink shadow-soft" : "text-ink-2 hover:text-ink"}`}
                        >
                          <T en={en} bn={bnl} />
                        </button>
                      ))}
                    </div>
                  </div>
                  {report.fut ? (
                    <>
                      <Fact
                        big={`${n(signed(report.fut[4], 1))} °${bn ? "সে" : "C"}`}
                        line={<T en="warmer again, compared with 1995–2014." bn="আরও গরম, ১৯৯৫–২০১৪ সালের তুলনায়।" />}
                      />
                      <Fact
                        big={report.fut[5] >= 0.95 ? (bn ? "প্রতি বছর" : "Every year") : `${n(Math.max(1, Math.round(report.fut[5] * 10)))} ${bn ? "/ ১০ বছর" : "in 10 years"}`}
                        line={<T en="a year as hot as today's hottest in ten." bn="আজকের ১০ বছরে সবচেয়ে গরম বছরের মতো বছর।" />}
                      />
                      <p className="mt-4 text-sm text-ink-2">
                        <T
                          en={`Rainy season ${signed(report.fut[2], 0)}%${report.fut[3] ? ", and the climate models agree." : ", but the climate models disagree."}`}
                          bn={`বর্ষা মৌসুম ${bnNum(signed(report.fut[2], 0))}%${report.fut[3] ? ", আর জলবায়ু মডেলগুলো একমত।" : ", তবে জলবায়ু মডেলগুলো একমত নয়।"}`}
                        />
                      </p>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-ink-3">
                      <T en="No projection for this spot." bn="এই জায়গার জন্য কোনো অনুমান নেই।" />
                    </p>
                  )}
                </section>
              </div>

              <section className="mt-14">
                <h3 className="text-lg font-semibold text-ink">
                  <T en={`Recorded within ${RADIUS_KM} km since ${data!.events.years.gdacs[0]}`} bn={`${n(RADIUS_KM)} কিমির মধ্যে নথিভুক্ত, ${n(data!.events.years.gdacs[0])} থেকে`} />
                </h3>
                <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
                  {(
                    [
                      [0, "flood alerts", "বন্যা সতর্কতা"],
                      [1, "cyclones", "ঘূর্ণিঝড়"],
                      [2, "droughts", "খরা"],
                      [3, "landslides", "ভূমিধস"],
                    ] as const
                  ).map(([k, en, bnl]) => (
                    <div key={k} className="flex flex-col-reverse">
                      <dt className="text-sm text-ink-3">
                        <T en={en} bn={bnl} />
                      </dt>
                      <dd className="text-3xl font-semibold tabular-nums text-ink">{n(report.ev[k])}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <Prepare report={report} />

              <section className="mt-14">
                <h3 className="text-lg font-semibold text-ink">
                  <T en="Compare with another place" bn="অন্য জায়গার সাথে তুলনা" />
                </h3>
                {!other ? (
                  <>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={showTwin}
                        className="rounded-full bg-accent-strong px-5 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <T en="Find its climate twin" bn="এর জলবায়ু-যমজ খুঁজুন" />
                      </button>
                      <form onSubmit={compareSearch} className="flex flex-1 gap-2" role="search">
                        <label htmlFor="cmp-q" className="sr-only">
                          <T en="Another town" bn="অন্য শহর" />
                        </label>
                        <input
                          id="cmp-q"
                          name="compare"
                          type="search"
                          autoComplete="off"
                          spellCheck={false}
                          value={cmpQuery}
                          onChange={(e) => setCmpQuery(e.target.value)}
                          placeholder={bn ? "অথবা অন্য শহর…" : "or another town…"}
                          className="min-h-10 min-w-0 flex-1 rounded-full border border-line bg-card px-4 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
                        />
                        <button type="submit" className="rounded-full border border-line px-4 text-sm text-ink hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent">
                          <T en="Compare" bn="তুলনা" />
                        </button>
                      </form>
                    </div>
                    {noTwin && (
                      <p className="mt-3 text-sm text-ink-2">
                        <T en="No twin for this spot: it has no land data." bn="এই জায়গার কোনো যমজ নেই: এখানে স্থলভাগের তথ্য নেই।" />
                      </p>
                    )}
                    {cmpResults.length > 0 && (
                      <ul className="mt-3 max-w-xl divide-y divide-line rounded-2xl border border-line bg-card">
                        {cmpResults.map((p) => (
                          <li key={`${p.lat},${p.lon}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setCmpResults([]);
                                setOther(p);
                              }}
                              className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent"
                            >
                              <span className="font-medium text-ink">{p.name}</span>
                              <span className="truncate text-ink-3">{p.detail}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <Compare
                    a={{ place, report, stripes }}
                    b={{ place: other, report: otherReport, stripes: otherStripes }}
                    bn={bn}
                    onClear={() => {
                      setOther(null);
                      setOtherStripes(null);
                    }}
                  />
                )}
              </section>

              <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-line pt-6">
                <button
                  type="button"
                  onClick={copy}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {copied ? <T en="Link copied" bn="লিংক কপি হয়েছে" /> : <T en="Copy link to this report" bn="এই রিপোর্টের লিংক কপি করুন" />}
                </button>
                <button
                  type="button"
                  onClick={() => downloadCard({ place, report, stripes, future: data!.future.future, bn })}
                  className="rounded-full bg-accent-strong px-5 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <T en="Download as image" bn="ছবি হিসেবে ডাউনলোড" />
                </button>
                <p className="text-xs text-ink-3">
                  <T
                    en={`NASA GISTEMP, GPCP and NEX-GDDP-CMIP6 (${data!.future.models.length} models); GDACS and NASA's Global Landslide Catalog. Place names: Open-Meteo.`}
                    bn={`নাসা GISTEMP, GPCP ও NEX-GDDP-CMIP6 (${n(data!.future.models.length)}টি মডেল); GDACS ও নাসার গ্লোবাল ল্যান্ডস্লাইড ক্যাটালগ। জায়গার নাম: Open-Meteo।`}
                  />
                </p>
              </div>
            </>
          )}
        </article>
      )}
    </div>
  );
}

function Fact({ big, line }: { big: string; line: React.ReactNode }) {
  return (
    <p className="mt-5">
      <span className="block text-4xl font-semibold tabular-nums tracking-tight text-ink">{big}</span>
      <span className="mt-1 block text-ink-2">{line}</span>
    </p>
  );
}

/** Plain actions that follow from the evidence for this place. Preparation, never a forecast. */
function Prepare({ report }: { report: Report }) {
  const items: { en: string; bn: string }[] = [];
  const hot = report.fut ? report.fut[5] : 0;
  if ((report.temp && report.temp[3]) || hot >= 0.7)
    items.push({
      en: "Heat: plan shade, water and cool rest for the hottest weeks, and check on older neighbours.",
      bn: "গরম: সবচেয়ে গরম সপ্তাহগুলোর জন্য ছায়া, পানি ও ঠান্ডা বিশ্রামের ব্যবস্থা রাখুন, আর বয়স্ক প্রতিবেশীদের খোঁজ নিন।",
    });
  const wetter = report.fut && report.fut[3] && report.fut[2] >= 5;
  const drier = report.fut && report.fut[3] && report.fut[2] <= -5;
  if (wetter || report.ev[0] >= 5)
    items.push({
      en: "Floods: know your nearest flood shelter and a raised route out, and keep drains clear before the rains.",
      bn: "বন্যা: কাছের আশ্রয়কেন্দ্র ও উঁচু পথ জেনে রাখুন, আর বর্ষার আগে নালা পরিষ্কার রাখুন।",
    });
  if (drier || report.ev[2] >= 2)
    items.push({
      en: "Dry spells: store water and consider crops that cope with less rain.",
      bn: "খরা: পানি সংরক্ষণ করুন এবং কম বৃষ্টিতে টিকে থাকে এমন ফসলের কথা ভাবুন।",
    });
  if (report.ev[1] >= 3)
    items.push({
      en: "Cyclones: know your cyclone shelter and what each warning signal means.",
      bn: "ঘূর্ণিঝড়: আশ্রয়কেন্দ্র ও প্রতিটি সতর্ক সংকেতের অর্থ জেনে রাখুন।",
    });
  if (report.ev[3] >= 10)
    items.push({
      en: "Landslides: on slopes, watch for new cracks and leaning trees after heavy rain.",
      bn: "ভূমিধস: ঢালু জায়গায় ভারী বৃষ্টির পর নতুন ফাটল ও হেলে পড়া গাছ খেয়াল করুন।",
    });
  if (items.length === 0) return null;
  return (
    <section className="mt-14">
      <h3 className="text-lg font-semibold text-ink">
        <T en="What to prepare for" bn="কীসের জন্য প্রস্তুত থাকবেন" />
      </h3>
      <ul className="mt-4 max-w-[70ch] space-y-3">
        {items.map((i) => (
          <li key={i.en} className="border-l-2 border-accent pl-4 text-ink">
            <T en={i.en} bn={i.bn} />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-3">
        <T
          en="Based on past trends and NASA projections, not a forecast. Always follow official warnings."
          bn="অতীতের প্রবণতা ও নাসার অনুমানের ভিত্তিতে, পূর্বাভাস নয়। সবসময় সরকারি সতর্কবার্তা মেনে চলুন।"
        />
      </p>
    </section>
  );
}

type Side = { place: Place; report: Report | null; stripes: number[] | null };

/** Two places side by side, row by row: the same facts, so the difference is easy to see. */
function Compare({ a, b, bn, onClear }: { a: Side; b: Side; bn: boolean; onClear: () => void }) {
  const n = (s: string) => (bn ? bnNum(s) : s);
  const deg = bn ? "°সে" : "°C";
  const name = (p: Place) => p.name || (bn ? "এই জায়গা" : "This place");
  const rows: { en: string; bn: string; get: (r: Report) => string }[] = [
    { en: "Warmer since 1981", bn: "১৯৮১ থেকে উষ্ণতা", get: (r) => (r.temp ? `${n(signed(r.temp[2] * 4.4, 1))} ${deg}` : "–") },
    {
      en: "Rainy season, per 10 years",
      bn: "বর্ষা মৌসুম, প্রতি ১০ বছরে",
      get: (r) => (r.wet ? `${n(signed(r.wet[2], 0))}%${r.wet[3] ? "" : bn ? " (অস্পষ্ট)" : " (not clear)"}` : "–"),
    },
    { en: "More warming by 2041–60", bn: "২০৪১–৬০ সালের মধ্যে আরও উষ্ণতা", get: (r) => (r.fut ? `${n(signed(r.fut[4], 1))} ${deg}` : "–") },
    {
      en: "Today's hottest year in ten, then",
      bn: "আজকের ১০ বছরে সবচেয়ে গরম বছর, তখন",
      get: (r) => (r.fut ? (r.fut[5] >= 0.95 ? (bn ? "প্রায় প্রতি বছর" : "almost every year") : bn ? `১০ বছরে ${bnNum(Math.max(1, Math.round(r.fut[5] * 10)))} বার` : `${Math.max(1, Math.round(r.fut[5] * 10))} in 10 years`) : "–"),
    },
    {
      en: `Disasters within ${RADIUS_KM} km`,
      bn: `${bnNum(RADIUS_KM)} কিমির মধ্যে দুর্যোগ`,
      get: (r) => n(String(r.ev.reduce((x, y) => x + y, 0))),
    },
  ];
  return (
    <div className="mt-4">
      {b.place.twin && (
        <p className="max-w-[70ch] text-ink-2">
          <T
            en={`${name(b.place)} is ${name(a.place)}'s climate twin: of all land on Earth more than 1,500 km away, its 1981–2025 warming and rain changes are the closest match. Same trend, different place.`}
            bn={`${name(b.place)} হলো ${name(a.place)}-এর জলবায়ু-যমজ: ১,৫০০ কিমির বেশি দূরের সব স্থলভাগের মধ্যে এর ১৯৮১–২০২৫ সালের উষ্ণতা ও বৃষ্টির পরিবর্তন সবচেয়ে বেশি মেলে। একই প্রবণতা, ভিন্ন জায়গা।`}
          />
        </p>
      )}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr>
              <th scope="col" className="w-1/3 pb-3" />
              {[a, b].map((s) => (
                <th key={`${s.place.lat},${s.place.lon}`} scope="col" className="pb-3 pr-4 align-bottom">
                  <span className="block text-xl font-semibold text-ink">{name(s.place)}</span>
                  <span className="mt-2 block h-8 overflow-hidden rounded-md">
                    {s.stripes ? <WarmingStripes values={s.stripes} label={`${name(s.place)} warming stripes, 1981 to 2025`} /> : <span className="block h-full bg-sunken" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.en} className="border-t border-line">
                <th scope="row" className="py-3 pr-4 text-sm font-normal text-ink-2">
                  <T en={row.en} bn={row.bn} />
                </th>
                {[a, b].map((s) => (
                  <td key={`${row.en}-${s.place.lat}`} className="py-3 pr-4 text-lg font-semibold tabular-nums text-ink">
                    {s.report ? row.get(s.report) : "…"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a.report && b.report && (() => {
        const ta = a.report.ev.reduce((x, y) => x + y, 0);
        const tb = b.report.ev.reduce((x, y) => x + y, 0);
        if (Math.max(ta, tb) < 10 || Math.max(ta, tb) < 3 * Math.max(1, Math.min(ta, tb))) return null;
        return (
          <p className="mt-4 max-w-[70ch] text-ink-2">
            <T
              en="Similar climate change, very different disaster records: where people live and how well they are protected matters as much as the climate."
              bn="একই রকম জলবায়ু পরিবর্তন, খুব ভিন্ন দুর্যোগের রেকর্ড: মানুষ কোথায় থাকে আর কতটা সুরক্ষিত, তা জলবায়ুর মতোই গুরুত্বপূর্ণ।"
            />
          </p>
        );
      })()}
      <button type="button" onClick={onClear} className="mt-4 text-sm font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent">
        <T en="Compare with a different place" bn="অন্য জায়গার সাথে তুলনা করুন" />
      </button>
    </div>
  );
}
