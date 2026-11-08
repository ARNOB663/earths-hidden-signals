import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Info } from "lucide-react";
import { T } from "@/lib/i18n";
import { bnNum } from "@/lib/bn";
import { readAccuracyFile, readBacktest } from "@/lib/signals/backtest";
import { Stat, pct } from "@/components/signal/levels";
import { Eyebrow } from "@/components/ui/primitive";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Accuracy · Earth's Hidden Signals",
  description:
    "A year-by-year backtest of the rain screen against the GDACS flood catalogue: true positives, false positives, false negatives, true negatives, lift over random years, reliability and the tests that failed.",
};

export default async function AccuracyPage() {
  const [audit, accuracy] = await Promise.all([readBacktest(), readAccuracyFile()]);
  const m = audit.metrics;
  const base = m.baseRate.value;
  // What lift means in counts: flags that hit vs what random years would have hit.
  const randomHits = base === null ? null : base * m.flags;
  const frameworks = Object.entries(accuracy.bySection);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <header>
        <Eyebrow en="Evaluation" bn="মূল্যায়ন" />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="Does the screen work?" bn="স্ক্রিনিং কি কাজ করে?" />
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          <T
            en="The rain screen is replayed year by year against the GDACS flood catalogue with only the information available at the time. The answer, below, is that it adds almost nothing over picking a year at random — and this page says so with the misses and false alarms attached."
            bn="বৃষ্টির স্ক্রিনিং শুধু তখনকার উপলভ্য তথ্য দিয়ে বছরে-বছরে GDACS বন্যা-ক্যাটালগের সাথে পুনরাবৃত্তি করা হয়। নিচের উত্তরটি হলো: এলোমেলোভাবে একটি বছর বাছাইয়ের তুলনায় এটি প্রায় কিছুই যোগ করে না — আর এই পাতাটি বাদ পড়ার ঘটনা ও ভুল সতর্কতাসহ তা বলে।"
          />
        </p>
        <p className="mt-2 text-xs text-ink-3">
          <T
            en={`Window ${audit.window[0]}–${audit.window[1]} · ${audit.totals.episodes} catalogued flood episodes · generated ${accuracy.generated} · source: signals/backtest.json`}
            bn={`সময়কাল ${audit.window[0]}–${audit.window[1]} · ${bnNum(audit.totals.episodes)}টি নথিভুক্ত বন্যা-ঘটনা · প্রস্তুত ${accuracy.generated} · উৎস: signals/backtest.json`}
          />
        </p>
      </header>

      {accuracy.missing.length > 0 && (
        <ul className="mt-4 rounded-xl border border-watch bg-watch-soft p-3 text-sm text-watch">
          {accuracy.missing.map((text) => (
            <li key={text}>
              <T en={text} bn="কিছু অংশ গণনা করা যায়নি।" />
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="method" className="mt-6">
        <h2 id="method" className="text-lg font-semibold text-ink">
          <T en="Backtesting methodology" bn="ব্যাকটেস্ট পদ্ধতি" />
        </h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          <li>
            <T
              en={audit.rule}
              bn="স্ক্রিনিং দুই ভাগে ভাগ: প্রাক-মৌসুমি (জানুয়ারি–জুন) ও মৌসুমি (জুলাই–ডিসেম্বর); ঘটনা তার শুরুর মাসের ভাগে পড়ে। যে বছরে ভাগটির বৃষ্টি তার আগের বছরের (অন্তত ৮ বছর) বৃষ্টির ৮০তম শতকরা বা তার বেশি হয়, সেই বছরটি চিহ্নিত হয়। বৃষ্টি বিশ্লেষণ-পাইপলাইনের নিজস্ব গ্রিড-সিরিজ, টাইলের কোষগুলোর গড়; প্রাক-মৌসুমি মান জানুয়ারি–মে মোট কারণ জুন-শুধু সিরিজ নেই।"
            />
          </li>
          <li>
            <T
              en={`No future information: the year being tested is never part of the baseline it is compared with. ${audit.baselineMinValues} earlier years are required before a year can be tested at all.`}
              bn={`ভবিষ্যতের তথ্য নেই: যে বছর পরীক্ষা করা হয় তা তার তুলনার ভিত্তিতে কখনো থাকে না। পরীক্ষার জন্য আগে অন্তত ${audit.baselineMinValues} বছরের মান দরকার।`}
            />
          </li>
          <li>
            <T
              en={`Events: ${audit.sources.events} ${audit.sources.episodeRule} An event year is a year with at least one episode starting in that season.`}
              bn={`ঘটনা: ${audit.sources.events} ${audit.sources.episodeRule} ঘটনার বছর মানে সেই মৌসুমে শুরু হওয়া অন্তত একটি ঘটনা।`}
            />
          </li>
          <li>
            <T
              en="Outcomes: a hit is a flagged year with a flood (true positive); a false alarm is a flagged year without one (false positive); a miss is an unflagged flood year (false negative); a correct rejection is an unflagged quiet year (true negative). Lift is precision divided by the share of tested years with a flood — the skill over picking a year at random."
              bn="ফলাফল: বন্যা থাকা চিহ্নিত বছর হিট (সত্য-ধনাত্মক); বন্যা না থাকা চিহ্নিত বছর ভুল সতর্কতা (মিথ্যা-ধনাত্মক); চিহ্নিত না হওয়া বন্যা-বছর বাদ পড়া (মিথ্যা-ঋণাত্মক); চিহ্নিত না হওয়া শান্ত বছর সঠিক বর্জন (সত্য-ঋণাত্মক)। লিফট হলো প্রিসিশন ভাগ পরীক্ষিত বছরে ঘটনার অনুপাত — এলোমেলো বছর বাছাইয়ের তুলনায় দক্ষতা।"
            />
          </li>
        </ol>
      </section>

      <section aria-labelledby="counts" className="mt-6">
        <h2 id="counts" className="text-lg font-semibold text-ink">
          <T en="The results" bn="ফলাফল" />
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat size="lg" label="True positives" labelBn="সত্য-ধনাত্মক" value={String(m.tp)} hint={`of ${m.eventYears} flood years`} hintBn={`${bnNum(m.eventYears)}টি বন্যা-বছরের মধ্যে`} />
          <Stat size="lg" label="False positives" labelBn="মিথ্যা-ধনাত্মক" value={String(m.fp)} hint={`of ${m.tested - m.eventYears} quiet years`} hintBn={`${bnNum(m.tested - m.eventYears)}টি শান্ত বছরের মধ্যে`} />
          <Stat size="lg" label="False negatives (misses)" labelBn="মিথ্যা-ঋণাত্মক (বাদ)" value={String(m.fn)} hint={`of ${m.eventYears} flood years`} hintBn={`${bnNum(m.eventYears)}টি বন্যা-বছরের মধ্যে`} />
          <Stat size="lg" label="True negatives" labelBn="সত্য-ঋণাত্মক" value={String(m.tn)} hint={`of ${m.tested - m.eventYears} quiet years`} hintBn={`${bnNum(m.tested - m.eventYears)}টি শান্ত বছরের মধ্যে`} />
        </dl>
        <p className="mt-2 text-xs tabular-nums text-ink-3">
          <T
            en={`${m.tested} dates tested (3 tiles × 2 seasons × 26 years) · ${m.eventYears} were flood years · ${m.flags} flags raised.`}
            bn={`${bnNum(m.tested)}টি তারিখ পরীক্ষা (৩ টাইল × ২ মৌসুম × ২৬ বছর) · ${bnNum(m.eventYears)}টি বন্যা-বছর · ${bnNum(m.flags)}টি সতর্কতা।`}
          />
        </p>
      </section>

      <section aria-labelledby="rates" className="mt-6">
        <h2 id="rates" className="text-lg font-semibold text-ink">
          <T en="Rates, intervals and lift" bn="হার, ব্যবধান ও লিফট" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="Every rate carries its sample size and a 95% Wilson score interval. None of these is an accuracy score for the platform: they measure one specific, simple rule."
            bn="প্রতিটি হারে নমুনার আকার ও ৯৫% উইলসন স্কোর ব্যবধান আছে। এর কোনোটিই প্ল্যাটফর্মের নির্ভুলতা-স্কোর নয়: এগুলো একটি নির্দিষ্ট, সরল নিয়ম মাপে।"
          />
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="text-xs text-ink-3">
                <th scope="col" className="py-1.5 font-medium"><T en="Measure" bn="পরিমাপ" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Value" bn="মান" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="95% interval" bn="৯৫% ব্যবধান" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Sample" bn="নমুনা" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                { name: "Flood frequency in tested years (base rate)", bn: "পরীক্ষিত বছরে বন্যার হার (ভিত্তি হার)", metric: m.baseRate },
                { name: "Detection rate (hits ÷ flood years)", bn: "শনাক্তের হার (হিট ÷ বন্যা-বছর)", metric: m.hitRate },
                { name: "False-alarm rate (false alarms ÷ quiet years)", bn: "ভুল সতর্কতার হার (মিথ্যা সতর্কতা ÷ শান্ত বছর)", metric: m.falseAlarmRate },
                { name: "Precision (hits ÷ flags)", bn: "প্রিসিশন (হিট ÷ সতর্কতা)", metric: m.precision },
                { name: "Correct rejection (true negatives ÷ quiet years)", bn: "সঠিক বর্জন (সত্য-ঋণাত্মক ÷ শান্ত বছর)", metric: m.correctRejectionRate },
              ].map((row) => (
                <tr key={row.name}>
                  <th scope="row" className="py-2 pr-3 font-normal text-ink"><T en={row.name} bn={row.bn} /></th>
                  <td className="py-2 text-right tabular-nums text-ink">{pct(row.metric.value, 1)}</td>
                  <td className="py-2 text-right tabular-nums text-ink-2">{row.metric.low === null ? "–" : `${pct(row.metric.low, 0)}–${pct(row.metric.high, 0)}`}</td>
                  <td className="py-2 text-right tabular-nums text-ink-3">{row.metric.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-card p-4">
            <p className="text-xs text-ink-3">
              <T en="Lift over random years" bn="এলোমেলো বছরের তুলনায় লিফট" />
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-ink">{m.lift === null ? "–" : m.lift.toFixed(2)}</p>
            <p className="mt-1 text-xs text-ink-2">
              <T
                en={m.liftInterval ? `95% interval ${m.liftInterval.low.toFixed(2)}–${m.liftInterval.high.toFixed(2)}. ${m.liftExcludesOne ? "The interval excludes 1." : "The interval includes 1, so the screen is indistinguishable from picking a year at random."}` : "No interval can be computed."}
                bn={m.liftInterval ? `৯৫% ব্যবধান ${m.liftInterval.low.toFixed(2)}–${m.liftInterval.high.toFixed(2)}। ${m.liftExcludesOne ? "ব্যবধানটি ১ বাদ দেয়।" : "ব্যবধানে ১ আছে, তাই নির্বিচারে বছর বাছাই থেকে এই স্ক্রিনিং আলাদা করা যায় না।"}` : "কোনো ব্যবধান গণনা করা যায় না।"}
              />
            </p>
          </div>
          <div className="rounded-xl border border-line bg-card p-4">
            <p className="text-xs text-ink-3">
              <T en="In counts" bn="সংখ্যায়" />
            </p>
            <p className="mt-0.5 text-sm text-ink">
              {randomHits === null ? (
                <T en="Not computable." bn="গণনা করা যায় না।" />
              ) : (
                <T
                  en={`The ${m.flags} flags hit ${m.tp} flood years. Random years would have hit about ${randomHits.toFixed(1)}.`}
                  bn={`${bnNum(m.flags)}টি সতর্কতা ${bnNum(m.tp)}টি বন্যা-বছরে আঘাত করেছে। এলোমেলো বছর হলে প্রায় ${randomHits.toFixed(1)}টিতে আঘাত করত।`}
                />
              )}
            </p>
            <p className="mt-1 text-xs text-ink-3">
              <T
                en="By season:"
                bn="মৌসুম অনুযায়ী:"
              />{" "}
              {frameworks.map(([section, counts], index) => (
                <span key={section} className="tabular-nums">
                  {index > 0 && " · "}
                  {section === "monsoon" ? <T en="monsoon" bn="মৌসুমি" /> : <T en="pre-monsoon" bn="প্রাক-মৌসুমি" />} TP {counts.tp} / FP {counts.fp} / FN {counts.fn} / TN {counts.tn}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="reliability" className="mt-6">
        <h2 id="reliability" className="text-lg font-semibold text-ink">
          <T en="Reliability (calibration)" bn="নির্ভরযোগ্যতা (ক্যালিব্রেশন)" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="How often a flood was catalogued in each rain band. A useful screen should rise from the lower bands to the upper one; here the three are statistically indistinguishable."
            bn="প্রতিটি বৃষ্টির স্তরে কতবার বন্যা নথিভুক্ত হয়েছিল। কার্যকর স্ক্রিনিং নিচের স্তর থেকে উপরের স্তরে ওঠে; এখানে তিনটি পরিসংখ্যানগতভাবে আলাদা নয়।"
          />
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">
              <T en="Observed flood rate per rain band with sample size and interval" bn="নমুনার আকার ও ব্যবধানসহ প্রতিটি বৃষ্টির স্তরে পর্যবেক্ষিত বন্যার হার" />
            </caption>
            <thead>
              <tr className="text-xs text-ink-3">
                <th scope="col" className="py-1.5 font-medium"><T en="Rain band" bn="বৃষ্টির স্তর" /></th>
                <th scope="col" className="py-1.5 font-medium"><T en="Observed flood rate" bn="পর্যবেক্ষিত বন্যার হার" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="95% interval" bn="৯৫% ব্যবধান" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="n" bn="নমুনা" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {audit.reliability.map((band) => (
                <tr key={band.band}>
                  <th scope="row" className="py-2 pr-3 font-normal text-ink">
                    {band.band === "below the baseline median" ? (
                      <T en="Below the baseline median" bn="ভিত্তি-মধ্যকের নিচে" />
                    ) : band.band === "median to the 80th percentile" ? (
                      <T en="Median to the 80th percentile" bn="মধ্যক থেকে ৮০তম শতকরা" />
                    ) : (
                      <T en="80th percentile or above (flagged)" bn="৮০তম শতকরা বা তার বেশি (চিহ্নিত)" />
                    )}
                  </th>
                  <td className="py-2">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className="h-2 w-24 overflow-hidden rounded-full bg-sunken">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${(band.value ?? 0) * 100}%` }} />
                      </span>
                      <span className="tabular-nums text-ink">{pct(band.value, 1)}</span>
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-2">{band.low === null ? "–" : `${pct(band.low, 0)}–${pct(band.high, 0)}`}</td>
                  <td className="py-2 text-right tabular-nums text-ink-3">{band.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="failed" className="mt-6">
        <h2 id="failed" className="text-lg font-semibold text-ink">
          <T en="Limitations and failed tests" bn="সীমাবদ্ধতা ও ব্যর্থ পরীক্ষা" />
        </h2>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">
          {[
            {
              en: "Lead time fails. No flag arrives even 30 days before an episode. The rain measurements months later cannot be known in advance, so the screen as tested warns nobody in time — see the Replay page's lead-time table.",
              bn: "আগাম সতর্কতা ব্যর্থ। কোনো ঘটনার ৩০ দিন আগেও কোনো সতর্কতা আসে না। মাস পরে জানা বৃষ্টির পরিমাপ আগেই জানা যায় না, তাই পরীক্ষিত স্ক্রিনিং কাউকে সময়মতো সতর্ক করে না — পুনরাবৃত্তি পাতার আগাম-সময়ের ছক দেখুন।",
            },
            {
              en: "The monsoon screen is almost always right by accident: floods are catalogued somewhere in a tile in most years, so the base rate itself is high and precision says little.",
              bn: "মৌসুমি স্ক্রিনিং প্রায় সবসময় আকস্মিকভাবেই সঠিক: বেশিরভাগ বছরেই কোনো না কোনো স্থানে বন্যা নথিভুক্ত, তাই ভিত্তি হার নিজেই উঁচু এবং প্রিসিশন কম বলে।",
            },
            {
              en: "The catalogue is incomplete. GDACS flood alerts are news-based and uneven over 2000–2025, and a missing record is counted as no flood. Detection rates are therefore lower bounds.",
              bn: "ক্যাটালগ অসম্পূর্ণ। GDACS বন্যা-সতর্কতা সংবাদভিত্তিক এবং ২০০০–২০২৫ জুড়ে অসম, আর অনুপস্থিত রেকর্ডকে বন্যা-নয় বলে গোনা হয়। তাই শনাক্তের হার নিম্নসীমা।",
            },
            {
              en: "Annual and seasonal rain is far coarser than the event. A flood at one point in a 10°-wide tile is compared with rain averaged over the whole tile.",
              bn: "বার্ষিক ও মৌসুমি বৃষ্টি ঘটনার চেয়ে অনেক মোটা। ১০° চওড়া টাইলের একটি বিন্দুর বন্যা পুরো টাইলের গড় বৃষ্টির সাথে তুলনা করা হয়।",
            },
            {
              en: "Few cases. 26 seasons per tile, and sometimes one quiet year. Interval widths above show how little can be concluded from counts this small.",
              bn: "অল্প ক্ষেত্র। প্রতি টাইলে ২৬টি মৌসুম, কখনো মাত্র একটি শান্ত বছর। উপরের ব্যবধানের প্রস্থ দেখায় এত ছোট সংখ্যা থেকে কত কম সিদ্ধান্ত টানা যায়।",
            },
          ].map((item) => (
            <li key={item.en} className="flex gap-2">
              <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0 text-watch" />
              <T en={item.en} bn={item.bn} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="outlook" className="mt-6 rounded-2xl border border-line bg-sunken p-4">
        <h2 id="outlook" className="text-base font-semibold text-ink">
          <T en="Experimental Outlook" bn="পরীক্ষামূলক পূর্বাভাস" />
        </h2>
        <p className="mt-1 text-sm font-semibold text-ink">
          <T en={accuracy.outlookEligible.verdict} bn="এখানে যথেষ্ট প্রমাণ নেই।" />
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-2">
          <Info size={13} aria-hidden className="mt-0.5 shrink-0" />
          <T
            en="An Outlook may only be displayed when every condition holds. None is presented on this site."
            bn="সব শর্ত পূরণ হলে তবেই কোনো পূর্বাভাস দেখানো যায়। এই সাইটে কোনোটিই দেখানো হয় না।"
          />
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {accuracy.outlookEligible.checks.map((check) => (
            <li key={check.id} className="flex gap-2">
              <span aria-hidden className={`mt-1.5 block h-2 w-2 shrink-0 rounded-full ${check.pass ? "bg-accent" : "border border-ink-3"}`} />
              <span className="text-ink-2">
                <T en={`${check.pass ? "Met" : "Not met"}: ${check.text}`} bn={`${check.pass ? "পূরণ হয়েছে" : "পূরণ হয়নি"}: ${check.text}`} />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs font-medium text-ink-2">
          <T en="Experimental. Not a forecast. Not an official warning." bn="পরীক্ষামূলক। পূর্বাভাস নয়। সরকারি সতর্কবার্তা নয়।" />
        </p>
      </section>

      <nav className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/replay" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-ink-2 hover:text-ink">
          <T en="Replay an event year by year" bn="বছরে-বছরে পুনরাবৃত্তি" />
          <ArrowRight size={15} aria-hidden />
        </Link>
        <Link href="/gap" className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-ink-2 hover:text-ink">
          <T en="Where coverage ends" bn="আচ্ছাদন কোথায় শেষ" />
        </Link>
        <Link href="/methods#validation" className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-ink-2 hover:text-ink">
          <T en="Full methods" bn="সম্পূর্ণ পদ্ধতি" />
        </Link>
        <Link href="/future-outlook#risk-hdg" className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-ink-2 hover:text-ink">
          <T en="Disaster-year model scorecard" bn="দুর্যোগ-বছর মডেলের স্কোরকার্ড" />
        </Link>
      </nav>
    </main>
  );
}
