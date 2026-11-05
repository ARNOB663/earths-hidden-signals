import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReplayExplorer } from "@/components/signal/ReplayExplorer";
import { T } from "@/lib/i18n";
import { bnNum } from "@/lib/bn";
import { readBacktest } from "@/lib/signals/backtest";
import { pct } from "@/components/signal/levels";
import { Eyebrow } from "@/components/ui/primitive";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Replay · Earth's Hidden Signals",
  description:
    "A year-by-year replay of the rain screen against catalogued South Asian floods: historical rain, the threshold available at the time, hits, misses and false alarms.",
};

export default async function ReplayPage() {
  const audit = await readBacktest();
  const m = audit.metrics;
  const quiet = m.tested - m.eventYears;
  const latestLead = audit.replay[0]?.leads.at(-1);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <header>
        <Eyebrow en="History, replayed" bn="ইতিহাস, পুনরাবৃত্ত" />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="Replay: could this have been seen?" bn="পুনরাবৃত্তি: এটি কি আগে বোঝা যেত?" />
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          <T
            en="Every year from 2000 to 2025 is replayed for each of the three rain tiles, with the same data the screen would have had at the time. Scrub through the years to see the rain, the threshold, the flag and the floods that followed — hits and misses alike."
            bn="২০০০ থেকে ২০২৫ প্রতিটি বছর তিনটি বৃষ্টি-টাইলের জন্য পুনরাবৃত্তি করা হয়, স্ক্রিনিং তখন যে তথ্য পেত তা দিয়েই। বছর ধরে স্ক্রল করে বৃষ্টি, সীমা, সতর্কতা এবং পরবর্তী বন্যা দেখুন — হিট ও বাদ পড়া দুটোই।"
          />
        </p>
        <p className="mt-2 text-xs tabular-nums text-ink-3">
          <T
            en={`${audit.totals.episodes} catalogued episodes · ${m.tested} tested seasons · rain: ${audit.sources.rain.monsoon} and ${audit.sources.rain["pre-monsoon"]} · events: GDACS`}
            bn={`${bnNum(audit.totals.episodes)}টি নথিভুক্ত ঘটনা · ${bnNum(m.tested)}টি পরীক্ষিত মৌসুম · বৃষ্টি: ${audit.sources.rain.monsoon} ও ${audit.sources.rain["pre-monsoon"]} · ঘটনা: GDACS`}
          />
        </p>
      </header>

      <ReplayExplorer audit={audit} />

      <section aria-labelledby="tally" className="mt-8">
        <h2 id="tally" className="text-lg font-semibold text-ink">
          <T en="The full tally, all tiles and seasons" bn="সম্পূর্ণ হিসাব, সব টাইল ও মৌসুম" />
        </h2>
        <table className="mt-2 w-full text-left text-sm">
          <caption className="sr-only">
            <T en="Hits, false alarms, misses and correct rejections with their denominators" bn="হিট, ভুল সতর্কতা, বাদ পড়া ও সঠিক বর্জন তাদের হরের সাথে" />
          </caption>
          <thead>
            <tr className="text-xs text-ink-3">
              <th scope="col" className="py-1.5 font-medium"><T en="Outcome" bn="ফলাফল" /></th>
              <th scope="col" className="py-1.5 text-right font-medium"><T en="Count" bn="সংখ্যা" /></th>
              <th scope="col" className="py-1.5 text-right font-medium"><T en="Of" bn="এর মধ্যে" /></th>
              <th scope="col" className="py-1.5 text-right font-medium"><T en="Rate (95% interval)" bn="হার (৯৫% ব্যবধান)" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[
              { en: "Hits (flood years the screen flagged)", bn: "হিট (সতর্ক করা বন্যা-বছর)", n: m.tp, of: m.eventYears, metric: m.hitRate, tone: "accent" },
              { en: "Misses (flood years it did not flag)", bn: "বাদ (সতর্ক না করা বন্যা-বছর)", n: m.fn, of: m.eventYears, metric: null, tone: "alert" },
              { en: "False alarms (quiet years it flagged)", bn: "ভুল সতর্কতা (সতর্ক করা শান্ত বছর)", n: m.fp, of: quiet, metric: m.falseAlarmRate, tone: "watch" },
              { en: "Correct rejections (quiet years it did not flag)", bn: "সঠিক বর্জন (সতর্ক না করা শান্ত বছর)", n: m.tn, of: quiet, metric: m.correctRejectionRate, tone: "neutral" },
            ].map((row) => (
              <tr key={row.en}>
                <th scope="row" className="py-2 pr-3 font-normal text-ink">
                  <T en={row.en} bn={row.bn} />
                </th>
                <td className="py-2 text-right tabular-nums text-ink">{row.n}</td>
                <td className="py-2 text-right tabular-nums text-ink-2">{row.of}</td>
                <td className="py-2 text-right tabular-nums text-ink-2">
                  {row.metric
                    ? `${pct(row.metric.value, 1)} (${pct(row.metric.low, 0)}–${pct(row.metric.high, 0)})`
                    : pct(row.of ? row.n / row.of : null, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-3">
          <T
            en={`${m.eventYears} of ${m.tested} tested seasons had a catalogued flood. Rates are shares of those denominators, with Wilson score intervals; the full evaluation is on the Accuracy page.`}
            bn={`${bnNum(m.tested)}টি পরীক্ষিত মৌসুমের ${bnNum(m.eventYears)}টিতে নথিভুক্ত বন্যা ছিল। হারগুলো সেই হরের অনুপাত, উইলসন স্কোর ব্যবধানসহ; সম্পূর্ণ মূল্যায়ন নির্ভুলতা পাতায়।`}
          />
        </p>
      </section>

      <section aria-labelledby="lead" className="mt-8">
        <h2 id="lead" className="text-lg font-semibold text-ink">
          <T en="Lead time: a failure worth showing" bn="আগাম সময়: দেখানোর যোগ্য একটি ব্যর্থতা" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en={`A flag is counted as a lead for an episode only when it was issued at a season start at most ${audit.scoringDays} days before the episode began. Across the whole window, ${latestLead ? pct(latestLead.detectedShare, 1) : "–"} of episodes had any flag within ${audit.scoringDays} days.`}
            bn={`কোনো ঘটনার আগে মৌসুমের শুরুতে জারি করা সতর্কতা কেবল তখনই আগাম সময় হিসেবে গোনা হয় যদি ঘটনা শুরু হওয়ার আগে তা ${audit.scoringDays} দিনের মধ্যে হয়। পুরো সময়কালে ঘটনার ${latestLead ? pct(latestLead.detectedShare, 1) : "–"} ক্ষেত্রে ${audit.scoringDays} দিনের মধ্যে কোনো সতর্কতা ছিল।`}
          />
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {audit.replay.map((tile) => {
            const last = tile.leads.at(-1);
            return (
              <div key={tile.tile} className="rounded-xl border border-line bg-card p-3">
                <p className="text-sm font-medium text-ink">{tile.label}</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-ink">{last ? pct(last.detectedShare, 1) : "–"}</p>
                <p className="text-xs text-ink-3">
                  <T en={`${last?.hit ?? 0} of ${tile.episodeTotal} episodes had a flag within ${audit.scoringDays} days`} bn={`${tile.episodeTotal}টির মধ্যে ${last?.hit ?? 0}টি ঘটনায় ${audit.scoringDays} দিনের মধ্যে সতর্কতা ছিল`} />
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 rounded-xl border border-line bg-sunken p-3 text-xs text-ink-2">
          <T
            en="This screen reads rain after the season ends; it cannot warn in advance. The forecast-based path the project planned is not displayed because it does not yet meet the evidence conditions (see Accuracy)."
            bn="এই স্ক্রিনিং মৌসুম শেষ হওয়ার পর বৃষ্টি পড়ে; এটি আগাম সতর্ক করতে পারে না। প্রকল্পের পরিকল্পিত পূর্বাভাসভিত্তিক পথ দেখানো হয় না কারণ এটি এখনো প্রমাণের শর্ত পূরণ করে না (নির্ভুলতা দেখুন)।"
          />
        </p>
      </section>

      <section aria-labelledby="unavailable" className="mt-8">
        <h2 id="unavailable" className="text-lg font-semibold text-ink">
          <T en="What this replay cannot use" bn="এই পুনরাবৃত্তি যা ব্যবহার করতে পারে না" />
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-2">
          <li>
            <T
              en="The daily satellite rain screen itself. Its daily series are sample data on this site and IMERG replays have not been built, so the replay uses the analysis pipeline's annual and seasonal gridded rainfall instead — a different, coarser product, stated with every number."
              bn="দৈনিক স্যাটেলাইট বৃষ্টি-স্ক্রিনিং নিজেই। এই সাইটে তার দৈনিক সিরিজ নমুনা তথ্য এবং IMERG পুনরাবৃত্তি তৈরি হয়নি, তাই পুনরাবৃত্তি বিশ্লেষণ-পাইপলাইনের বার্ষিক ও মৌসুমি গ্রিড বৃষ্টি ব্যবহার করে — ভিন্ন, মোটা একটি পণ্য, প্রতিটি সংখ্যার সাথে তা বলা।"
            />
          </li>
          <li>
            <T
              en="Floods before 2000 or outside the three tiles: they are not in a tile's calendar, so they neither count as hits nor as misses."
              bn="২০০০ সালের আগের বা তিনটি টাইলের বাইরের বন্যা: এগুলো কোনো টাইলের ক্যালেন্ডারে নেই, তাই হিট বা হিট-অনুপস্থিত কোনোটিই নয়।"
            />
          </li>
          <li>
            <T
              en="Years without enough earlier rainfall. They are drawn as dashed and marked Not tested, never as a correct rejection."
              bn="যথেষ্ট আগের বৃষ্টি নেই এমন বছর। এগুলো ড্যাশ ও ‘পরীক্ষা হয়নি’ হিসেবে আঁকা হয়, কখনো ‘সঠিক বর্জন’ হিসেবে নয়।"
            />
          </li>
        </ul>
      </section>

      <nav className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/accuracy" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-ink-2 hover:text-ink">
          <T en="Full evaluation and intervals" bn="সম্পূর্ণ মূল্যায়ন ও ব্যবধান" />
          <ArrowRight size={15} aria-hidden />
        </Link>
        <Link href="/methods#validation" className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-ink-2 hover:text-ink">
          <T en="How the backtest works" bn="ব্যাকটেস্ট কীভাবে কাজ করে" />
        </Link>
      </nav>
    </main>
  );
}
