"use client";

// The five strips of /signals/place: Before (45-year history), Now (today against its date),
// Next (external 7-day rain outlook), Trust (can this place be warned at all) and Action.
//
// Wording rules: "Trust" is never "confidence"; a Green place says "No unusual signal in our data.
// Always follow official warnings."; Next is rain from an external model and never changes a
// status; the page never says an area is all-clear.

import {
  CircleAlert,
  CircleCheck,
  ChevronsUpDown,
  ExternalLink,
  MinusCircle,
  ShieldQuestion,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ShareButton } from "@/components/ui/ShareButton";
import { bnNum } from "@/lib/bn";
import { T, useLang, useT } from "@/lib/i18n";
import type {
  PlaceArea,
  PlaceExtras,
  SignalsConfig,
  Status,
  TrustState,
} from "@/lib/signals/types";

// The one Green sentence, fixed by the plan. It is not varied per page.
export const GREEN_SENTENCE = {
  en: "No unusual signal in our data. Always follow official warnings.",
  bn: "আমাদের তথ্যে অস্বাভাবিক সংকেত নেই। সর্বদা সরকারি সতর্কবার্তা অনুসরণ করুন।",
};

const STATUS: Record<Status, { en: string; bn: string; cls: string; soft: string; Icon: typeof CircleAlert }> = {
  red: { en: "Red", bn: "লাল", cls: "text-alert", soft: "bg-alert-soft", Icon: CircleAlert },
  yellow: { en: "Yellow", bn: "হলুদ", cls: "text-watch", soft: "bg-watch-soft", Icon: TriangleAlert },
  green: { en: "Green", bn: "সবুজ", cls: "text-good", soft: "bg-accent-soft", Icon: CircleCheck },
  grey: { en: "Grey · No data", bn: "ধূসর · তথ্য নেই", cls: "text-ink-3", soft: "bg-sunken", Icon: MinusCircle },
};

const TRUST: Record<TrustState, { cls: string; soft: string; bn: string; shortBn: string; Icon: typeof CircleAlert }> = {
  detectable: { cls: "text-accent-strong", soft: "bg-accent-soft", bn: "শনাক্তযোগ্য", shortBn: "শনাক্তযোগ্য", Icon: CircleCheck },
  "blind-spot": { cls: "text-watch", soft: "bg-watch-soft", bn: "অন্ধ স্থান", shortBn: "অন্ধ স্থান", Icon: ShieldQuestion },
  "no-data": { cls: "text-ink-3", soft: "bg-sunken", bn: "তথ্য নেই", shortBn: "তথ্য নেই", Icon: MinusCircle },
};

const CONFIDENCE: Record<string, { en: string; bn: string }> = {
  low: { en: "Low confidence", bn: "কম নিশ্চয়তা" },
  medium: { en: "Medium confidence", bn: "মাঝারি নিশ্চয়তা" },
  high: { en: "High confidence", bn: "উচ্চ নিশ্চয়তা" },
};

const STRIP_LABEL: Record<string, { en: string; bn: string }> = {
  before: { en: "Before", bn: "আগে" },
  now: { en: "Now", bn: "এখন" },
  next: { en: "Next", bn: "আসছে" },
  trust: { en: "Trust", bn: "ভরসা" },
  action: { en: "Action", bn: "করণীয়" },
};

function Strip({
  id,
  horizon,
  question,
  children,
}: {
  id: keyof typeof STRIP_LABEL;
  horizon: string;
  question: { en: string; bn: string };
  children: React.ReactNode;
}) {
  const label = STRIP_LABEL[id];
  return (
    <section aria-labelledby={`strip-${id}`} className="rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={`strip-${id}`} className="text-base font-semibold text-ink">
          <T en={label.en} bn={label.bn} />
        </h2>
        <span className="rounded-full bg-sunken px-2 py-0.5 text-xs text-ink-2">{horizon}</span>
        <span className="text-sm text-ink-2">
          <T en={question.en} bn={question.bn} />
        </span>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function fmt(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? "–" : value.toFixed(digits);
}

/** Small labelled sparkline: the area's own yearly mean from the trend grid. */
function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const width = 240;
  const height = 44;
  const points = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (points.length < 2) return <p className="text-xs text-ink-3">No usable years.</p>;
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * width;
  const y = (v: number) => height - ((v - min) / span) * (height - 4) - 2;
  const path = points.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-full" role="img" aria-label={label} preserveAspectRatio="none">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function BeforeStrip({ area }: { area: PlaceArea }) {
  const lang = useLang();
  const before = area.before;
  const measured = before.variables.filter((v) => v.slopePerDecade !== null);
  if (measured.length === 0) {
    return (
      <p className="text-sm text-ink-2">
        <T
          en={`No gridded history covers this area (${before.firstYear ?? "–"}–${before.lastYear ?? "–"}), so there is nothing to compare with.`}
          bn={`এই এলাকা কোনো গ্রিডযুক্ত ইতিহাসে পড়ে না (${before.firstYear ?? "–"}–${before.lastYear ?? "–"}), তাই তুলনার কিছু নেই।`}
        />
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {(() => {
        // The unit of "Before" is what changed, not the date range: say the change in words first.
        const headline = before.variables.find((v) => v.ciConsistent) ?? null;
        return (
          <p className="text-sm text-ink">
            {headline ? (
              <T
                en={`${headline.title}. ${headline.cells} grid ${headline.cells === 1 ? "cell" : "cells"} inside this boundary, ${headline.cellsSignificant} of them outside the noise.`}
                bn={`${headline.titleBn ?? headline.title}। এই সীমানার ভেতরে ${bnNum(headline.cells)}টি গ্রিড কোষ, তার ${bnNum(headline.cellsSignificant)}টি কোলাহলের বাইরে।`}
              />
            ) : (
              <T
                en="No variable here has a change that stands out from year-to-year noise."
                bn="এখানে কোনো পরিমাপে বছরে-বছরে ওঠানামা থেকে আলাদা পরিবর্তন নেই।"
              />
            )}
            <span className="mt-0.5 block text-xs text-ink-3">
              <T
                en={`${before.spanYears} years, ${before.firstYear}–${before.lastYear}. The line is each year's value for the cells inside this boundary; the number is Sen's slope with its 95% interval per decade.`}
                bn={`${bnNum(before.spanYears)} বছর, ${bnNum(before.firstYear ?? "–")}–${bnNum(before.lastYear ?? "–")}। রেখাটি এই সীমানার ভেতরের কোষের প্রতি বছরের মান; সংখ্যাটি প্রতি দশকে সেনের ঢাল ও তার ৯৫% ব্যবধান।`}
              />
            </span>
          </p>
        );
      })()}
      <ul className="space-y-3">
        {before.variables.map((v) => {
          const range = v.lowerPerDecade !== null && v.upperPerDecade !== null
            ? `${fmt(v.lowerPerDecade, 2)} … ${fmt(v.upperPerDecade, 2)}`
            : null;
          const trendWord =
            v.slopePerDecade === null
              ? null
              : v.ciConsistent
                ? v.slopePerDecade > 0
                  ? { en: "Up, outside the noise", bn: "বাড়ছে, কোলাহলের বাইরে" }
                  : { en: "Down, outside the noise", bn: "কমছে, কোলাহলের বাইরে" }
                : { en: "Not separate from year-to-year noise", bn: "বছরে-বছরে ওঠানামা থেকে আলাদা নয়" };
          return (
            <li key={v.key} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-medium text-ink">
                  {v.label}{" "}
                  <span className="text-xs font-normal text-ink-3">
                    ({v.unit}
                    {v.per === "decade" ? " / decade" : ""})
                  </span>
                </span>
                <span className="text-xs text-ink-3 tabular-nums">
                  {v.cells} {tCells(lang)} · {v.cellsSignificant} {tSignificant(lang)}
                </span>
              </div>
              {v.slopePerDecade === null ? (
                <p className="mt-1 text-sm text-ink-2">
                  <T en="No trend can be computed here (too few usable years in these cells)." bn="এখানে প্রবণতা গণনা করা যায় না (এই কোষগুলোতে ব্যবহারযোগ্য বছর যথেষ্ট নয়)।" />
                </p>
              ) : (
                <>
                  <Sparkline values={v.series} label={`${v.label}, ${before.firstYear}–${before.lastYear}`} />
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    {v.title && <span className="text-ink-2">{lang === "bn" ? (v.titleBn ?? v.title) : v.title}</span>}
                    <span className="text-lg font-semibold tabular-nums text-ink">
                      {v.slopePerDecade > 0 ? "+" : ""}
                      {fmt(v.slopePerDecade, 2)} {v.unit}/decade
                    </span>
                    {range && (
                      <span className="text-xs tabular-nums text-ink-3">
                        <T en="95% interval" bn="৯৫% ব্যবধান" />: {range}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-2">
                    {trendWord && <T en={trendWord.en} bn={trendWord.bn} />} · {v.dataset}
                  </p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function tCells(lang: string) {
  return lang === "bn" ? "কোষ" : "cells";
}
function tSignificant(lang: string) {
  return lang === "bn" ? "কোষ তালিকার সীমার বাইরে" : "cells outside the noise";
}

function NowStrip({ area }: { area: PlaceArea }) {
  const t = useT();
  const lang = useLang();
  const now = area.now;
  if (now.state === "no-data" || now.cells.length === 0) {
    return (
      <p className="text-sm text-ink-2">
        <T
          en="No rain reading covers this place. Grey is a gap in our data, never an all-clear."
          bn="এই জায়গায় কোনো বৃষ্টির পাঠ নেই। ধূসর মানে আমাদের তথ্যে ফাঁক, কখনো নিরাপত্তার নিশ্চয়তা নয়।"
        />
      </p>
    );
  }
  const lead = now.cells[0];
  const state = STATUS[lead.status];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${state.soft} ${state.cls}`}>
          <state.Icon size={16} aria-hidden />
          <T en={state.en} bn={state.bn} />
        </span>
        <span className="text-xs text-ink-3">{CONFIDENCE[lead.confidence] ? t(CONFIDENCE[lead.confidence].en, CONFIDENCE[lead.confidence].bn) : lead.confidence}</span>
        {now.sample && (
          <span className="rounded-full bg-watch-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-watch">
            <T en="SAMPLE DATA" bn="নমুনা তথ্য" />
          </span>
        )}
      </div>

      {lead.status === "green" ? (
        <p className="text-sm text-ink">
          <T en={GREEN_SENTENCE.en} bn={GREEN_SENTENCE.bn} />
        </p>
      ) : lead.status === "grey" ? (
        <p className="text-sm text-ink-2">
          <T
            en="Grey: our data cannot judge this place today (too short a baseline or too many missing days). It is a gap, never an all-clear."
            bn="ধূসর: আজ এই জায়গা বিচার করার মতো তথ্য আমাদের নেই (তুলনার ভিত্তি খুব ছোট বা অনেক দিন অনুপস্থিত)। এটি ফাঁক, কখনো নিরাপত্তার নিশ্চয়তা নয়।"
          />
        </p>
      ) : (
        <p className="text-sm text-ink">
          <T en={lead.reasonText} bn={lead.reasonTextBn ?? lead.reasonText} />
        </p>
      )}

      <dl className="grid grid-cols-3 gap-2">
        {(
          [
            [1, lead.day1],
            [3, lead.day3],
            [7, lead.day7],
          ] as const
        ).map(([days, value]) => (
          <div key={days} className="rounded-xl border border-line px-3 py-2">
            <dt className="text-xs text-ink-3">
              <T en={`${days}-day rain`} bn={`${bnNum(days)} দিনের বৃষ্টি`} />
            </dt>
            <dd className="text-lg font-semibold tabular-nums text-ink">
              {value === null ? "–" : `${value.toFixed(1)} mm`}
            </dd>
          </div>
        ))}
      </dl>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-line px-3 py-2">
          <dt className="text-xs text-ink-3">
            <T en="Rain vs normal for this date" bn="এই তারিখের স্বাভাবিকের তুলনায় বৃষ্টি" />
          </dt>
          <dd className="font-medium tabular-nums text-ink">
            {lead.ratio === null ? "–" : `${lead.ratio.toFixed(1)}×`}
          </dd>
        </div>
        <div className="rounded-xl border border-line px-3 py-2">
          <dt className="text-xs text-ink-3">
            <T en="Percentile of the date's history" bn="এই তারিখের ইতিহাসে শতকরা স্থান" />
          </dt>
          <dd className="font-medium tabular-nums text-ink">
            {lead.percentile === null ? "–" : `${Math.round(lead.percentile)}${lang === "bn" ? "তম" : "th"}`}
          </dd>
        </div>
      </dl>

      {now.cells.length > 1 && (
        <ul className="space-y-1 text-xs text-ink-2">
          {now.cells.slice(1).map((cell) => {
            const s = STATUS[cell.status];
            return (
              <li key={`${cell.lat},${cell.lon}`} className="flex flex-wrap items-center gap-2">
                <s.Icon size={14} aria-hidden className={s.cls} />
                <span className="tabular-nums">
                  {cell.lat.toFixed(1)}, {cell.lon.toFixed(1)}
                </span>
                <span className="text-ink-3">{lang === "bn" ? (cell.reasonTextBn ?? cell.reasonText) : cell.reasonText}</span>
              </li>
            );
          })}
        </ul>
      )}

      {now.clock && (
        <p className="text-xs text-ink-3">
          <T en="Reading of" bn="পাঠের সময়" /> <time dateTime={now.clock}>{now.clock.slice(0, 10)}</time>
          {" · "}
          <T en="IMERG Late, one cell per grid square" bn="IMERG Late, প্রতি গ্রিড বর্গে একটি কোষ" />
        </p>
      )}
    </div>
  );
}

function NextStrip({ extras }: { extras: PlaceExtras | null }) {
  if (!extras || !extras.next) {
    return (
      <p className="text-sm text-ink-2">
        <T
          en="Outlook unavailable from the provider at build time. We do not substitute or extrapolate it."
          bn="নির্মাণের সময় উৎস থেকে পরিপ্রেক্ষিত পাওয়া যায়নি। আমরা এর বদলে কিছু দিই না বা বাড়িয়ে আন্দাজ করি না।"
        />
      </p>
    );
  }
  const next = extras.next;
  const max = Math.max(1, ...next.days.map((d) => d.mm ?? 0));
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-2">
        <T en={next.label} bn="বহিরাগত বহুলপ্রাপ্ত উৎস থেকে পরিপ্রেক্ষিত, আমাদের সংকেত নয় এবং সরকারি সতর্কবার্তাও নয়।" />
      </p>
      <table className="w-full text-sm">
        <caption className="sr-only">
          <T en="Daily rain outlook, external source" bn="দৈনিক বৃষ্টির পরিপ্রেক্ষিত, বহিরাগত উৎস" />
        </caption>
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th scope="col" className="font-normal">
              <T en="Day" bn="দিন" />
            </th>
            <th scope="col" className="font-normal">
              <T en="Rain" bn="বৃষ্টি" />
            </th>
            <th scope="col" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {next.days.map((d) => (
            <tr key={d.date}>
              <th scope="row" className="py-0.5 font-normal tabular-nums text-ink-2">
                <time dateTime={d.date}>{d.date.slice(5)}</time>
              </th>
              <td className="py-0.5 pr-2 text-right tabular-nums text-ink">{d.mm === null ? "–" : `${d.mm.toFixed(1)} mm`}</td>
              <td className="w-2/5 py-0.5" aria-hidden>
                <span className="block h-1.5 rounded-full bg-accent-soft">
                  <span
                    className="block h-1.5 rounded-full bg-accent"
                    style={{ width: `${Math.round(((d.mm ?? 0) / max) * 100)}%` }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-ink-3">
        <T en="7-day total" bn="৭ দিনের মোট" />: <span className="tabular-nums">{next.totalMm === null ? "–" : `${next.totalMm} mm`}</span> · {next.provider} ·{" "}
        <T en="rain only. It never changes the Now status." bn="শুধু বৃষ্টি। এটি কখনো ‘এখন’ অবস্থা বদলায় না।" />
      </p>
    </div>
  );
}

function TrustStrip({ area }: { area: PlaceArea }) {
  const trust = area.trust;
  const style = TRUST[trust.state];
  return (
    <div className="space-y-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${style.soft} ${style.cls}`}>
        <style.Icon size={16} aria-hidden />
        <T en={trust.label} bn={style.bn} />
      </span>
      <p className="text-sm text-ink">{trust.text}</p>
      {(trust.measuredVariablesEn?.length ?? 0) > 0 && (
        <p className="text-xs text-ink-3">
          <T en="With a readable history here" bn="এখানে পাঠযোগ্য ইতিহাস আছে" />:{" "}
          <T en={trust.measuredVariablesEn!.join(", ")} bn={`${bnNum(trust.measuredVariables ?? 0)}টি পরিমাপ`} />
        </p>
      )}
      <p className="text-xs text-ink-3">
        <T
          en="Trust reuses the Sen slope 95% interval from the same analysis as Before: not a probability, not a confidence percentage."
          bn="ভরসা ‘আগে’ বিশ্লেষণেরই সেন ঢালের ৯৫% ব্যবধান ব্যবহার করে: কোনো সম্ভাবনা নয়, কোনো নিশ্চয়তা-শতাংশও নয়।"
        />{" "}
        <Link href="/signals/evidence" className="underline decoration-line underline-offset-2 hover:text-ink">
          <T en="Where the signal can be checked" bn="কোথায় সংকেত যাচাই করা যায়" />
        </Link>
      </p>
    </div>
  );
}

function ActionStrip({ area, wmoUrl }: { area: PlaceArea; wmoUrl: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink">
        <T en={area.action.en} bn={area.action.bn} />
      </p>
      <a
        href={wmoUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm text-ink-2 hover:text-ink"
      >
        <T en="Official warnings (WMO SWIC)" bn="সরকারি সতর্কবার্তা (WMO SWIC)" />
        <ExternalLink size={14} aria-hidden />
      </a>
    </div>
  );
}

export function PlaceView({
  area,
  extras,
  config,
}: {
  area: PlaceArea;
  extras: PlaceExtras | null;
  config: SignalsConfig;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm text-ink-2">
          <T en="Trust" bn="ভরসা" />:
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${TRUST[area.trust.state].soft} ${TRUST[area.trust.state].cls}`}>
            {(() => {
              const Icon = TRUST[area.trust.state].Icon;
              return <Icon size={13} aria-hidden />;
            })()}
            <T en={area.trust.label} bn={TRUST[area.trust.state].bn} />
          </span>
        </span>
        <ShareButton variant="label" />
      </div>

      <Strip id="before" horizon={`${area.before.spanYears} years`} question={{ en: "Has this place changed?", bn: "এই জায়গা কি বদলেছে?" }}>
        <BeforeStrip area={area} />
      </Strip>
      <Strip id="now" horizon="today" question={{ en: "Is it unusual for this date?", bn: "এই তারিখের জন্য কি এটি অস্বাভাবিক?" }}>
        <NowStrip area={area} />
      </Strip>
      <Strip id="next" horizon={`${config.outlook.days} days · external`} question={{ en: "What rain is coming?", bn: "কী বৃষ্টি আসছে?" }}>
        <NextStrip extras={extras} />
      </Strip>
      <Strip id="trust" horizon="what we can measure here" question={{ en: "Can this place be warned at all?", bn: "এই জায়গাকে কি আদৌ সতর্ক করা যায়?" }}>
        <TrustStrip area={area} />
      </Strip>
      <Strip id="action" horizon="your next step" question={{ en: "What do I do?", bn: "আমি কী করব?" }}>
        <ActionStrip area={area} wmoUrl={config.official.wmo} />
      </Strip>
    </div>
  );
}

export interface PickerPlace {
  id: string;
  name: string;
  country: string;
  countryName: string;
  level: "ADM1" | "ADM2";
  centre: [number, number];
  tileLabel: string;
  trust: TrustState;
  nowState: "measured" | "no-data";
}

/**
 * Search across the covered places only. It is a client island that holds the list, so the page
 * itself stays server-rendered and the full places file never ships.
 */
export function PlacePicker({ places, currentId }: { places: PickerPlace[]; currentId: string }) {
  // The picker reads its own suggestion from ?q= in the browser (outside the page's searchParams),
  // so navigation is instant and the page still renders its content on the server.
  return (
    <Suspense fallback={<PickerButton />}>
      <PickerBody places={places} currentId={currentId} />
    </Suspense>
  );
}

function PickerButton() {
  const t = useT();
  return (
    <span className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-full border border-line bg-card px-4 text-sm text-ink-2 sm:w-72">
      {t("Choose another place", "অন্য জায়গা বাছুন")}
      <ChevronsUpDown size={16} aria-hidden className="shrink-0 text-ink-3" />
    </span>
  );
}

function PickerBody({ places, currentId }: { places: PickerPlace[]; currentId: string }) {
  const params = useSearchParams();
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  // A list page can link here with ?q= to open a place directly; otherwise the picker stays shut.
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const current = places.find((p) => p.id === currentId);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (needle.length < 2) return [];
    return places
      .filter((p) => `${p.name} ${p.countryName}`.toLocaleLowerCase().includes(needle))
      .slice(0, 12);
  }, [places, query]);

  return (
    <div className="relative w-full sm:w-72">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-full border border-line bg-card px-4 text-sm text-ink-2 hover:text-ink"
      >
        <span className="truncate">{t("Choose another place", "অন্য জায়গা বাছুন")}</span>
        <ChevronsUpDown size={16} aria-hidden className="shrink-0 text-ink-3" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-card p-2 shadow-soft">
          <label htmlFor="place-search" className="sr-only">
            {t("Search a covered place", "আচ্ছাদিত জায়গা খুঁজুন")}
          </label>
          <input
            id="place-search"
            type="search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("District or country name", "জেলা বা দেশের নাম")}
            className="min-h-10 w-full rounded-lg border border-line bg-card px-3 text-sm text-ink placeholder:text-ink-3"
          />
          {query.trim().length < 2 ? (
            <p className="px-2 py-2 text-xs text-ink-3">
              {t(`Search ${places.length.toLocaleString("en")} covered areas`, `${bnNum(places.length)}টি আচ্ছাদিত এলাকায় খুঁজুন`)}
            </p>
          ) : matches.length === 0 ? (
            <p className="px-2 py-2 text-xs text-ink-3">{t("No covered place matches.", "কোনো আচ্ছাদিত জায়গা মেলেনি।")}</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {matches.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/signals/place?id=${encodeURIComponent(p.id)}`}
                    onClick={() => setOpen(false)}
                    className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-2 text-sm text-ink hover:bg-sunken"
                  >
                    <span className="truncate">
                      {p.name} <span className="text-ink-3">· {p.countryName}</span>
                    </span>
                    <span className={`shrink-0 text-xs ${TRUST[p.trust].cls}`}>
                      {lang === "bn" ? TRUST[p.trust].shortBn : p.trust === "detectable" ? "Detectable" : p.trust === "blind-spot" ? "Blind spot" : "No data"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {current && (
            <p className="border-t border-line px-2 pt-2 text-xs text-ink-3">
              {current.name} · {current.tileLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
