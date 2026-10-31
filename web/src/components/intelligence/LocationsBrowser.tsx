"use client";

// Search and filter every assessed location. Filters live in the URL (?q=&kind=&hazard=&level=),
// like the other explorers, so a filtered list can be shared.

import { Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { T, useT } from "@/lib/i18n";
import { HAZARD_LABEL, KIND_LABEL, LEVEL_LABEL } from "@/lib/intelligence/conclude";
import type { HazardKey, IndexEntry, Level, LocationKind } from "@/lib/intelligence/types";
import { LevelBadge } from "./parts";

const KINDS: LocationKind[] = ["country", "region", "city", "study-area"];
const HAZARDS: HazardKey[] = ["heat", "dry", "flood", "landslide", "wildfire", "cyclone"];
const LEVELS: Level[] = ["high", "elevated", "notable", "quiet"];

function useFilter(name: string) {
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(name) ?? "");
  const update = (v: string) => {
    setValue(v);
    const q = new URLSearchParams(window.location.search);
    if (v) q.set(name, v);
    else q.delete(name);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  };
  return [value, update] as const;
}

export function LocationsBrowser({ entries }: { entries: IndexEntry[] }) {
  const t = useT();
  const [q, setQ] = useFilter("q");
  const [kind, setKind] = useFilter("kind");
  const [hazard, setHazard] = useFilter("hazard");
  const [level, setLevel] = useFilter("level");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => !kind || e.kind === kind)
      .filter((e) => !hazard || e.hazards.includes(hazard as HazardKey))
      .filter((e) => !level || e.level === level)
      .filter(
        (e) =>
          !needle ||
          e.name.toLowerCase().includes(needle) ||
          e.nameBn.includes(q.trim()) ||
          (e.country ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.name.localeCompare(b.name));
  }, [entries, q, kind, hazard, level]);

  const select = "min-h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink";

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">{t("Search locations", "স্থান খুঁজুন")}</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("City, region or country", "শহর, অঞ্চল বা দেশ")}
            className="min-h-10 w-full rounded-xl border border-line bg-card pl-9 pr-3 text-sm text-ink placeholder:text-ink-3"
          />
        </label>
        <select aria-label={t("Kind", "ধরন")} value={kind} onChange={(e) => setKind(e.target.value)} className={select}>
          <option value="">{t("All kinds", "সব ধরন")}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(KIND_LABEL[k].en, KIND_LABEL[k].bn)}
            </option>
          ))}
        </select>
        <select aria-label={t("Hazard", "দুর্যোগ")} value={hazard} onChange={(e) => setHazard(e.target.value)} className={select}>
          <option value="">{t("All hazards", "সব দুর্যোগ")}</option>
          {HAZARDS.map((h) => (
            <option key={h} value={h}>
              {t(HAZARD_LABEL[h].en, HAZARD_LABEL[h].bn)}
            </option>
          ))}
        </select>
        <select aria-label={t("Level", "স্তর")} value={level} onChange={(e) => setLevel(e.target.value)} className={select}>
          <option value="">{t("All levels", "সব স্তর")}</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(LEVEL_LABEL[l].en, LEVEL_LABEL[l].bn)}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-4 text-sm text-ink-3" aria-live="polite">
        <T en={`${shown.length} of ${entries.length} locations`} bn={`${entries.length}টির মধ্যে ${shown.length}টি স্থান`} />
      </p>

      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {shown.map((e) => (
          <li key={e.id}>
            <Link
              href={`/location/${e.id}`}
              className="flex h-full flex-col rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">
                  <T en={e.name} bn={e.nameBn} />
                </span>
                <LevelBadge level={e.level} />
              </span>
              <span className="mt-0.5 text-xs text-ink-3">
                <T en={KIND_LABEL[e.kind].en} bn={KIND_LABEL[e.kind].bn} />
                {e.country && (
                  <>
                    {" · "}
                    <T en={e.country} bn={e.countryBn ?? e.country} />
                  </>
                )}
              </span>
              <span className="mt-2 text-sm text-ink-2">
                <T en={e.headline.en} bn={e.headline.bn} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <p className="mt-6 text-sm text-ink-3">
          <T en="No location matches these filters." bn="এই ফিল্টারে কোনো স্থান মেলেনি।" />
        </p>
      )}
    </div>
  );
}
