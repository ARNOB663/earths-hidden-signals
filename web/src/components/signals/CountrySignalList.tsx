"use client";

// Searchable, filterable global country list. The page ships only the 231 country rows; each
// country's local areas are fetched when the country is opened, so the initial payload stays small
// and the same boundary identifiers every other page uses stay intact.
//
// A row is a country (ADM0), an ADM1 area or an ADM2 area. A level only appears when geoBoundaries
// publishes it for that country; nothing is invented.

import { ChevronDown, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CompactAreaRow, SignalCountryHeader } from "@/lib/geography/data";
import { T, useLang, useT } from "@/lib/i18n";
import { percentLabel, ROW_STATE, SIGNAL_ORDER, type RowSignal } from "@/lib/signals/states";

type Filter = RowSignal | "all";
type AreaKey = "ADM1" | "ADM2";

interface AreaGroup {
  name: string;
  nameBn: string;
  rows: CompactAreaRow[];
}

type CountryAreas = Partial<Record<AreaKey, AreaGroup>>;

type SearchEntry = [
  iso: string,
  level: AreaKey,
  name: string,
  id: string,
  signal: RowSignal,
  layers: number,
];

const FILTERS: Filter[] = ["all", ...SIGNAL_ORDER];
const PAGE = 40;
const AREA_PAGE = 50;

function Watermark({ signal, className = "" }: { signal: RowSignal; className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-2.5 w-2.5 shrink-0 rounded-full ${signal === "no-data" ? "border border-ink-3" : ""} ${className}`}
      style={
        signal === "no-data"
          ? undefined
          : { background: `var(--${signal === "green" ? "good" : signal === "yellow" ? "watch" : "alert"})` }
      }
    />
  );
}

function AreaCells({ row, totalLayers }: { row: CompactAreaRow; totalLayers: number }) {
  const t = useT();
  const [, , signal, probability, layers, cellShare] = row;
  const state = ROW_STATE[signal];
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
      <span className={`inline-flex items-center gap-1.5 font-medium ${state.className}`}>
        <Watermark signal={signal} />
        {t(state.word.en, state.word.bn)}
      </span>
      <span
        className="tabular-nums"
        title={t(
          "Demo probability for the stated event and period, not a prediction",
          "উল্লিখিত ঘটনা ও সময়ের জন্য ডেমো সম্ভাবনা, পূর্বাভাস নয়",
        )}
      >
        <span className="text-ink-3">{t("Score", "স্কোর")}</span> {percentLabel(probability)}
      </span>
      <span title={t("How many of the NASA data layers have usable data here", "এখানে নাসা তথ্য স্তরের কতটিতে ব্যবহারযোগ্য তথ্য আছে")}>
        <span className="text-ink-3">{t("Data", "তথ্য")}</span>{" "}
        <span className="tabular-nums">
          {t(`${layers} of ${totalLayers} layers`, `${totalLayers} স্তরের ${layers}টি`)}
        </span>
        {cellShare !== null && (
          <span
            className="text-ink-3"
            title={t(
              "Share of those layers' grid cells inside the boundary that carry data",
              "সীমানার ভেতরে ওই স্তরগুলোর গ্রিড কোষের কত অংশে তথ্য আছে",
            )}
          >
            {" · "}
            <span className="tabular-nums">{Math.round(cellShare * 100)}%</span> {t("of cells", "কোষ")}
          </span>
        )}
      </span>
    </span>
  );
}

/** "ADM1: 8 Divisions · ADM2: 64 districts", listing only the levels that exist. */
function levelLine(country: SignalCountryHeader): string {
  const parts: string[] = [];
  for (const level of ["ADM1", "ADM2"] as const) {
    const summary = country.levels[level];
    if (!summary) continue;
    parts.push(`${level}: ${summary.count} ${summary.name}`);
  }
  // Not every country publishes a sub-national level; say so rather than leaving the line blank.
  return parts.length > 0 ? parts.join(" · ") : "No local level published (country boundary only)";
}

export function CountrySignalList({
  countries,
  totalLayers,
}: {
  countries: SignalCountryHeader[];
  totalLayers: number;
}) {
  const t = useT();
  const lang = useLang();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<string, AreaKey | null>>({});
  const [areas, setAreas] = useState<Record<string, CountryAreas>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(PAGE);
  const [areaPage, setAreaPage] = useState<Record<string, number>>({});
  const deferred = useDeferredValue(query);
  const cache = useRef<Record<string, CountryAreas>>({});
  const [searchIndex, setSearchIndex] = useState<SearchEntry[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // The full area list (~52,000 names) is fetched once, on the first search, so the page can find
  // any area without shipping them all up front.
  const ensureSearchIndex = async () => {
    if (searchIndex || searchLoading) return;
    setSearchLoading(true);
    try {
      const response = await fetch("/data/signals/area-search.json");
      if (!response.ok) throw new Error(`area search: ${response.status}`);
      const data = (await response.json()) as { areas: SearchEntry[] };
      setSearchIndex(data.areas);
    } finally {
      setSearchLoading(false);
    }
  };

  const resetPaging = () => {
    setPage(PAGE);
    setAreaPage({});
  };

  // Fetch the search index the moment the reader starts typing (not on mount), so the default page
  // load stays light.
  const onQueryChange = (value: string) => {
    setQuery(value);
    resetPaging();
    if (value.trim().length >= 2) void ensureSearchIndex();
  };

  const loadAreas = async (iso: string) => {
    if (cache.current[iso]) {
      setAreas((previous) => ({ ...previous, [iso]: cache.current[iso] }));
      return;
    }
    setLoading((previous) => ({ ...previous, [iso]: true }));
    try {
      const response = await fetch(`/data/signals/areas/${iso}.json`);
      if (!response.ok) throw new Error(`areas ${iso}: ${response.status}`);
      const data = (await response.json()) as CountryAreas;
      cache.current[iso] = data;
      setAreas((previous) => ({ ...previous, [iso]: data }));
    } finally {
      setLoading((previous) => ({ ...previous, [iso]: false }));
    }
  };

  // Bucket the flat search index once, so a keystroke is O(countries + matching names) rather
  // than 231 × 52,000 comparisons.
  const indexByCountry = useMemo(() => {
    const map = new Map<string, { level: AreaKey; name: string; signal: RowSignal; layers: number }[]>();
    for (const [iso, level, name, , signal, layers] of searchIndex ?? []) {
      const list = map.get(iso) ?? [];
      list.push({ level, name, signal, layers });
      map.set(iso, list);
    }
    return map;
  }, [searchIndex]);

  const matches = useMemo(() => {
    const needle = deferred.trim().toLocaleLowerCase();
    // Only the language on screen is searched: lowercasing a Bangla name must never match Latin
    // letters that happen to fall out of it.
    const hit = (name: string, nameBn?: string) => {
      if (needle.length === 0) return true;
      const text = lang === "bn" ? (nameBn ?? name) : name;
      return text.toLocaleLowerCase().includes(needle);
    };
    const keepSignal = (signal: RowSignal) => filter === "all" || signal === filter;

    const out = [];
    for (const country of countries) {
      const loaded = areas[country.code];
      const areaMatches: { level: AreaKey; row: CompactAreaRow }[] = [];
      let indexedMatch = false;
      for (const level of ["ADM1", "ADM2"] as const) {
        const loadedNames = new Set((loaded?.[level]?.rows ?? []).map((row) => row[1]));
        for (const row of loaded?.[level]?.rows ?? []) {
          if (keepSignal(row[2]) && hit(row[1])) areaMatches.push({ level, row });
        }
        // Names from the search index let a search reach a country the reader has not opened. The
        // index says which countries to offer; the real rows appear when the country is expanded.
        const filteringBySignal = filter !== "all";
        if (needle.length > 0 || filteringBySignal) {
          for (const entry of indexByCountry.get(country.code) ?? []) {
            if (entry.level !== level) continue;
            if (loadedNames.has(entry.name)) continue;
            if (filteringBySignal && entry.signal !== filter) continue;
            if (hit(entry.name)) {
              indexedMatch = true;
              break;
            }
          }
        }
      }
      // A country with no loaded areas still matches by name so it can be opened.
      const countryMatches = hit(country.name, country.nameBn) && keepSignal(country.signal);
      if (!countryMatches && areaMatches.length === 0 && !indexedMatch) continue;
      out.push({ country, countryMatches, areaMatches, loaded: Boolean(loaded), indexedMatch });
    }
    return out;
  }, [countries, areas, deferred, filter, lang, indexByCountry]);

  // Which countries are currently showing a group: opened by a click, or surfaced by a search hit
  // on an area name (which infers a level). Those are the ones whose area file we fetch.
  const openCodes = useMemo(() => {
    const codes: string[] = [];
    for (const match of matches) {
      const inferred = match.countryMatches
        ? (match.indexedMatch ? firstLevel(match.country) : null)
        : firstLevel(match.country);
      const level = open[match.country.id] === undefined ? inferred : open[match.country.id];
      if (level) codes.push(match.country.code);
    }
    return codes.sort().join(",");
  }, [matches, open]);

  useEffect(() => {
    for (const code of openCodes.split(",").filter(Boolean)) {
      if (!cache.current[code] && !loading[code]) void loadAreas(code);
    }
    // loadAreas closes over cache/loading refs; re-running when those change is what we want.
  }, [openCodes, loading]);

  const totalAreas = countries.reduce(
    (sum, country) => sum + (country.levels.ADM1?.count ?? 0) + (country.levels.ADM2?.count ?? 0),
    0,
  );
  const fmt = (value: number) => value.toLocaleString("en");
  const shownCountries = matches.filter((match) => match.countryMatches).length;
  const shownAreas = matches.reduce((sum, match) => sum + match.areaMatches.length, 0);
  const indexMatches = matches.filter((match) => match.indexedMatch).length;
  const filtering = deferred.trim().length > 0 || filter !== "all";
  const visible = matches.slice(0, page);
  const remaining = matches.length - visible.length;

  const toggleCountry = (country: SignalCountryHeader) => {
    setOpen((previous) => {
      const levels = country.levels;
      const hasAdm1 = Boolean(levels.ADM1);
      const hasAdm2 = Boolean(levels.ADM2);
      const current = previous[country.id];
      const next: AreaKey | null =
        current === null || current === undefined
          ? hasAdm1
            ? "ADM1"
            : hasAdm2
              ? "ADM2"
              : null
          : current === "ADM1" && hasAdm2
            ? "ADM2"
            : null;
      return { ...previous, [country.id]: next };
    });
  };

  return (
    <section aria-labelledby="directory" className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="directory" className="text-lg font-semibold text-ink">
          {t("Countries and local areas", "দেশ ও স্থানীয় এলাকা")}
        </h2>
        <p className="text-xs text-ink-3 tabular-nums" aria-live="polite" aria-atomic="true">
          {!filtering
            ? t(
                `${fmt(countries.length)} countries · ${fmt(totalAreas)} local areas`,
                `${fmt(countries.length)} দেশ · ${fmt(totalAreas)} স্থানীয় এলাকা`,
              )
            : indexMatches > 0
              ? t(
                  `${fmt(shownCountries)} of ${fmt(countries.length)} countries · ${fmt(shownAreas)} matching areas in open countries · ${fmt(indexMatches)} more countries have a matching area name`,
                  `${fmt(countries.length)} দেশের মধ্যে ${fmt(shownCountries)}টি · খোলা দেশে ${fmt(shownAreas)}টি মিলে যাওয়া এলাকা · আরও ${fmt(indexMatches)}টি দেশে মিলে যাওয়া এলাকার নাম আছে`,
                )
              : t(
                  `${fmt(shownCountries)} of ${fmt(countries.length)} countries · ${fmt(shownAreas)} matching local areas`,
                  `${fmt(countries.length)} দেশের মধ্যে ${fmt(shownCountries)}টি · ${fmt(shownAreas)} মিলে যাওয়া স্থানীয় এলাকা`,
                )}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            {t("Search a country or area", "দেশ বা এলাকা খুঁজুন")}
          </label>
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("Search a country, state, district or county", "দেশ, রাজ্য, জেলা বা কাউন্টি খুঁজুন")}
            autoComplete="off"
            className="min-h-11 w-full rounded-full border border-line bg-card pl-10 pr-10 text-sm text-ink placeholder:text-ink-3"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                resetPaging();
              }}
              aria-label={t("Clear search", "অনুসন্ধান মুছুন")}
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-ink"
            >
              <X size={16} aria-hidden />
            </button>
          )}
          {/* type="search" already shows the browser's native clear button; hide it so there is one. */}
          <style>{`#${searchId}::-webkit-search-cancel-button{display:none}`}</style>
        </div>

        <div role="group" aria-label={t("Filter by signal", "সংকেত অনুযায়ী ছাঁকুন")} className="flex flex-wrap gap-1.5">
          {FILTERS.map((value) => {
            const label =
              value === "all"
                ? t("All", "সব")
                : value === "no-data"
                  ? t("No data", "তথ্য নেই")
                  : t(ROW_STATE[value].word.en, ROW_STATE[value].word.bn);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  resetPaging();
                  if (value !== "all") void ensureSearchIndex();
                }}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
                  filter === value
                    ? "border-accent bg-accent-soft font-medium text-ink"
                    : "border-line bg-card text-ink-2 hover:text-ink"
                }`}
              >
                {value !== "all" && <Watermark signal={value} />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {matches.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-sunken p-4 text-sm text-ink-2">
          {t(
            "No country or area matches. Try another spelling, or clear the filter.",
            "কোনো দেশ বা এলাকা মেলেনি। অন্য বানান চেষ্টা করুন, বা ছাঁকন মুছুন।",
          )}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map(({ country, countryMatches, areaMatches, loaded, indexedMatch }) => {
            const inferred = countryMatches
              ? (indexedMatch ? firstLevel(country) : null)
              : (areaMatches[0]?.level ?? firstLevel(country));
            const expanded = open[country.id] === undefined ? inferred : open[country.id];
            const state = ROW_STATE[country.signal];
            const levels = country.levels;
            const hasAreas = Boolean(levels.ADM1 || levels.ADM2);
            const file = areas[country.code];
            const group = expanded ? file?.[expanded] : undefined;
            const limit = areaPage[country.id] ?? AREA_PAGE;
            const rows = group
              ? group.rows.filter((row) => (filter === "all" || row[2] === filter) && matchesName(row[1], deferred))
              : [];
            const shownRows = rows.slice(0, limit);
            const more = rows.length - shownRows.length;
            return (
              <li key={country.id} className="overflow-hidden rounded-2xl border border-line bg-card">
                <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => toggleCountry(country)}
                    aria-expanded={expanded !== null}
                    aria-controls={`areas-${country.id}`}
                    disabled={!countryMatches || !hasAreas}
                    className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg text-left disabled:cursor-default"
                  >
                    <ChevronDown
                      size={18}
                      aria-hidden
                      className={`shrink-0 text-ink-3 transition-transform ${
                        expanded !== null ? "rotate-180" : ""
                      } ${!hasAreas && countryMatches ? "invisible" : ""}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{lang === "bn" ? country.nameBn : country.name}</span>
                      <span className="block text-xs text-ink-3">
                        {countryMatches ? levelLine(country) : t("Matching areas", "মিলে যাওয়া এলাকা")}
                      </span>
                    </span>
                  </button>
                  <div className="pl-8 sm:pl-0">
                    {countryMatches ? (
                      <p className={`text-sm font-medium ${state.className}`}>
                        <span className="inline-flex items-center gap-1.5">
                          <Watermark signal={country.signal} />
                          {t(state.word.en, state.word.bn)}
                          <span className="font-normal tabular-nums text-ink-2">
                            {country.probability === null ? "" : `· ${percentLabel(country.probability)}`}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-ink-3">
                          {country.coverage.childAreasTotal
                            ? country.coverage.childAreasCovered === country.coverage.childAreasTotal
                              ? t(
                                  `NASA data for all ${country.coverage.childAreasTotal} ADM1 areas`,
                                  `${country.coverage.childAreasTotal}টি ADM1 এলাকার সবগুলোতে নাসা তথ্য`,
                                )
                              : (country.coverage.childAreasCovered ?? 0) === 0
                                ? t(
                                    `No measured NASA data in any of ${country.coverage.childAreasTotal} ADM1 areas`,
                                    `${country.coverage.childAreasTotal}টি ADM1 এলাকার কোনোটিতেই মাপা নাসা তথ্য নেই`,
                                  )
                                : t(
                                    `Partial: NASA data for ${country.coverage.childAreasCovered} of ${country.coverage.childAreasTotal} ADM1 areas`,
                                    `আংশিক: ${country.coverage.childAreasTotal}টি ADM1 এলাকার ${country.coverage.childAreasCovered}টিতে নাসা তথ্য`,
                                  )
                            : t("No measured NASA data here", "এখানে মাপা নাসা তথ্য নেই")}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>

                {expanded !== null && (
                  <div id={`areas-${country.id}`} className="border-t border-line bg-sunken/60 px-3 pb-3 pt-2">
                    {!loaded && !group ? (
                      <p className="py-2 text-sm text-ink-2" role="status">
                        {t("Loading local areas…", "স্থানীয় এলাকা লোড হচ্ছে…")}
                      </p>
                    ) : rows.length === 0 ? (
                      <p className="py-2 text-sm text-ink-2">
                        {t("No areas match this filter.", "এই ছাঁকনিতে কোনো এলাকা মেলে না।")}
                      </p>
                    ) : (
                      <div>
                        <p
                          className="flex flex-wrap items-baseline gap-x-2 px-1 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3"
                          id={`${country.id}-${expanded}`}
                        >
                          <T en={group?.name ?? expanded} bn={group?.nameBn ?? expanded} />
                          <span className="font-normal normal-case tabular-nums">
                            <T
                              en={`${rows.length} ${rows.length === 1 ? "area" : "areas"}`}
                              bn={`${rows.length} এলাকা`}
                            />
                          </span>
                        </p>
                        <ul aria-labelledby={`${country.id}-${expanded}`} className="space-y-1.5">
                          {shownRows.map((row) => (
                            <li
                              key={row[0]}
                              className="flex min-h-11 flex-col gap-1 rounded-lg bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="min-w-0 break-words text-sm text-ink">{row[1]}</span>
                              <AreaCells row={row} totalLayers={totalLayers} />
                            </li>
                          ))}
                        </ul>
                        {more > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setAreaPage((previous) => ({
                                ...previous,
                                [country.id]: (previous[country.id] ?? AREA_PAGE) + AREA_PAGE,
                              }))
                            }
                            className="mt-1.5 min-h-10 w-full rounded-lg border border-line bg-card px-3 text-xs text-ink-2 hover:text-ink"
                          >
                            {t(
                              `Show ${Math.min(more, AREA_PAGE)} more of ${rows.length}`,
                              `${rows.length}টির মধ্যে আরও ${Math.min(more, AREA_PAGE)}টি দেখুন`,
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setPage((value) => value + PAGE)}
          className="mt-3 min-h-11 w-full rounded-xl border border-line bg-card px-4 text-sm font-medium text-ink-2 hover:text-ink"
        >
          {t(`Show ${Math.min(remaining, PAGE)} more countries`, `আরও ${Math.min(remaining, PAGE)}টি দেশ দেখান`)}
        </button>
      )}

      <p className="mt-3 text-xs text-ink-3">
        {t(
          "Open a country to see the local levels geoBoundaries publishes for it. No data is a gap, never a safe area.",
          "একটি দেশ খুলে geoBoundaries যে স্থানীয় স্তর প্রকাশ করে তা দেখুন। তথ্য নেই মানে ফাঁক, নিরাপদ এলাকা নয়।",
        )}
      </p>
    </section>
  );
}

/** The first level this country publishes, so a search hit can open the right group. */
function firstLevel(country: SignalCountryHeader): AreaKey | null {
  if (country.levels.ADM1) return "ADM1";
  if (country.levels.ADM2) return "ADM2";
  return null;
}

// geoBoundaries publishes one name per area; it is matched against whatever language is on screen.
function matchesName(name: string, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) return true;
  return name.toLocaleLowerCase().includes(needle);
}
