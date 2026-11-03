"use client";

// /signals: one index of the areas inside the covered tiles, with the Now status, the Trust label
// and a link to each area's place page. Search (by name, or by the reader's location), the status
// filter and the Haor/sample-speed shortcuts all filter this one list; the map and the list are
// always drawn from the same rows, so a ranked label can never describe a different set.

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Crosshair, ExternalLink, LocateFixed, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { MapLoading } from "@/components/map/MapLoading";
import { bnNum } from "@/lib/bn";
import { T, useLang, useT } from "@/lib/i18n";
import type { MapArea, MapTile } from "./SignalsMap";

// Leaflet measures its container when created, so the placeholder must already be the map's size;
// a zero-height placeholder leaves the map's canvas stuck at its default 1028 px.
const MAP_BOX = "h-[380px] w-full sm:h-[520px]";

const SignalsMap = dynamic(() => import("./SignalsMap"), {
  ssr: false,
  loading: () => (
    <div className={`${MAP_BOX} overflow-hidden rounded-2xl border border-line`}>
      <MapLoading />
    </div>
  ),
});



type RowSignal = "red" | "yellow" | "green" | "no-data";
type TrustState = "detectable" | "blind-spot" | "no-data";

export interface IndexArea {
  id: string;
  name: string;
  country: string;
  countryName: string;
  level: "ADM1" | "ADM2";
  centre: [number, number];
  tile: string;
  tileLabel: string;
  status: RowSignal;
  trust: TrustState;
  reason: string;
  confidence: string | null;
  /** Carried through to the country list, which links only rows that open a real place. */
  nowState: "measured" | "no-data";
  trustLabel?: string;
}

const STATUS_WORD: Record<RowSignal, { en: string; bn: string; cls: string; soft: string }> = {
  red: { en: "Red", bn: "লাল", cls: "text-alert", soft: "bg-alert-soft" },
  yellow: { en: "Yellow", bn: "হলুদ", cls: "text-watch", soft: "bg-watch-soft" },
  green: { en: "Green", bn: "সবুজ", cls: "text-good", soft: "bg-accent-soft" },
  "no-data": { en: "No data", bn: "তথ্য নেই", cls: "text-ink-3", soft: "bg-sunken" },
};

const TRUST_WORD: Record<TrustState, { en: string; bn: string; cls: string }> = {
  detectable: { en: "Detectable", bn: "শনাক্তযোগ্য", cls: "text-accent-strong" },
  "blind-spot": { en: "Blind spot", bn: "অন্ধ স্থান", cls: "text-watch" },
  "no-data": { en: "No history", bn: "ইতিহাস নেই", cls: "text-ink-3" },
};

const STATUS_ORDER: RowSignal[] = ["red", "yellow", "green", "no-data"];
const PAGE = 40;

function Dot({ status }: { status: RowSignal }) {
  const color =
    status === "red" ? "var(--alert)" : status === "yellow" ? "var(--watch)" : status === "green" ? "var(--good)" : undefined;
  return (
    <span
      aria-hidden
      className={`block h-2.5 w-2.5 shrink-0 rounded-full ${status === "no-data" ? "border border-ink-3" : ""}`}
      style={color ? { background: color } : undefined}
    />
  );
}

/** Prefix of rows worth drawing: the map cannot show text, so it gets small boundaries only. */
function toMapAreas(rows: IndexArea[], outlines: Record<string, MapArea>): MapArea[] {
  const out: MapArea[] = [];
  for (const row of rows) {
    const outline = outlines[row.id];
    if (outline) out.push({ ...outline, status: row.status, trust: row.trust });
  }
  return out;
}

export function SignalsIndex({
  areas,
  mapAreas,
  tiles,
}: {
  areas: IndexArea[];
  mapAreas: Record<string, MapArea>;
  tiles: MapTile[];
}) {
  const t = useT();
  const lang = useLang();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RowSignal | "all">("all");
  const [haor, setHaor] = useState(false);
  const [page, setPage] = useState(PAGE);
  const [selected, setSelected] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ state: "idle" | "asking" | "nearby" | "denied" | "outside"; place?: string }>({
    state: "idle",
  });
  const deferred = useDeferredValue(query);
  const listRef = useRef<HTMLUListElement | null>(null);
  const router = useRouter();

  const counts = useMemo(() => {
    const out: Record<RowSignal, number> = { red: 0, yellow: 0, green: 0, "no-data": 0 };
    for (const area of areas) out[area.status] += 1;
    return out;
  }, [areas]);

  const trustCounts = useMemo(() => {
    const out: Record<TrustState, number> = { detectable: 0, "blind-spot": 0, "no-data": 0 };
    for (const area of areas) out[area.trust] += 1;
    return out;
  }, [areas]);

  const rows = useMemo(() => {
    const needle = deferred.trim().toLocaleLowerCase();
    return areas.filter((area) => {
      if (filter !== "all" && area.status !== filter) return false;
      if (haor && !area.name.toLowerCase().includes("haor")) return false;
      if (needle.length === 0) return true;
      return `${area.name} ${area.countryName} ${area.id}`.toLocaleLowerCase().includes(needle);
    });
  }, [areas, filter, haor, deferred]);

  const shown = rows.slice(0, page);
  // The map draws the same filtered set as the list (capped at the first page's worth so a
  // thousand polygons never ship to one frame), and the label below names the set.
  const mapRow = useMemo(() => toMapAreas(shown, mapAreas), [shown, mapAreas]);

  // Red first, then Yellow, Green, No data: the ranked list the plan asks for.
  const ordered = useMemo(() => {
    const rank = (row: IndexArea) => STATUS_ORDER.indexOf(row.status);
    return [...shown].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [shown]);

  // The plan's "ranked list reorders and the label says which set it describes": the label is
  // derived from the same predicate, never typed by hand.
  const setLabel = (() => {
    const parts: string[] = [];
    if (filter !== "all") parts.push(t(`${STATUS_WORD[filter].en} areas`, `${STATUS_WORD[filter].bn} এলাকা`));
    if (haor) parts.push(t("named Haor", "নামে হাওর"));
    const scope = parts.length ? parts.join(" · ") : t("all covered areas", "সব আচ্ছাদিত এলাকা");
    return t(`Showing ${rows.length} ${scope}`, `${rows.length}টি ${scope}`);
  })();

  const locate = () => {
    if (!navigator.geolocation) {
      setGeo({ state: "denied" });
      return;
    }
    setGeo({ state: "asking" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        let best: IndexArea | null = null;
        let bestDist = Infinity;
        for (const area of areas) {
          const d = (area.centre[0] - latitude) ** 2 + (area.centre[1] - longitude) ** 2;
          if (d < bestDist) {
            best = area;
            bestDist = d;
          }
        }
        // ~1 degree: beyond that the nearest covered area is not "here".
        if (!best || Math.sqrt(bestDist) > 1) {
          setGeo({ state: "outside" });
          return;
        }
        setSelected(best.id);
        setGeo({ state: "nearby", place: best.name });
        // Open the place directly: the reader's own district, not a guess from a list position.
        router.push(`/signals/place?id=${encodeURIComponent(best.id)}`);
      },
      () => setGeo({ state: "denied" }),
      { timeout: 8000, maximumAge: 300_000 },
    );
  };

  // Open the place whose row was drawn: a click on the map selects it and scrolls it into view.
  useEffect(() => {
    if (!selected) return;
    const node = document.getElementById(`sig-${selected}`);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <section aria-labelledby="index" className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="index" className="text-lg font-semibold text-ink">
          <T en="Covered areas" bn="আচ্ছাদিত এলাকা" />
        </h2>
        <p className="text-xs text-ink-3 tabular-nums">
          {t(
            `${areas.length} areas · ${trustCounts.detectable} detectable · ${trustCounts["blind-spot"]} blind spots`,
            `${bnNum(areas.length)} এলাকা · ${bnNum(trustCounts.detectable)} শনাক্তযোগ্য · ${bnNum(trustCounts["blind-spot"])} অন্ধ স্থান`,
          )}{" "}
          ·{" "}
          <Link href="/signals/evidence" className="underline decoration-line underline-offset-2 hover:text-ink">
            {t("What Trust means", "ভরসা মানে কী")}
          </Link>
        </p>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <label htmlFor={searchId} className="sr-only">
              {t("Search a covered area", "আচ্ছাদিত এলাকা খুঁজুন")}
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
              placeholder={t("District, state or country", "জেলা, রাজ্য বা দেশ")}
              autoComplete="off"
              className="min-h-11 w-full rounded-full border border-line bg-card pl-10 pr-10 text-sm text-ink placeholder:text-ink-3"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setPage(PAGE);
                }}
                aria-label={t("Clear search", "অনুসন্ধান মুছুন")}
                className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-ink"
              >
                <X size={16} aria-hidden />
              </button>
            )}
            <style>{`#${searchId}::-webkit-search-cancel-button{display:none}`}</style>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={locate}
              aria-pressed={geo.state === "nearby"}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm text-ink-2 hover:text-ink"
            >
              <LocateFixed size={15} aria-hidden />
              <T en="Use my location" bn="আমার অবস্থান ব্যবহার করুন" />
            </button>
            <button
              type="button"
              onClick={() => {
                setHaor((v) => !v);
                setPage(PAGE);
              }}
              aria-pressed={haor}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm ${
                haor ? "border-accent bg-accent-soft font-medium text-ink" : "border-line bg-card text-ink-2 hover:text-ink"
              }`}
            >
              <Crosshair size={15} aria-hidden />
              <T en="Haor areas" bn="হাওর এলাকা" />
            </button>
          </div>

          <p role="status" aria-live="polite" className="text-xs text-ink-2">
            {geo.state === "asking" && t("Asking your browser for your location…", "ব্রাউজারের কাছে অবস্থান চাওয়া হচ্ছে…")}
            {geo.state === "nearby" && geo.place && t(`Nearest covered area: ${geo.place}`, `নিকটতম আচ্ছাদিত এলাকা: ${geo.place}`)}
            {geo.state === "denied" && t("Location was not available. Search by name instead.", "অবস্থান পাওয়া যায়নি। বদলে নাম দিয়ে খুঁজুন।")}
            {geo.state === "outside" && t("You are outside the covered tiles. Pick a covered area from the list.", "আপনি আচ্ছাদিত টাইলের বাইরে। তালিকা থেকে একটি আচ্ছাদিত এলাকা বাছুন।")}
            {geo.state === "idle" && (
              <span className="text-ink-3">
                <T
                  en="Location is used only in your browser to pick the nearest covered area; nothing is sent to us."
                  bn="অবস্থান শুধু আপনার ব্রাউজারে নিকটতম আচ্ছাদিত এলাকা বাছতে ব্যবহৃত হয়; আমাদের কাছে কিছু পাঠানো হয় না।"
                />
              </span>
            )}
          </p>
        </div>

        <div>
          <div className={MAP_BOX}>
            <SignalsMap areas={mapRow} tiles={tiles} selected={selected} onSelect={(id) => setSelected(id || null)} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
            <span className="font-medium text-ink">{t("Now", "এখন")}:</span>
            {STATUS_ORDER.map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <Dot status={status} />
                {lang === "bn" ? STATUS_WORD[status].bn : STATUS_WORD[status].en}
                <span className="tabular-nums text-ink-3">{counts[status]}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div role="group" aria-label={t("Filter by today's status", "আজকের অবস্থা অনুযায়ী ছাঁকুন")} className="mt-4 flex flex-wrap gap-1.5">
        {(["all", ...STATUS_ORDER] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              setPage(PAGE);
            }}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
              filter === value ? "border-accent bg-accent-soft font-medium text-ink" : "border-line bg-card text-ink-2 hover:text-ink"
            }`}
          >
            {value !== "all" && <Dot status={value} />}
            {value === "all" ? t("All", "সব") : t(STATUS_WORD[value].en, STATUS_WORD[value].bn)}
            <span className="tabular-nums text-ink-3">{value === "all" ? areas.length : counts[value]}</span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink-3" aria-live="polite">
        {lang === "bn" ? bnNumString(setLabel) : setLabel}
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-sunken p-4 text-sm text-ink-2">
          <T en="No covered area matches. Try another spelling, or clear the filters." bn="কোনো আচ্ছাদিত এলাকা মেলেনি। অন্য বানান চেষ্টা করুন, বা ছাঁকন মুছুন।" />
        </p>
      ) : (
        <ul ref={listRef} className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {ordered.map((area) => {
            const state = STATUS_WORD[area.status];
            const trust = TRUST_WORD[area.trust];
            return (
              <li key={area.id} id={`sig-${area.id}`} className={selected === area.id ? "bg-accent-soft/40" : ""}>
                <Link
                  href={`/signals/place?id=${encodeURIComponent(area.id)}`}
                  onMouseEnter={() => setSelected(area.id)}
                  onFocus={() => setSelected(area.id)}
                  className="flex min-h-12 flex-col gap-1 px-3 py-2.5 hover:bg-sunken sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{area.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {area.countryName} · {area.level} · {area.tileLabel}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={`inline-flex items-center gap-1.5 font-medium ${state.cls}`}>
                      <Dot status={area.status} />
                      {lang === "bn" ? state.bn : state.en}
                    </span>
                    {area.status !== "no-data" && area.confidence && (
                      <span className="text-ink-3">{t(area.confidence, area.confidence === "low" ? "কম নিশ্চয়তা" : area.confidence === "medium" ? "মাঝারি নিশ্চয়তা" : "উচ্চ নিশ্চয়তা")}</span>
                    )}
                    <span className={`inline-flex items-center gap-1 ${trust.cls}`}>
                      <T en={`Trust: ${trust.en}`} bn={`ভরসা: ${trust.bn}`} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > shown.length && (
        <button
          type="button"
          onClick={() => setPage((value) => value + PAGE)}
          className="mt-3 min-h-11 w-full rounded-xl border border-line bg-card px-4 text-sm font-medium text-ink-2 hover:text-ink"
        >
          {t(`Show ${Math.min(rows.length - shown.length, PAGE)} more of ${rows.length}`, `${rows.length}টির মধ্যে আরও ${Math.min(rows.length - shown.length, PAGE)}টি দেখান`)}
        </button>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
        <ExternalLink size={13} aria-hidden />
        <T
          en="Each area opens a place page with its Before, Now, Next, Trust and Action strips."
          bn="প্রতিটি এলাকা খুললে আগে, এখন, আসছে, ভরসা ও করণীয় স্তরসহ একটি জায়গার পাতা আসে।"
        />
      </p>
    </section>
  );
}

/** Bangla numerals inside a sentence that was built with Latin digits. */
function bnNumString(text: string): string {
  return text.replace(/\d+/g, (digits) => bnNum(digits));
}
