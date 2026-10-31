import type { Metadata } from "next";
import Link from "next/link";
import { AlertCard, Disclaimer, LevelBadge, OfficialAlertCard, Section } from "@/components/intelligence/parts";
import { bnNum } from "@/lib/bn";
import { T } from "@/lib/i18n";
import { classLabel } from "@/lib/intelligence/conclude";
import { readAlerts, readCurrent, readEvaluation, readIndex, readSources } from "@/lib/intelligence/data";

export const metadata: Metadata = {
  title: "Monitoring · Earth's Hidden Signals",
  description: "Data freshness, internal screening alerts, official GDACS records and the latest anomalies for every country and research region.",
};

// Data pages re-render daily, so a pipeline refresh shows up without a redeploy.
export const revalidate = 86400;

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default async function MonitoringPage() {
  const [sources, alerts, current, index, evaluation] = await Promise.all([readSources(), readAlerts(), readCurrent(), readIndex(), readEvaluation()]);
  const names = Object.fromEntries(index.map((e) => [e.id, { en: e.name, bn: e.nameBn }]));
  const primary = index.filter((e) => e.kind !== "city");
  const active = alerts.computed.filter((a) => a.status === "active");
  const m = evaluation.metrics;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-12 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        <T en="Monitoring" bn="পর্যবেক্ষণ" />
      </h1>
      <p className="mt-4 max-w-[66ch] text-lg leading-relaxed text-ink-2">
        <T
          en={`Assessment of ${sources.asOf}. How fresh each dataset is, which screening alerts are active, what official records say, and how the latest periods compare with 1991–2020.`}
          bn={`${bnNum(sources.asOf)} তারিখের মূল্যায়ন। প্রতিটি তথ্যসেট কতটা নতুন, কোন স্ক্রিনিং সতর্কতা সক্রিয়, আনুষ্ঠানিক রেকর্ড কী বলে, আর সর্বশেষ সময় ১৯৯১–২০২০-এর তুলনায় কেমন।`}
        />
      </p>
      <div className="mt-5 max-w-3xl">
        <Disclaimer />
      </div>
      {sources.degraded.length > 0 && (
        <ul className="mt-4 max-w-3xl space-y-1 rounded-xl bg-watch-soft p-3 text-sm text-watch">
          {sources.degraded.map((d) => (
            <li key={d}><T en={d} bn="মাসিক তথ্য নেই: মূল্যায়ন সর্বশেষ সম্পূর্ণ মৌসুম ও বছর ব্যবহার করে। মাসিক মূল্যায়নের জন্য নেটওয়ার্কসহ --refresh চালান।" /></li>
          ))}
        </ul>
      )}

      <Section id="freshness" label={<T en="Freshness" bn="নতুনত্ব" />} title={<T en="Dataset age and staleness" bn="তথ্যসেটের বয়স ও পুরোনো হওয়া" />}>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-sunken text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-medium"><T en="Dataset" bn="তথ্যসেট" /></th>
                <th className="px-4 py-2.5 font-medium"><T en="Product" bn="পণ্য" /></th>
                <th className="px-4 py-2.5 font-medium"><T en="Observed through" bn="পর্যবেক্ষণ পর্যন্ত" /></th>
                <th className="px-4 py-2.5 text-right font-medium"><T en="Age (days)" bn="বয়স (দিন)" /></th>
                <th className="px-4 py-2.5 text-right font-medium"><T en="Usual delay" bn="স্বাভাবিক বিলম্ব" /></th>
                <th className="px-4 py-2.5 font-medium"><T en="Status" bn="অবস্থা" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sources.datasets.flatMap((d) =>
                d.products.map((p, i) => (
                  <tr key={`${d.datasetId}-${p.product}`} className="bg-card">
                    <td className="px-4 py-2.5 text-ink">{i === 0 ? `${d.name} ${d.version}` : ""}</td>
                    <td className="px-4 py-2.5 text-ink-2">{p.product}</td>
                    <td className="px-4 py-2.5 tabular-nums text-ink-2">{p.observedThrough}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{p.ageDays}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-3">{p.expectedLagDays ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {p.expectedLagDays === null ? (
                        <span className="text-xs text-ink-3"><T en="Closed archive" bn="বন্ধ আর্কাইভ" /></span>
                      ) : p.stale ? (
                        <span className="rounded-full bg-watch-soft px-2 py-0.5 text-xs font-medium text-watch"><T en="Stale" bn="পুরোনো" /></span>
                      ) : (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-ink"><T en="Current" bn="হালনাগাদ" /></span>
                      )}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          <T en={sources.latestMonthNoteEn} bn="সর্বশেষ মাস কেবল প্রসঙ্গের জন্য দেখানো হয়েছে; class-v1 দিয়ে শ্রেণিবদ্ধ করা হয়নি।" />
        </p>
      </Section>

      <Section id="alerts" label={<T en="Alerts" bn="সতর্কতা" />} title={<T en="Internal screening and official records" bn="অভ্যন্তরীণ স্ক্রিনিং ও আনুষ্ঠানিক রেকর্ড" />}>
        <p className="mb-4 max-w-[70ch] text-sm text-ink-2"><T en={alerts.noteEn} bn={alerts.noteBn} /></p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
              <T en={`Active internal alerts (${active.length})`} bn={`সক্রিয় অভ্যন্তরীণ সতর্কতা (${bnNum(active.length)})`} />
            </h3>
            <div className="mt-3 space-y-3">
              {active.map((a) => <AlertCard key={a.id} a={a} showLocation locationName={names[a.locationId]} />)}
              {!active.length && <p className="text-sm text-ink-3"><T en="None." bn="নেই।" /></p>}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
              <T en={`Official GDACS records, latest assessed year (${alerts.official.length})`} bn={`আনুষ্ঠানিক GDACS রেকর্ড (${bnNum(alerts.official.length)})`} />
            </h3>
            <div className="mt-3 space-y-3">
              {alerts.official
                .filter((a) => a.locationId === "study-area")
                .slice(-8)
                .reverse()
                .map((a) => <OfficialAlertCard key={a.id} a={a} />)}
            </div>
            <p className="mt-2 text-xs text-ink-3"><T en="The most recent records in the whole study area; each location page lists its own." bn="পুরো গবেষণা এলাকার সাম্প্রতিক রেকর্ড; প্রতিটি স্থানের পাতায় নিজস্ব তালিকা আছে।" /></p>
          </div>
        </div>
      </Section>

      <Section id="anomalies" label={<T en="Anomalies" bn="অস্বাভাবিকতা" />} title={<T en="Latest periods by country and region" bn="দেশ ও অঞ্চল অনুযায়ী সর্বশেষ সময়" />}>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-sunken text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-medium"><T en="Location" bn="স্থান" /></th>
                <th className="px-4 py-2.5 font-medium"><T en="Level" bn="স্তর" /></th>
                <th className="px-4 py-2.5 font-medium"><T en="Temperature (year)" bn="তাপমাত্রা (বছর)" /></th>
                <th className="px-4 py-2.5 font-medium"><T en="Temperature (monsoon)" bn="তাপমাত্রা (বর্ষা)" /></th>
                <th className="px-4 py-2.5 font-medium"><T en="Rainfall (monsoon)" bn="বৃষ্টি (বর্ষা)" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {primary.map((e) => {
                const ind = current.indicators[e.id] ?? {};
                const comp = current.composites[e.id] ?? {};
                const cell = (cls: string | null | undefined, dir: string | null | undefined, p?: number) => {
                  const l = classLabel(cls, dir);
                  return (
                    <>
                      <T en={l.en} bn={l.bn} />
                      {p !== undefined && <span className="ml-1 text-xs text-ink-3">P≈{Math.round(p)}</span>}
                    </>
                  );
                };
                const ta = ind["temperature_annual"];
                const tm = ind["temperature_monsoon"];
                const rm = comp["monsoon"];
                return (
                  <tr key={e.id} className="bg-card">
                    <td className="px-4 py-2.5">
                      <Link href={`/location/${e.id}`} className="font-medium text-accent hover:underline"><T en={e.name} bn={e.nameBn} /></Link>
                    </td>
                    <td className="px-4 py-2.5"><LevelBadge level={e.level} /></td>
                    <td className="px-4 py-2.5 text-ink-2">{ta && cell(ta.class, ta.direction, ta.percentile)} <span className="text-xs text-ink-3">{ta?.year}</span></td>
                    <td className="px-4 py-2.5 text-ink-2">{tm && cell(tm.class, tm.direction, tm.percentile)}</td>
                    <td className="px-4 py-2.5 text-ink-2">{rm && (rm.conflicting ? <T en="Mixed" bn="মিশ্র" /> : cell(rm.class, rm.direction))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="evaluation" label={<T en="Evaluation" bn="মূল্যায়ন" />} title={<T en="How well has screening worked?" bn="স্ক্রিনিং কতটা কাজ করেছে?" />}>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric en="Anomaly class agreement" bn="অস্বাভাবিকতা শ্রেণির মিল" value={m.anomalyDetectionAccuracy.value == null ? "—" : `${m.anomalyDetectionAccuracy.value}%`} />
          <Metric en="False-alarm rate" bn="ভুল সতর্কতার হার" value={pct(m.falseAlarmRate.value)} />
          <Metric en="Missed event years" bn="বাদ পড়া ঘটনার বছর" value={pct(m.missedEvents.value)} />
          <Metric en="Lead time" bn="আগাম সময়" value={m.leadTime.value == null ? <T en="Not computable" bn="গণনাযোগ্য নয়" /> : String(m.leadTime.value)} />
        </dl>
        <p className="mt-3 max-w-[70ch] text-sm text-ink-2">
          <T
            en="Seasonal screening rarely flagged the years with the most recorded events, so it should not be read as an early warning. The full backtest, definitions and limitations are on the methods page."
            bn="মৌসুমি স্ক্রিনিং সবচেয়ে বেশি ঘটনার বছরগুলো খুব কমই চিহ্নিত করেছে, তাই এটিকে আগাম সতর্কতা হিসেবে পড়া উচিত নয়। পুরো ব্যাকটেস্ট পদ্ধতি পাতায় আছে।"
          />
        </p>
        <Link href="/methods#evaluation" className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
          <T en="Full evaluation" bn="পূর্ণ মূল্যায়ন" />
        </Link>
      </Section>
    </div>
  );
}

function Metric({ en, bn, value }: { en: string; bn: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <dt className="text-xs text-ink-3"><T en={en} bn={bn} /></dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
