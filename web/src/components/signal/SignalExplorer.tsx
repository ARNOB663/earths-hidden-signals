"use client";

// /signal: one list, one map, one ranking. Search by country or district, filter by coverage
// state, Watch Level or Data Trust Grade, and open any location. The map draws exactly the rows
// the list shows, so a badge can never describe a different set.

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronRight, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { MapLoading } from "@/components/map/MapLoading";
import { bnNum } from "@/lib/bn";
import { T, useLang, useT } from "@/lib/i18n";
import type { CoverageState, WatchLevel } from "@/lib/signals/level";
import type { SignalRow } from "@/lib/signals/model";
import type { SignalMapArea } from "./SignalMap";
import { CoverageBadge, TrustBadge, WatchBadge } from "./levels";

// A definite height, not a percentage. Leaflet measures its container when the map is created, so
// the map's own box must have a pixel height the first time it paints; otherwise its canvas is
// sized against zero and stays blank. Both the loading placeholder and the map share this box.
const MAP_BOX = "h-[380px] w-full sm:h-[440px]";
const SignalMap = dynamic(() => import("./SignalMap"), {
  ssr: false,
  loading: () => (
    <div className={`${MAP_BOX} overflow-hidden rounded-2xl border border-line`}>
      <MapLoading />
    </div>
  ),
});

const PAGE = 40;

type LevelFilter = WatchLevel | "all";
type CoverageFilter = CoverageState | "all";

function rank(row: SignalRow): number {
  if (row.watch === "high") return 0;
  if (row.watch === "elevated") return 1;
  if (row.coverage === "live") return 2;
  if (row.coverage === "seasonal") return 3;
  return 4;
}

function RowDot({ row }: { row: SignalRow }) {
  const color =
    row.watch === "high" ? "var(--alert)" : row.watch === "elevated" ? "var(--watch)" : row.coverage === "live" ? "#8a9a8a" : undefined;
  return (
    <span
      aria-hidden
      className={`block h-2.5 w-2.5 shrink-0 rounded-full ${color ? "" : "border border-ink-3"}`}
      style={color ? { background: color } : undefined}
    />
  );
}

export function SignalExplorer({
  rows,
  areas,
  countries,
  initialId,
}: {
  rows: SignalRow[];
  areas: SignalMapArea[];
  countries: { code: string; name: string; nameBn: string }[];
  initialId: string | null;
}) {
  const t = useT();
  const lang = useLang();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [coverage, setCoverage] = useState<CoverageFilter>("all");
  const [country, setCountry] = useState<string>("all");
  const [page, setPage] = useState(PAGE);
  const [selected, setSelected] = useState<string | null>(initialId);
  const [geo, setGeo] = useState<"idle" | "asking" | "nearby" | "outside" | "denied">("idle");
  const deferred = useDeferredValue(query);
  const listRef = useRef<HTMLOListElement | null>(null);

  // The map opens on where the data actually is: the bounding box of the listed boundaries, not a
  // fixed view. It is computed from the outlines the server already sent, so no extra request.
  const home = useMemo<{ bounds: [[number, number], [number, number]] } | null>(() => {
    let south = 90;
    let north = -90;
    let west = 180;
    let east = -180;
    for (const area of areas) {
      for (const ring of area.rings) {
        for (const [lon, lat] of ring) {
          if (lat < south) south = lat;
          if (lat > north) north = lat;
          if (lon < west) west = lon;
          if (lon > east) east = lon;
        }
      }
    }
    if (south > north || west > east) return null;
    return { bounds: [[south, west], [north, east]] };
  }, [areas]);

  const counts = useMemo(() => {
    const out = { live: 0, seasonal: 0, "cant-tell": 0, high: 0, elevated: 0, none: 0, unknown: 0 };
    for (const row of rows) {
      out[row.coverage] += 1;
      out[row.watch] += 1;
    }
    return out;
  }, [rows]);

  const countryOptions = useMemo(() => {
    const codes = new Set(rows.map((row) => row.country));
    return countries.filter((c) => codes.has(c.code));
  }, [rows, countries]);

  const filtered = useMemo(() => {
    const needle = deferred.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (level !== "all" && row.watch !== level) return false;
      if (coverage !== "all" && row.coverage !== coverage) return false;
      if (country !== "all" && row.country !== country) return false;
      if (needle && !`${row.name} ${row.countryName} ${row.id}`.toLocaleLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, level, coverage, country, deferred]);

  const ordered = useMemo(
    () => [...filtered].sort((a, b) => rank(a) - rank(b) || a.countryName.localeCompare(b.countryName) || a.name.localeCompare(b.name)),
    [filtered],
  );
  const shown = ordered.slice(0, page);
  // The map draws exactly the boundaries of the rows on the current page (state rings and the
  // smaller district fills). A filtered page of districts from a state that itself isn't listed
  // draws that state's ring, so the page's locations never hover over an empty base map.
  const mapAreas = useMemo(() => {
    const shownIds = new Set(shown.map((row) => row.id));
    const states = new Set(shown.filter((row) => row.level === "ADM1").map((row) => row.name.split(" · ")[0]));
    const byName = new Map(areas.map((area) => [`${area.level}:${area.name}`, area]));
    const samples = new Set(shown.filter((row) => row.sample).map((row) => row.id));
    const out: SignalMapArea[] = [];
    const usedStates = new Set<string>();
    for (const area of areas) {
      if (shownIds.has(area.id)) out.push({ ...area, sample: samples.has(area.id) });
    }
    for (const row of shown) {
      if (row.level === "ADM1") continue;
      const state = row.name.split(" · ")[0];
      if (states.has(state) || usedStates.has(state)) continue;
      const parent = byName.get(`ADM1:${state}`);
      if (!parent) continue;
      usedStates.add(state);
      out.push({ ...parent, outlineOf: { id: parent.id, name: parent.name, level: parent.level }, sample: row.sample });
    }
    return out;
  }, [areas, shown]);
  const focus = useMemo<[number, number] | null>(() => {
    const row = rows.find((candidate) => candidate.id === selected);
    return row ? row.centre : null;
  }, [rows, selected]);

  const countryName = (code: string) => {
    const entry = countries.find((c) => c.code === code);
    return entry ? (lang === "bn" ? entry.nameBn : entry.name) : code;
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setGeo("denied");
      return;
    }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        let best: SignalRow | null = null;
        let bestDistance = Infinity;
        for (const row of rows) {
          const d = (row.centre[0] - latitude) ** 2 + (row.centre[1] - longitude) ** 2;
          if (d < bestDistance) {
            best = row;
            bestDistance = d;
          }
        }
        if (!best || Math.sqrt(bestDistance) > 1.5) {
          setGeo("outside");
          return;
        }
        setSelected(best.id);
        setGeo("nearby");
        document.getElementById(`sig-${best.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      },
      () => setGeo("denied"),
      { timeout: 8000, maximumAge: 300_000 },
    );
  };

  useEffect(() => {
    if (!selected) return;
    const node = document.getElementById(`sig-${selected}`);
    node?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const reset = () => {
    setQuery("");
    setLevel("all");
    setCoverage("all");
    setCountry("all");
    setPage(PAGE);
  };

  const activeFilters = level !== "all" || coverage !== "all" || country !== "all" || query.trim().length > 0;

  return (
    <section aria-labelledby="explore" className="mt-6">
      <h2 id="explore" className="sr-only">
        <T en="Search the covered areas" bn="আচ্ছাদিত এলাকা খুঁজুন" />
      </h2>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <label htmlFor={searchId} className="sr-only">
              <T en="Search a country or district" bn="দেশ বা জেলা খুঁজুন" />
            </label>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(PAGE);
              }}
              autoComplete="off"
              placeholder={t("Country, state or district", "দেশ, রাজ্য বা জেলা")}
              className="min-h-11 w-full rounded-full border border-line bg-card pl-10 pr-10 text-sm text-ink placeholder:text-ink-3"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("Clear search", "অনুসন্ধান মুছুন")}
                className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-ink"
              >
                <X size={16} aria-hidden />
              </button>
            )}
            <style>{`#${searchId}::-webkit-search-cancel-button{display:none}`}</style>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              <T en="Country" bn="দেশ" />
              <select
                value={country}
                onChange={(event) => {
                  setCountry(event.target.value);
                  setPage(PAGE);
                }}
                className="min-h-10 rounded-lg border border-line bg-card px-2 text-sm text-ink"
              >
                <option value="all">{t("All countries", "সব দেশ")}</option>
                {countryOptions.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {lang === "bn" ? entry.nameBn : entry.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              <T en="Coverage" bn="আচ্ছাদন" />
              <select
                value={coverage}
                onChange={(event) => {
                  setCoverage(event.target.value as CoverageFilter);
                  setPage(PAGE);
                }}
                className="min-h-10 rounded-lg border border-line bg-card px-2 text-sm text-ink"
              >
                <option value="all">{t("Any coverage state", "যেকোনো আচ্ছাদন")}</option>
                <option value="live">{t("Live Signal", "সরাসরি সংকেত")}</option>
                <option value="seasonal">{t("Seasonal Context Only", "কেবল মৌসুমি প্রেক্ষাপট")}</option>
                <option value="cant-tell">{t("Can't Tell Here", "এখানে বলা সম্ভব নয়")}</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Filter by Watch Level", "সতর্কতার মাত্রা অনুযায়ী ছাঁকুন")}>
            {(["all", "high", "elevated", "none", "unknown"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={level === value}
                onClick={() => {
                  setLevel(value);
                  setPage(PAGE);
                }}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
                  level === value ? "border-accent bg-accent-soft font-medium text-ink" : "border-line bg-card text-ink-2 hover:text-ink"
                }`}
              >
                {value === "all"
                  ? t("All", "সব")
                  : value === "high"
                    ? t("High", "উচ্চ")
                    : value === "elevated"
                      ? t("Elevated", "বর্ধিত")
                      : value === "none"
                        ? t("Not elevated", "উচ্চতর নয়")
                        : t("Can't tell", "বলা যায় না")}
                <span className="tabular-nums text-ink-3">
                  {value === "all" ? rows.length : counts[value]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={locate}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm text-ink-2 hover:text-ink"
            >
              <LocateFixed size={15} aria-hidden />
              <T en="Use my location" bn="আমার অবস্থান" />
            </button>
            {activeFilters && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm text-ink-2 hover:text-ink"
              >
                <X size={15} aria-hidden />
                <T en="Clear filters" bn="ছাঁকন মুছুন" />
              </button>
            )}
          </div>
          <p role="status" aria-live="polite" className="min-h-4 text-xs text-ink-3">
            {geo === "asking" && t("Asking your browser for your location…", "ব্রাউজারের কাছে অবস্থান চাওয়া হচ্ছে…")}
            {geo === "nearby" && t("Nearest covered area selected.", "নিকটতম আচ্ছাদিত এলাকা বাছা হয়েছে।")}
            {geo === "denied" && t("Location was not available. Search by name instead.", "অবস্থান পাওয়া যায়নি। নাম দিয়ে খুঁজুন।")}
            {geo === "outside" && t("You are outside the covered tiles; only South Asia has rain data here.", "আপনি আচ্ছাদিত টাইলের বাইরে; এখানে কেবল দক্ষিণ এশিয়ার বৃষ্টি-তথ্য আছে।")}
          </p>
        </div>

        <div>
          <div className={`${MAP_BOX} overflow-hidden rounded-2xl border border-line`}>
            <SignalMap
              areas={mapAreas}
              selected={selected}
              onSelect={(id) => setSelected(id || null)}
              focus={focus}
              home={home?.bounds ?? null}
              height="h-[380px] sm:h-[440px]"
            />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
            <MapPin size={12} aria-hidden />
            {t(
              `Coverage: ${rows.length} areas on a ${home ? "map zoomed to their bounds" : "map"} · sample readings are labelled on hover`,
              `আচ্ছাদন: ${bnNum(rows.length)}টি এলাকা${home ? " তাদের সীমার ভেতরে জুম করা মানচিত্রে" : " মানচিত্রে"} · নমুনা পাঠ হোভারে চিহ্নিত`,
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">
          <T en="Locations" bn="স্থান" />
        </h3>
        <p className="text-xs tabular-nums text-ink-3" aria-live="polite">
          {t(
            `Showing ${ordered.length} of ${rows.length} covered locations`,
            `${bnNum(rows.length)}টি আচ্ছাদিত স্থানের মধ্যে ${bnNum(ordered.length)}টি দেখানো হচ্ছে`,
          )}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-sunken p-4 text-sm text-ink-2">
          <T
            en="No covered location matches. Search a country or district in South Asia, or clear the filters."
            bn="কোনো আচ্ছাদিত স্থান মেলেনি। দক্ষিণ এশিয়ার কোনো দেশ বা জেলা খুঁজুন, বা ছাঁকন মুছুন।"
          />
        </p>
      ) : (
        <ol ref={listRef} className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
          {shown.map((row) => (
            <li key={row.id} id={`sig-${row.id}`} className={selected === row.id ? "bg-sunken/60" : ""}>
              <button
                type="button"
                onClick={() => setSelected(row.id)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-sunken/40"
                aria-label={t(`Open ${row.name}, ${row.countryName}`, `${row.name}, ${row.countryName} খুলুন`)}
              >
                <RowDot row={row} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {row.name} <span className="font-normal text-ink-3">· {lang === "bn" ? row.countryBn : countryName(row.country)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {row.level} · {row.tileLabel}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <CoverageBadge state={row.coverage} />
                  {row.coverage === "live" && <WatchBadge level={row.watch} compact />}
                  <TrustBadge grade={row.trust} />
                </span>
                <ChevronRight size={16} aria-hidden className="text-ink-3" />
              </button>
              {selected === row.id && <RowDetail row={row} />}
            </li>
          ))}
        </ol>
      )}

      {ordered.length > shown.length && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setPage((value) => value + PAGE)}
            className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-sm text-ink-2 hover:text-ink"
          >
            <T en={`Show ${Math.min(PAGE, ordered.length - shown.length)} more`} bn={`আরও ${bnNum(Math.min(PAGE, ordered.length - shown.length))}টি দেখুন`} />
          </button>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-3">
        <MapPin size={12} aria-hidden className="mr-1 inline" />
        <T
          en="Boundaries cover every listed area; rain readings only exist inside the three South Asia tiles. A listed area without a reading is shown as Seasonal Context Only or Can't Tell Here, with the reason."
          bn="সীমানা প্রতিটি তালিকাভুক্ত এলাকা ঢাকে; বৃষ্টির পাঠ কেবল দক্ষিণ এশিয়ার তিনটি টাইলে আছে। পাঠহীন এলাকা ‘কেবল মৌসুমি প্রেক্ষাপট’ বা ‘এখানে বলা সম্ভব নয়’ হিসেবে কারণসহ দেখানো হয়।"
        />
      </p>
    </section>
  );
}

/** The row's own numbers, in place: no navigation needed for the summary. */
function RowDetail({ row }: { row: SignalRow }) {
  const lang = useLang();
  const t = useT();
  const fmt = (value: number | null | undefined) => (value === null || value === undefined ? "–" : value.toFixed(1));
  return (
    <div className="border-t border-line px-4 pb-4 pt-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] text-ink-3">
            <T en="1-day rain" bn="১ দিনের বৃষ্টি" />
          </dt>
          <dd className="text-sm font-medium tabular-nums text-ink">{fmt(row.rain.day1)} mm</dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-3">
            <T en="3-day rain" bn="৩ দিনের বৃষ্টি" />
          </dt>
          <dd className="text-sm font-medium tabular-nums text-ink">{fmt(row.rain.day3)} mm</dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-3">
            <T en="vs date normal" bn="তারিখের স্বাভাবিকের তুলনায়" />
          </dt>
          <dd className="text-sm font-medium tabular-nums text-ink">{row.ratio === null ? "–" : `${row.ratio.toFixed(1)}×`}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-3">
            <T en="Observed" bn="পর্যবেক্ষণ" />
          </dt>
          <dd className="text-sm font-medium tabular-nums text-ink">{row.observed ? row.observed.slice(0, 10) : "–"}</dd>
        </div>
      </dl>
      {row.sample && (
        <p role="status" className="mt-2 rounded-lg border border-watch bg-watch-soft px-2.5 py-1.5 text-xs text-watch">
          <T
            en="SAMPLE READING — fixed sample numbers on a fixed date, not a live NASA IMERG observation."
            bn="নমুনা পাঠ — নির্দিষ্ট তারিখে স্থির নমুনা সংখ্যা, বাস্তব নাসা IMERG পর্যবেক্ষণ নয়।"
          />
        </p>
      )}
      <p className="mt-2 text-xs text-ink-2">
        {lang === "bn" ? row.coverageReason.bn : row.coverageReason.en}
      </p>
      {row.frequency.state === "ok" && row.frequency.level && (
        <p className="mt-1 text-xs text-ink-2">
          <T
            en={`Historical frequency at or above ${row.frequency.level.mm} mm: floods catalogued in ${row.frequency.level.floods} of ${row.frequency.level.cases} cases (95% interval ${(row.frequency.level.low * 100).toFixed(0)}–${(row.frequency.level.high * 100).toFixed(0)}%).`}
            bn={`${row.frequency.level.mm} মিমি বা তার বেশি বৃষ্টিতে: ${row.frequency.level.cases}টি ক্ষেত্রে ${row.frequency.level.floods}টিতে বন্যা নথিভুক্ত (৯৫% ব্যবধান ${(row.frequency.level.low * 100).toFixed(0)}–${(row.frequency.level.high * 100).toFixed(0)}%)।`}
          />
        </p>
      )}
      <Link
        href={`/signal/${row.id}`}
        className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-accent-strong underline decoration-line underline-offset-2 hover:decoration-current"
      >
        {t("Open the full Signal", "সম্পূর্ণ সংকেত দেখুন")}
        <ChevronRight size={15} aria-hidden />
      </Link>
    </div>
  );
}
