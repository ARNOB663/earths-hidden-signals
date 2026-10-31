// Presentational building blocks for the intelligence pages. No hooks, so they render on the
// server; all text comes from the pipeline in both languages or from fixed labels here.

import { ArrowUpRight, CalendarClock, CircleAlert, ExternalLink, Info, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { bnNum } from "@/lib/bn";
import { T } from "@/lib/i18n";
import {
  CONFIDENCE_LABEL,
  GRADE_DOTS,
  GRADE_LABEL,
  HAZARD_LABEL,
  LEVEL_LABEL,
  LEVEL_TONE,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  classLabel,
  periodLabel,
  signed,
} from "@/lib/intelligence/conclude";
import { FORECAST_FIELDS, FORECAST_GAP } from "@/lib/intelligence/forecast";
import type {
  Composite,
  Confidence,
  Confidences,
  Freshness,
  HazardScreen,
  HistoryRow,
  Indicator,
  InternalAlert,
  Level,
  OfficialAlert,
  OfficialSource,
  Severity,
  Verdict,
} from "@/lib/intelligence/types";

/* ---------- Badges ---------- */

export function LevelBadge({ level, large = false }: { level: Level; large?: boolean }) {
  const l = LEVEL_LABEL[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${LEVEL_TONE[level]} ${large ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      <T en={l.en} bn={l.bn} />
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY_LABEL[severity];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_TONE[severity]}`}>
      <T en={s.en} bn={s.bn} />
    </span>
  );
}

/** Official alerts use their own neutral, outlined style so they never look like our severity scale. */
export function OfficialBadge({ level }: { level: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ink-3 px-2.5 py-0.5 text-xs font-medium text-ink">
      <ShieldCheck size={12} aria-hidden />
      <T en={`Official · GDACS ${level ?? ""}`} bn={`আনুষ্ঠানিক · GDACS ${level ?? ""}`} />
    </span>
  );
}

/* ---------- Freshness ---------- */

export function FreshnessStamp({ f, asOf, compact = false }: { f: Freshness; asOf: string; compact?: boolean }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-3 ${compact ? "text-xs" : "text-sm"}`}>
      <CalendarClock size={compact ? 13 : 15} aria-hidden className="shrink-0" />
      <span>
        <T en={`Observed through ${f.observedThrough}`} bn={`${bnNum(f.observedThrough)} পর্যন্ত পর্যবেক্ষণ`} />
      </span>
      <span aria-hidden>·</span>
      <span>
        <T
          en={`${f.ageDays} days old on ${asOf}`}
          bn={`${bnNum(asOf)} তারিখে ${bnNum(f.ageDays)} দিন পুরোনো`}
        />
      </span>
      {f.expectedLagDays !== null && (
        <>
          <span aria-hidden>·</span>
          <span>
            <T en={`usual delay ${f.expectedLagDays} days`} bn={`স্বাভাবিক বিলম্ব ${bnNum(f.expectedLagDays)} দিন`} />
          </span>
        </>
      )}
      {f.stale && (
        <span className="rounded-full bg-watch-soft px-2 py-0.5 text-xs font-medium text-watch">
          <T en="Stale" bn="পুরোনো" />
        </span>
      )}
    </p>
  );
}

/* ---------- Confidence ---------- */

export function GradeDots({ grade }: { grade: Confidence["grade"] }) {
  const n = GRADE_DOTS[grade];
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[1, 2, 3].map((d) => (
        <span key={d} className={`h-2 w-2 rounded-full ${d <= n ? "bg-accent" : "bg-line"}`} />
      ))}
    </span>
  );
}

export function ConfidenceChip({ name, c }: { name: keyof Confidences; c: Confidence }) {
  const label = CONFIDENCE_LABEL[name];
  const g = GRADE_LABEL[c.grade];
  return (
    <details className="group rounded-xl border border-line bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5">
        <span className="min-w-0">
          <span className="block text-xs text-ink-3">
            <T en={label.en} bn={label.bn} />
          </span>
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            <GradeDots grade={c.grade} />
            <T en={g.en} bn={g.bn} />
          </span>
        </span>
        <span className="text-xs text-ink-3 group-open:hidden">
          <T en="Why" bn="কেন" />
        </span>
      </summary>
      <ul className="space-y-1 border-t border-line px-3.5 py-2.5 text-sm text-ink-2">
        {c.reasons.map((r) => (
          <li key={r.code} className="leading-snug">
            <T en={r.textEn} bn={r.textBn} />
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ConfidenceChips({ confidences }: { confidences: Confidences }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {(Object.keys(CONFIDENCE_LABEL) as (keyof Confidences)[]).map((k) => (
        <ConfidenceChip key={k} name={k} c={confidences[k]} />
      ))}
    </div>
  );
}

/* ---------- Percentile meter ---------- */

/** Where the observation sits in its baseline, with the class boundaries the pipeline uses. */
export function PercentileMeter({ percentile, n }: { percentile: number; n: number }) {
  const ticks = [5, 10, 90, 95];
  return (
    <div>
      <div className="relative h-6" role="img" aria-label={`Percentile ${Math.round(percentile)} of ${n} baseline years`}>
        <div className="absolute inset-x-0 top-2.5 h-1.5 rounded-full bg-sunken" />
        <div className="absolute top-2.5 h-1.5 rounded-full bg-[var(--mid)]" style={{ left: "10%", width: "80%" }} />
        {ticks.map((t) => (
          <span key={t} className="absolute top-1 h-4 w-px bg-ink-3/60" style={{ left: `${t}%` }} />
        ))}
        <span
          className="absolute top-0.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-card bg-accent shadow-soft"
          style={{ left: `${Math.min(99, Math.max(1, percentile))}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[11px] text-ink-3">
        <span>
          <T en="Lowest" bn="সর্বনিম্ন" />
        </span>
        <span>
          <T en="Normal range (P10–P90)" bn="স্বাভাবিক সীমা (P10–P90)" />
        </span>
        <span>
          <T en="Highest" bn="সর্বোচ্চ" />
        </span>
      </div>
    </div>
  );
}

/* ---------- Indicators ---------- */

function fmt(value: number, unit: string): string {
  const d = unit === "°C" ? 2 : unit === "mm" ? 0 : 1;
  return value.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function IndicatorCard({ r, asOf }: { r: Indicator; asOf: string }) {
  const cls = classLabel(r.class, r.direction);
  const p = periodLabel(r.observedPeriod === "monsoon" && r.period === "annual" ? "monsoon" : r.period);
  return (
    <article className="rounded-2xl border border-line bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-ink-3">
        <T en={`${r.labelEn} · ${p.en} ${r.year}`} bn={`${r.labelBn} · ${p.bn} ${bnNum(r.year)}`} />
      </p>
      {r.available && r.value !== undefined ? (
        <>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tabular-nums text-ink">
            {fmt(r.value, r.unit)}
            <span className="text-sm font-normal text-ink-3">{r.unit}</span>
            {r.ratioPct != null && (
              <span className="text-sm font-normal text-ink-2">
                <T en={`${r.ratioPct}% of normal`} bn={`স্বাভাবিকের ${bnNum(r.ratioPct)}%`} />
              </span>
            )}
          </p>
          <p className="text-xs text-ink-3">
            <T en={r.valueNoteEn} bn={r.valueNoteBn} />
          </p>
          <p className="mt-1 text-sm font-medium text-ink">
            <T en={cls.en} bn={cls.bn} />
            <span className="ml-2 font-normal text-ink-3">
              <T
                en={`P≈${Math.round(r.percentile!)} of ${r.baseline!.n} years (${r.baselineId})`}
                bn={`P≈${bnNum(Math.round(r.percentile!))}, ${bnNum(r.baseline!.n)} বছর (${bnNum(r.baselineId)})`}
              />
            </span>
          </p>
          <div className="mt-3">
            <PercentileMeter percentile={r.percentile!} n={r.baseline!.n} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-2">
            <dt className="text-ink-3"><T en="vs baseline mean" bn="বেসলাইন গড়ের তুলনায়" /></dt>
            <dd className="text-right tabular-nums">{signed(r.difference!, r.unit === "°C" ? 2 : r.unit === "mm" ? 0 : 1)} {r.unit}</dd>
            <dt className="text-ink-3"><T en="Rank (1 = highest)" bn="ক্রম (১ = সর্বোচ্চ)" /></dt>
            <dd className="text-right tabular-nums">{r.rankHigh} / {r.rankOf}</dd>
            <dt className="text-ink-3"><T en="z (supplementary)" bn="z (সহায়ক)" /></dt>
            <dd className="text-right tabular-nums">{r.zScore == null ? "—" : signed(r.zScore, 2)}</dd>
            <dt className="text-ink-3"><T en="Same sign in a row" bn="টানা একই দিকে" /></dt>
            <dd className="text-right tabular-nums">{r.duration.periods}</dd>
          </dl>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-3">
          <T en={`Not available (${r.reason ?? "no data"}).`} bn="তথ্য নেই।" />
        </p>
      )}
      <div className="mt-3 border-t border-line pt-2">
        <FreshnessStamp f={r} asOf={asOf} compact />
        <p className="mt-1 text-xs text-ink-3">
          {r.source} · <span className="font-mono">{r.id}</span>
        </p>
      </div>
    </article>
  );
}

const COMPONENT_LABEL: Record<string, { en: string; bn: string }> = {
  total: { en: "Rainfall total", bn: "মোট বৃষ্টি" },
  intensity: { en: "Mean daily intensity", bn: "গড় দৈনিক তীব্রতা" },
  "heavy-rain": { en: "Very heavy rain days", bn: "অতি ভারী বৃষ্টির দিন" },
  "wettest-day": { en: "Wettest day", bn: "সবচেয়ে বৃষ্টির দিন" },
  "dry-spell": { en: "Longest monsoon dry spell", bn: "বর্ষার দীর্ঘতম শুষ্ক সময়" },
};

export function CompositeCard({ c }: { c: Composite }) {
  const cls = c.conflicting ? { en: "Normal (conflicting components)", bn: "স্বাভাবিক (উপাদানগুলো পরস্পরবিরোধী)" } : classLabel(c.class, c.direction);
  const p = periodLabel(c.period);
  return (
    <article className="rounded-2xl border border-line bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-ink-3">
        <T en={`Rainfall assessment · ${p.en} ${c.year}`} bn={`বৃষ্টির মূল্যায়ন · ${p.bn} ${bnNum(c.year)}`} />
      </p>
      <p className="mt-1 text-lg font-semibold text-ink">
        <T en={cls.en} bn={cls.bn} />
      </p>
      {c.corroboratedBy.length > 0 && (
        <p className="text-sm text-ink-2">
          <T
            en={`Rainfall total, corroborated by ${c.corroboratedBy.map((x) => COMPONENT_LABEL[x]?.en ?? x).join(" and ")}.`}
            bn={`মোট বৃষ্টি, সমর্থন: ${c.corroboratedBy.map((x) => COMPONENT_LABEL[x]?.bn ?? x).join(" ও ")}।`}
          />
        </p>
      )}
      <ul className="mt-3 divide-y divide-line text-sm">
        {c.components.map((x) => {
          const l = classLabel(x.class, x.direction);
          const name = COMPONENT_LABEL[x.id] ?? { en: x.id, bn: x.id };
          return (
            <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
              <span className="text-ink-2">
                <T en={name.en} bn={name.bn} />
                {!x.counted && (
                  <span className="ml-1.5 text-xs text-ink-3">
                    <T en="(reported, not counted)" bn="(দেখানো, গণনা নয়)" />
                  </span>
                )}
              </span>
              <span className="tabular-nums text-ink">
                {x.available ? (
                  <>
                    <T en={l.en} bn={l.bn} />
                    <span className="ml-1.5 text-xs text-ink-3">P≈{x.percentile == null ? "—" : Math.round(x.percentile)}</span>
                  </>
                ) : (
                  <T en="Not available" bn="নেই" />
                )}
              </span>
            </li>
          );
        })}
        {c.unavailableComponents.map((u) => (
          <li key={u.id} className="py-1.5 text-xs text-ink-3">
            {u.labelEn}: <T en={u.reasonEn} bn="দৈনিক তথ্য ক্যাশ ছাড়া পাওয়া যায় না।" />
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ---------- Hazards ---------- */

export function HazardCard({ h }: { h: HazardScreen }) {
  const label = HAZARD_LABEL[h.hazard];
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-ink">
          <T en={label.en} bn={label.bn} />
        </h3>
        <div className="flex gap-1.5">
          <LevelBadge level={h.level} />
          {h.severity && <SeverityBadge severity={h.severity} />}
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        <T en={h.whyEn} bn={h.whyBn} />
      </p>
      {h.hazard === "heat" && (
        <p className="mt-1 text-xs text-ink-3">
          <T
            en="Seasonal mean temperature vs the 1991–2020 baseline. Heatwaves are not assessed: there is no daily temperature record."
            bn="১৯৯১–২০২০ বেসলাইনের তুলনায় মৌসুমি গড় তাপমাত্রা। তাপপ্রবাহ মূল্যায়ন করা হয়নি: দৈনিক তাপমাত্রার তথ্য নেই।"
          />
        </p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-2">
        <div>
          <dt className="text-ink-3"><T en="Linked driver" bn="যুক্ত চালক" /></dt>
          <dd>{h.linkedDriver ? <T en="Yes (p < 0.05)" bn="হ্যাঁ" /> : <T en="No" bn="না" />}</dd>
        </div>
        <div>
          <dt className="text-ink-3"><T en="Event record" bn="ঘটনার রেকর্ড" /></dt>
          <dd>{h.hasRecord ? <T en="Yes" bn="হ্যাঁ" /> : <T en="None in this project" bn="এই প্রকল্পে নেই" />}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <ConfidenceChip name="hazard" c={h.confidence} />
      </div>
      <p className="mt-auto pt-3 text-xs font-medium text-ink-3">
        <T en={h.disclaimerEn} bn={h.disclaimerBn} />
      </p>
    </article>
  );
}

/* ---------- Alerts ---------- */

export function AlertCard({ a, showLocation = false, locationName }: { a: InternalAlert; showLocation?: boolean; locationName?: { en: string; bn: string } }) {
  return (
    <article className="rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={a.severity} />
        <span className="text-sm font-medium text-ink">
          <T en={HAZARD_LABEL[a.hazard].en} bn={HAZARD_LABEL[a.hazard].bn} />
        </span>
        {showLocation && locationName && (
          <Link href={`/location/${a.locationId}`} className="text-sm text-accent hover:underline">
            <T en={locationName.en} bn={locationName.bn} />
          </Link>
        )}
        <span className="ml-auto text-xs text-ink-3">
          {a.status === "active" ? <T en="Active" bn="সক্রিয়" /> : <T en={`Closed (${a.closedReason})`} bn="বন্ধ" />}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        <T en={a.textEn} bn={a.textBn} />
      </p>
      <p className="mt-1 text-xs text-ink-3">
        <T
          en={`First ${a.firstPeriod} · last seen ${a.lastSeenPeriod} · ${a.occurrences.length} assessed period(s)`}
          bn={`প্রথম ${bnNum(a.firstPeriod)} · সর্বশেষ ${bnNum(a.lastSeenPeriod)}`}
        />
      </p>
      {a.reconstructed && a.noteEn && (
        <p className="mt-1 text-xs italic text-ink-3">
          <T en={a.noteEn} bn={a.noteBn ?? a.noteEn} />
        </p>
      )}
    </article>
  );
}

export function OfficialAlertCard({ a }: { a: OfficialAlert }) {
  return (
    <article className="rounded-xl border-2 border-dashed border-line bg-page p-4">
      <div className="flex flex-wrap items-center gap-2">
        <OfficialBadge level={a.alertLevel} />
        <span className="text-xs text-ink-3">{a.date}{a.end ? ` → ${a.end}` : ""}</span>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        <T en={a.textEn} bn={a.textBn} />
      </p>
      <a href={a.providerUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline">
        {a.provider} <ExternalLink size={11} aria-hidden />
      </a>
    </article>
  );
}

/* ---------- Validation ---------- */

const STATUS_LABEL = {
  agree: { en: "Agree", bn: "একমত" },
  partly: { en: "Partly agree", bn: "আংশিক একমত" },
  disagree: { en: "Disagree", bn: "একমত নয়" },
  unavailable: { en: "Not available", bn: "নেই" },
} as const;
const INDEPENDENCE_LABEL = {
  independent: { en: "Independent", bn: "স্বাধীন" },
  "same-input-family": { en: "Same input family", bn: "একই উৎস-পরিবার" },
  "consistency-check": { en: "Consistency check only", bn: "শুধু সামঞ্জস্য যাচাই" },
} as const;

export function ValidationList({ verdicts }: { verdicts: Verdict[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {verdicts.map((v) => (
        <li key={v.check} className="rounded-xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs font-medium text-ink">
              <T en={STATUS_LABEL[v.status].en} bn={STATUS_LABEL[v.status].bn} />
            </span>
            <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">
              <T en={INDEPENDENCE_LABEL[v.independence].en} bn={INDEPENDENCE_LABEL[v.independence].bn} />
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-ink">{v.sources.join(" vs ")}</p>
          <p className="mt-1 text-sm text-ink-2">
            <T en={v.detailEn} bn={v.detailBn} />
          </p>
          <p className="mt-1 text-xs text-ink-3">
            <T en={v.limitationsEn} bn={v.limitationsBn} />
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Timeline (development) ---------- */

const FIELD_BN: Record<string, string> = {
  "temperature class": "তাপমাত্রার শ্রেণি",
  "monsoon rainfall class": "বর্ষার বৃষ্টির শ্রেণি",
  "conclusion level": "সামগ্রিক স্তর",
  "anomaly confidence": "অস্বাভাবিকতার আস্থা",
  assessment: "মূল্যায়ন",
};

export function Timeline({ rows, limit = 8 }: { rows: HistoryRow[]; limit?: number }) {
  const shown = rows.filter((r) => r.changedSince.length > 0).slice(-limit).reverse();
  if (!shown.length) {
    return (
      <p className="text-sm text-ink-3">
        <T en="No changes recorded yet." bn="এখনো কোনো পরিবর্তন নথিভুক্ত হয়নি।" />
      </p>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {shown.map((r) => (
        <li key={r.period} className="relative">
          <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-card bg-accent" aria-hidden />
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            {r.year}
            <LevelBadge level={r.conclusionLevel} />
            {r.reconstructed && (
              <span className="text-xs font-normal text-ink-3">
                <T en="replayed with data available at the time" bn="তখনকার তথ্য দিয়ে পুনর্গঠিত" />
              </span>
            )}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-ink-2">
            {r.changedSince.map((c, i) => (
              <li key={i}>
                <T
                  en={`${c.field}: ${c.from ?? "—"} → ${c.to ?? "—"}`}
                  bn={`${FIELD_BN[c.field] ?? c.field}: ${c.from ?? "—"} → ${c.to ?? "—"}`}
                />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Preparedness ---------- */

export function PreparednessList({ actions, sources }: { actions: { id: string; en: string; bn: string }[]; sources: OfficialSource[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <ol className="space-y-2">
        {actions.map((a, i) => (
          <li key={a.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 text-ink-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-ink">{i + 1}</span>
            <span className="leading-relaxed">
              <T en={a.en} bn={a.bn} />
            </span>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-line bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
          <T en="Official sources first" bn="আগে আনুষ্ঠানিক উৎস" />
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-accent hover:underline">
                <T en={s.name} bn={s.nameBn} />
                <ArrowUpRight size={13} className="mt-1 shrink-0" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Forecast gap ---------- */

export function ForecastGap() {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-sunken p-5">
      <p className="flex items-center gap-2 font-semibold text-ink-2">
        <Info size={16} aria-hidden />
        <T en="Forecast: not integrated" bn="পূর্বাভাস: যুক্ত নয়" />
      </p>
      <p className="mt-2 text-sm text-ink-2">
        <T en={FORECAST_GAP.en} bn={FORECAST_GAP.bn} />
      </p>
      <ul className="mt-3 flex flex-wrap gap-2 text-xs">
        {FORECAST_FIELDS.map((f) => (
          <li key={f.key} className="rounded-full border border-line bg-card px-2.5 py-1 text-ink-3">
            <T en={f.en} bn={f.bn} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Section frame ---------- */

export function Section({ id, label, title, children }: { id: string; label: React.ReactNode; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-12 scroll-mt-20">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{label}</p>
      <h2 id={`${id}-title`} className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Disclaimer() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-line bg-card p-3 text-sm text-ink-2">
      <CircleAlert size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
      <T
        en="Screening summaries from climate observations. Not a forecast, not a probability, not an official warning. Follow your national meteorological service."
        bn="জলবায়ু পর্যবেক্ষণ থেকে স্ক্রিনিং সারাংশ। এটি পূর্বাভাস, সম্ভাবনা বা আনুষ্ঠানিক সতর্কতা নয়। আপনার দেশের আবহাওয়া দপ্তরের নির্দেশনা অনুসরণ করুন।"
      />
    </p>
  );
}
