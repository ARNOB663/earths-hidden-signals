"use client";

// "Strongest signals now": a filterable, ranked list. Rows are links to the place page.

import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { Status, TopRow } from "@/lib/signals/types";
import { ConfidenceLabel, STATUS_WORD, StatusBadge, TileLink } from "./parts";

const LINK_TITLE = { en: "Open this place", bn: "এই জায়গাটি খুলুন" };

const FILTERS: (Status | "all")[] = ["all", "red", "yellow", "green", "grey"];

export function SignalsList({ rows }: { rows: TopRow[] }) {
  const t = useT();
  const [filter, setFilter] = useState<Status | "all">("all");
  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  return (
    <section aria-labelledby="strongest" className="min-w-0">
      <h2 id="strongest" className="text-lg font-semibold text-ink">
        {t("Strongest signals now", "এখন সবচেয়ে শক্তিশালী সংকেত")}
      </h2>
      <div role="group" aria-label={t("Filter by status", "অবস্থা অনুযায়ী ছাঁকুন")} className="mt-2 flex flex-wrap gap-1.5">
        {FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
            className={`min-h-11 rounded-full border px-3 text-sm ${
              filter === status ? "border-accent bg-accent-soft font-medium text-ink" : "border-line bg-card text-ink-2"
            }`}
          >
            {status === "all" ? t("All", "সব") : t(STATUS_WORD[status].en, STATUS_WORD[status].bn)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-3 rounded-xl border border-line bg-card p-3 text-sm text-ink-2">
          {t(
            "Nothing in this filter right now. Grey means we have no usable data, not that a place is safe.",
            "এই ছাঁকনিতে এখন কিছু নেই। ধূসর মানে আমাদের ব্যবহারযোগ্য তথ্য নেই, নিরাপদ নয়।",
          )}
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {visible.map((row) => (
            <li key={`${row.tile}-${row.lat}-${row.lon}`}>
              <TileLink lat={row.lat} lon={row.lon} tileLabel={row.tileLabel} title={t(LINK_TITLE.en, LINK_TITLE.bn)}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={row.status} />
                  <span className="text-xs text-ink-3">
                    <ConfidenceLabel confidence={row.confidence} />
                  </span>
                </span>
                <span className="mt-1 block text-sm text-ink">{row.reasonText}</span>
              </TileLink>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
