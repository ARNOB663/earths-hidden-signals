"use client";

// /replay: a historical event replay. Pick a tile and a year; the page shows that year's rain
// against the baseline available at the time, the flag, and every catalogued flood episode with
// its outcome (hit, miss, false alarm, correct rejection). A small map places the episodes and the
// rain cells. All numbers are read from the committed backtest file.

import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { T, useT } from "@/lib/i18n";
import type { Backtest, Episode, TileReplay, TestedYear } from "@/lib/signals/backtest";
import { Pill } from "./levels";

const ReplayMap = dynamic(() => import("./ReplayMap"), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-2xl border border-line bg-sunken" aria-hidden />,
});

type Outcome = "hit" | "false-alarm" | "miss" | "correct-rejection" | "not-tested";

const OUTCOME: Record<Outcome, { en: string; bn: string; tone: "good" | "watch" | "alert" | "neutral" | "muted" }> = {
  hit: { en: "Hit", bn: "হিট", tone: "good" },
  "false-alarm": { en: "False alarm", bn: "ভুল সতর্কতা", tone: "watch" },
  miss: { en: "Miss", bn: "বাদ পড়া", tone: "alert" },
  "correct-rejection": { en: "Correct rejection", bn: "সঠিক বর্জন", tone: "neutral" },
  "not-tested": { en: "Not tested", bn: "পরীক্ষা হয়নি", tone: "muted" },
};

function outcomeOf(row: TestedYear, thresholdMm?: number): Outcome {
  if (row.state !== "tested") return "not-tested";
  // The tested screen's flag comes from the committed file. When the reader moves the what-if
  // threshold slider, the flag is recomputed from the same committed rain value and the same
  // earlier-years threshold the screen had at the time — no new number is produced.
  const flagged = thresholdMm === undefined ? row.flagged === true : row.value !== null && row.value !== undefined && row.value >= thresholdMm;
  if (flagged && row.event) return "hit";
  if (flagged) return "false-alarm";
  if (row.event) return "miss";
  return "correct-rejection";
}

export function ReplayExplorer({ audit }: { audit: Backtest }) {
  const t = useT();
  const [tileId, setTileId] = useState(audit.replay[0]?.tile ?? "");
  const [section, setSection] = useState<"monsoon" | "pre-monsoon">("monsoon");
  const tile = audit.replay.find((entry) => entry.tile === tileId) ?? audit.replay[0];
  const years = tile.sections[section].years;
  const [index, setIndex] = useState(Math.max(0, years.length - 1));
  // What-if threshold as a fraction of the screen's own threshold at the time (0.5 = lower the
  // bar to half its width; 1 = exactly the tested screen). It never changes the committed results:
  // the slider only recomputes this panel's flag from the same committed rain value.
  const [factor, setFactor] = useState(1);

  const row = years[Math.min(index, years.length - 1)];
  const year = row?.year ?? years[years.length - 1]?.year;
  const episodes = useMemo(() => tile.episodes.filter((episode) => episode.year === year && episode.section === section), [tile, year, section]);
  const rain = tile.sections[section].series.find((entry) => entry.year === year);
  const whatIfThreshold = row?.threshold === undefined ? undefined : Math.round(row.threshold * factor * 10) / 10;
  const outcome = row ? outcomeOf(row, factor === 1 ? undefined : whatIfThreshold) : "not-tested";
  const cells = audit.geometry.cells[tile.tile]?.cells ?? [];
  const grid = audit.geometry.grid;

  const go = (next: number) => setIndex(Math.max(0, Math.min(years.length - 1, next)));

  return (
    <section aria-labelledby="replay" className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="replay" className="text-lg font-semibold text-ink">
          <T en="Event replay" bn="ঘটনা পুনরাবৃত্তি" />
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {audit.replay.map((entry) => (
            <button
              key={entry.tile}
              type="button"
              aria-pressed={entry.tile === tileId}
              onClick={() => {
                setTileId(entry.tile);
                setIndex(Math.max(0, (entry.sections[section].years.length) - 1));
              }}
              className={`min-h-9 rounded-full border px-3 text-sm ${entry.tile === tileId ? "border-accent bg-accent-soft font-medium text-ink" : "border-line bg-card text-ink-2 hover:text-ink"}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("Season", "মৌসুম")} className="flex rounded-full border border-line p-0.5 text-sm">
            {(["pre-monsoon", "monsoon"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={section === value}
                onClick={() => {
                  setSection(value);
                  setIndex(Math.max(0, tile.sections[value].years.length - 1));
                }}
                className={`min-h-8 rounded-full px-3 ${section === value ? "bg-accent-strong font-medium text-accent-ink" : "text-ink-2"}`}
              >
                <T en={value === "monsoon" ? "Monsoon (Jul–Dec)" : "Pre-monsoon (Jan–Jun)"} bn={value === "monsoon" ? "মৌসুমি (জুলাই–ডিসে)" : "প্রাক-মৌসুমি (জানু–জুন)"} />
              </button>
            ))}
          </div>
          <span className="text-xs text-ink-3">
            <T en={`Baseline for ${year}: ${row?.baselineYears ?? "–"} earlier years`} bn={`${year}-এর ভিত্তি: আগের ${row?.baselineYears ?? "–"} বছর`} />
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index <= 0}
            aria-label={t("Previous year", "আগের বছর")}
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 disabled:opacity-40"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <label htmlFor="year-scrub" className="sr-only">
            {t("Year", "বছর")}
          </label>
          <input
            id="year-scrub"
            type="range"
            min={0}
            max={years.length - 1}
            value={Math.min(index, years.length - 1)}
            onChange={(event) => setIndex(Number(event.target.value))}
            className="h-2 flex-1 accent-[var(--accent-strong)]"
            aria-valuetext={String(year)}
          />
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index >= years.length - 1}
            aria-label={t("Next year", "পরের বছর")}
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 disabled:opacity-40"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
          <output htmlFor="year-scrub" className="min-w-16 text-center text-base font-semibold tabular-nums text-ink">
            {year}
          </output>
        </div>

        <div className="mt-3 rounded-xl border border-line bg-sunken p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="threshold-slider" className="text-xs font-medium text-ink">
              <T en="What-if threshold" bn="যদি-হলে সীমা" />
            </label>
            <span className="text-xs tabular-nums text-ink-2" aria-live="polite">
              {row?.threshold === undefined ? (
                <T en="Not tested" bn="পরীক্ষা হয়নি" />
              ) : (
                <T
                  en={`${whatIfThreshold} mm · ${Math.round(factor * 100)}% of the tested threshold`}
                  bn={`${whatIfThreshold} মিমি · পরীক্ষিত সীমার ${Math.round(factor * 100)}%`}
                />
              )}
            </span>
          </div>
          <input
            id="threshold-slider"
            type="range"
            min={50}
            max={150}
            step={5}
            value={Math.round(factor * 100)}
            onChange={(event) => setFactor(Number(event.target.value) / 100)}
            className="mt-2 h-2 w-full accent-[var(--accent-strong)]"
            aria-valuetext={`${Math.round(factor * 100)}%`}
          />
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-ink-3">
            <span>50%</span>
            <span>
              <T en="Tested (80th percentile)" bn="পরীক্ষিত (৮০তম শতকরা)" />
            </span>
            <span>150%</span>
          </div>
          {factor !== 1 && (
            <p className="mt-1 text-[11px] text-watch">
              <T
                en="What-if only: this changes the flag shown below, not the committed backtest or the Accuracy page."
                bn="কেবল যদি-হলে: এটি নিচে দেখানো সতর্কতা বদলায়, সংরক্ষিত ব্যাকটেস্ট বা নির্ভুলতা পাতা নয়।"
              />
            </p>
          )}
        </div>

        <ol className="mt-2 flex flex-wrap gap-1" aria-label={t("Outcome per year", "প্রতি বছরের ফলাফল")}>
          {years.map((entry, position) => {
            const state = outcomeOf(entry, factor === 1 ? undefined : entry.threshold === undefined ? undefined : Math.round(entry.threshold * factor * 10) / 10);
            const active = position === Math.min(index, years.length - 1);
            return (
              <li key={entry.year}>
                <button
                  type="button"
                  onClick={() => setIndex(position)}
                  aria-label={`${entry.year}: ${OUTCOME[state].en}`}
                  aria-current={active ? "true" : undefined}
                  title={`${entry.year} · ${OUTCOME[state].en}`}
                  className={`block h-6 w-6 rounded-sm text-[10px] font-medium tabular-nums leading-6 ${
                    state === "hit"
                      ? "bg-accent text-accent-ink"
                      : state === "miss"
                        ? "bg-alert-soft text-alert"
                        : state === "false-alarm"
                          ? "bg-watch-soft text-watch"
                          : state === "correct-rejection"
                            ? "bg-sunken text-ink-2"
                            : "border border-dashed border-ink-3 text-ink-3"
                  } ${active ? "outline-2 outline-offset-1 outline-ink" : ""}`}
                >
                  {String(entry.year).slice(2)}
                </button>
              </li>
            );
          })}
        </ol>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-3">
              <T en="Rain this season" bn="এই মৌসুমের বৃষ্টি" />
            </dt>
            <dd className="text-lg font-semibold tabular-nums text-ink">{rain?.value === null || rain?.value === undefined ? "No value" : `${rain.value} mm`}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">
              <T en="Threshold at the time" bn="তখনকার সীমা" />
            </dt>
            <dd className="text-lg font-semibold tabular-nums text-ink">{row?.threshold === undefined ? "–" : `${row.threshold} mm`}</dd>
            <dd className="text-[11px] text-ink-3">
              <T en="80th percentile of earlier years" bn="আগের বছরের ৮০তম শতকরা" />
              {factor !== 1 && whatIfThreshold !== undefined && (
                <span className="block text-watch">
                  <T en={`What-if: ${whatIfThreshold} mm`} bn={`যদি-হলে: ${whatIfThreshold} মিমি`} />
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">
              <T en="Screening flag" bn="স্ক্রিনিং সতর্কতা" />
            </dt>
            <dd className="mt-0.5">
              <Pill tone={outcome === "hit" || outcome === "false-alarm" ? "watch" : "neutral"}>
                <T en={outcome === "hit" || outcome === "false-alarm" ? "Flagged" : "Not flagged"} bn={outcome === "hit" || outcome === "false-alarm" ? "চিহ্নিত" : "চিহ্নিত নয়"} />
              </Pill>
              {factor !== 1 && (
                <span className="mt-0.5 block text-[11px] text-watch">
                  <T en="What-if only" bn="কেবল যদি-হলে" />
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">
              <T en="Outcome" bn="ফলাফল" />
            </dt>
            <dd className="mt-0.5">
              <Pill tone={OUTCOME[outcome].tone}>
                <T en={OUTCOME[outcome].en} bn={OUTCOME[outcome].bn} />
              </Pill>
            </dd>
          </div>
        </dl>
        {row && row.state !== "tested" && (
          <p className="mt-2 text-xs text-watch">
            <T en={`Not tested: ${row.reason ?? ""}`} bn={`পরীক্ষা হয়নি: ${row.reason ?? ""}`} />
          </p>
        )}

        <div className="mt-4">
          <ReplayMap
            tile={tile.tile}
            lat={episodes[0]?.lat ?? null}
            lon={episodes[0]?.lon ?? null}
            episodes={episodes}
            cells={cells}
            grid={{ lat0: grid.lat0, dLat: grid.dLat, lon0: grid.lon0, dLon: grid.dLon }}
            outlined={outcome === "hit" || outcome === "false-alarm"}
            section={section}
          />
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">
            <T en={`Catalogued flood episodes starting in ${year}`} bn={`${year} সালে শুরু হওয়া নথিভুক্ত বন্যা-ঘটনা`} />
          </h3>
          {episodes.length === 0 ? (
            <p className="mt-1 text-sm text-ink-2">
              <T en="No episode starts in this season this year." bn="এই বছরের এই মৌসুমে কোনো ঘটনা শুরু হয়নি।" />
            </p>
          ) : (
            <table className="mt-1 w-full text-left text-sm">
              <caption className="sr-only">
                <T en="Episodes and their screening outcome" bn="ঘটনা ও তাদের স্ক্রিনিং ফলাফল" />
              </caption>
              <thead>
                <tr className="text-xs text-ink-3">
                  <th scope="col" className="py-1 font-medium"><T en="Start" bn="শুরু" /></th>
                  <th scope="col" className="py-1 font-medium"><T en="GDACS alert" bn="GDACS সতর্কতা" /></th>
                  <th scope="col" className="py-1 text-right font-medium"><T en="Position" bn="অবস্থান" /></th>
                  <th scope="col" className="py-1 font-medium"><T en="Signal before it" bn="তার আগের সংকেত" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {episodes.map((episode) => (
                  <tr key={episode.id}>
                    <th scope="row" className="py-1.5 font-normal tabular-nums text-ink">
                      <time dateTime={episode.start}>{episode.start}</time>
                    </th>
                    <td className="py-1.5 text-ink-2">{episode.alert ?? "–"}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-2">
                      {episode.lat.toFixed(2)}, {episode.lon.toFixed(2)}
                    </td>
                    <td className="py-1.5">
                      {episode.hit && episode.lead ? (
                        <Pill tone="good">
                          <T
                            en={`Hit, ${episode.lead.days} days lead (${episode.lead.section})`}
                            bn={`হিট, ${episode.lead.days} দিন আগে (${episode.lead.section})`}
                          />
                        </Pill>
                      ) : (
                        <Pill tone="alert">
                          <T en="Miss (no flag before it)" bn="বাদ (আগে কোনো সতর্কতা নেই)" />
                        </Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {episodes.length > 1 && (
          <p className="mt-2 text-xs text-ink-3">
            <T en="The map marks the first episode; all episodes are listed above." bn="মানচিত্র প্রথম ঘটনাটি চিহ্নিত করে; সব ঘটনা উপরে তালিকাভুক্ত।" />
          </p>
        )}
      </div>
    </section>
  );
}

export { OUTCOME, outcomeOf };
export type { Episode, TileReplay };
