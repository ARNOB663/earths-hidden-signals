"use client";

// Searchable, filterable country list with the published local areas underneath each country.
// Everything is rendered from the server data passed in; this component only filters and
// expands. A row is a country (ADM0), an ADM1 area or an ADM2 area, each with the shared ID
// every other page uses.

import { ChevronDown, Search, X } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";
import type { SignalCountryData, SignalRowData } from "@/lib/geography/data";
import { T, useLang, useT } from "@/lib/i18n";
import { percentLabel, ROW_STATE, SIGNAL_ORDER, type RowSignal } from "@/lib/signals/states";

type Filter = RowSignal | "all";
type AreaKey = "ADM1" | "ADM2";

const FILTERS: Filter[] = ["all", ...SIGNAL_ORDER];

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

function SignalCells({ row }: { row: SignalRowData }) {
  const t = useT();
  const state = ROW_STATE[row.signal];
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
      <span className={`inline-flex items-center gap-1.5 font-medium ${state.className}`}>
        <Watermark signal={row.signal} />
        {t(state.word.en, state.word.bn)}
      </span>
      <span className="tabular-nums" title={t("Demo score, not a prediction", "ডেমো স্কোর, পূর্বাভাস নয়")}>
        <span className="text-ink-3">{t("Score", "স্কোর")}</span> {percentLabel(row.probability)}
      </span>
      <span className="tabular-nums" title={t("Share of the area covered by usable NASA grid cells", "ব্যবহারযোগ্য নাসা গ্রিড কোষে এলাকার অংশ")}>
        <span className="text-ink-3">{t("Coverage", "আচ্ছাদন")}</span>{" "}
        {row.covered.length === 0 ? t("none", "নেই") : `${row.covered.length}`}
      </span>
    </span>
  );
}

// One heading per published level, in the level's own words: the ADM1 name then the ADM2 name.
// Generic source labels ("ADM2 areas") stay labelled as such instead of being renamed.
interface AreaRow extends SignalRowData {
  level: AreaKey;
  parentName?: string;
  parentNameBn?: string;
  areaName?: string;
  areaNameBn?: string;
}

function groupAreas(rows: AreaRow[]) {
  return (["ADM1", "ADM2"] as const)
    .map((level) => {
      const members = rows.filter((row) => row.level === level);
      const first = members[0] as AreaRow | undefined;
      return {
        level,
        rows: members,
        labelEn: level === "ADM1" ? (first?.parentName ?? "ADM1") : (first?.areaName ?? "ADM2"),
        labelBn: level === "ADM1" ? (first?.parentNameBn ?? "ADM1") : (first?.areaNameBn ?? "ADM2"),
      };
    })
    .filter((group) => group.rows.length > 0);
}

// The local level's own plural name ("districts", "Gewogs", "Divisions"); generic labels stay
// generic instead of being pluralised.
function areaNoun(country: SignalCountryData): string {
  const name = country.areaName;
  if (/^ADM\d areas$/i.test(name)) return "local areas";
  if (name.toLowerCase().endsWith("s")) return name.toLowerCase();
  return `${name.toLowerCase()}s`;
}

export function CountrySignalList({ countries }: { countries: SignalCountryData[] }) {
  const t = useT();
  const lang = useLang();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<string, AreaKey | null>>({});
  const deferred = useDeferredValue(query);

  const matches = useMemo(() => {
    const needle = deferred.trim().toLocaleLowerCase();
    // Only the language on screen is searched: lowercasing a Bangla name must never match
    // Latin letters that happen to fall out of it.
    const hit = (name: string, nameBn?: string) => {
      if (needle.length === 0) return true;
      const text = lang === "bn" ? (nameBn ?? name) : name;
      return text.toLocaleLowerCase().includes(needle);
    };
    const keep = (row: { signal: RowSignal }) => filter === "all" || row.signal === filter;

    const out = [];
    for (const country of countries) {
      const areaRows = (["ADM1", "ADM2"] as const).flatMap((level) => country.areas[level] ?? []);
      const countryMatches = hit(country.name, country.nameBn) && keep(country);
      const areaMatches = areaRows
        .filter((area) => keep(area) && hit(area.name))
        .map((area) => ({
          ...area,
          level: area.level as AreaKey,
          parentName: country.levels.ADM1?.name,
          parentNameBn: country.levels.ADM1?.nameBn,
          areaName: country.areaName,
          areaNameBn: country.areaNameBn,
        }));
      // A country follows its own match, or its name matches the query and it has matching areas.
      if (!countryMatches && areaMatches.length === 0) continue;
      out.push({ country, countryMatches, areaMatches });
    }
    return out;
  }, [countries, deferred, filter, lang]);

  const total = countries.reduce(
    (sum, country) => sum + 1 + (country.areas.ADM1?.length ?? 0) + (country.areas.ADM2?.length ?? 0),
    0,
  );
  const shown = matches.reduce(
    (sum, match) => sum + (match.countryMatches ? 1 : 0) + match.areaMatches.length,
    0,
  );

  return (
    <section aria-labelledby="directory" className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="directory" className="text-lg font-semibold text-ink">
          {t("Countries and local areas", "দেশ ও স্থানীয় এলাকা")}
        </h2>
        <p className="text-xs text-ink-3 tabular-nums" aria-live="polite" aria-atomic="true">
          {shown === total
            ? t(`${total} areas`, `${total} এলাকা`)
            : t(`${shown} of ${total} areas`, `${total} এর মধ্যে ${shown} এলাকা`)}
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(
              `Search a country, state or district — any published area`,
              `দেশ, রাজ্য বা জেলা — যেকোনো প্রকাশিত এলাকা খুঁজুন`,
            )}
            autoComplete="off"
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
                onClick={() => setFilter(value)}
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
            `No country or area matches. Try another spelling, or clear the filter.`,
            `কোনো দেশ বা এলাকা মেলেনি। অন্য বানান চেষ্টা করুন, বা ছাঁকন মুছুন।`,
          )}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {matches.map(({ country, countryMatches, areaMatches }) => {
            const expanded = countryMatches ? (open[country.id] ?? null) : (areaMatches[0]?.level ?? null);
            const state = ROW_STATE[country.signal];
            const areaCount = areaMatches.length;
            return (
              <li key={country.id} className="overflow-hidden rounded-2xl border border-line bg-card">
                <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setOpen((previous) => ({
                        ...previous,
                        [country.id]: previous[country.id] === "ADM1" ? null : "ADM1",
                      }))
                    }
                    aria-expanded={expanded !== null}
                    aria-controls={`areas-${country.id}`}
                    disabled={!countryMatches}
                    className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg text-left disabled:cursor-default disabled:opacity-50"
                  >
                    <ChevronDown
                      size={18}
                      aria-hidden
                      className={`shrink-0 text-ink-3 transition-transform ${expanded !== null ? "rotate-180" : ""}`}
                    />
                    <span aria-hidden className="text-xl leading-none">
                      {country.flag}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{lang === "bn" ? country.nameBn : country.name}</span>
                      <span className="block text-xs text-ink-3">
                        {countryMatches
                          ? t(
                              `${areaCount} ${areaNoun(country)} listed`,
                              `${areaCount} ${country.areaNameBn} তালিকাভুক্ত`,
                            )
                          : t(
                              `Matching ${country.areaName}s`,
                              `মিলে যাওয়া ${country.areaNameBn}`,
                            )}
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
                      </p>
                    ) : null}
                  </div>
                </div>

                {expanded !== null && (
                  <div id={`areas-${country.id}`} className="border-t border-line bg-sunken/60 px-3 pb-3 pt-2">
                    {areaMatches.length === 0 ? (
                      <p className="py-2 text-sm text-ink-2">
                        {t("No areas match this filter.", "এই ছাঁকনিতে কোনো এলাকা মেলে না।")}
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {groupAreas(areaMatches).map((group) => (
                          <li key={group.level}>
                            <p className="flex flex-wrap items-baseline gap-x-2 px-1 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3" id={`${country.id}-${group.level}`}>
                              <T en={group.labelEn} bn={group.labelBn} />
                              <span className="font-normal normal-case tabular-nums">
                                <T
                                  en={`${group.rows.length} ${group.rows.length === 1 ? "area" : "areas"}`}
                                  bn={`${group.rows.length} এলাকা`}
                                />
                              </span>
                            </p>
                            <ul aria-labelledby={`${country.id}-${group.level}`} className="space-y-1.5">
                              {group.rows.map((area) => (
                                <li
                                  key={area.id}
                                  className="flex min-h-11 flex-col gap-1 rounded-lg bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <span className="min-w-0 break-words text-sm text-ink">{area.name}</span>
                                  <SignalCells row={area} />
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-xs text-ink-3">
        {t(
          "Open a country to see its local areas. Read the signal in the legend above: No data is a gap, not a safe area.",
          "একটি দেশ খুলে তার স্থানীয় এলাকা দেখুন। উপরের নির্দেশিকায় সংকেত পড়ুন: তথ্য নেই মানে ফাঁক, নিরাপদ এলাকা নয়।",
        )}
      </p>
    </section>
  );
}
