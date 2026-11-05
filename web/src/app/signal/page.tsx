import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CloudRain, ExternalLink, Microscope, Radio, ShieldAlert } from "lucide-react";
import { T } from "@/lib/i18n";
import { bnNum } from "@/lib/bn";
import { loadModel } from "@/lib/signals/model";
import type { SignalMapArea } from "@/components/signal/SignalMap";
import { SignalExplorer } from "@/components/signal/SignalExplorer";
import { CoverageBadge, Stat, WatchBadge } from "@/components/signal/levels";
import { readMapAreas } from "@/lib/signals/map";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Signal · Earth's Hidden Signals",
  description:
    "What the rain is doing in each covered district and state of South Asia, against its own history: Watch Level, Data Trust Grade, historical flood frequency and the limits of the data. Not a forecast or an official warning.",
};

export default async function SignalPage() {
  const [model, map] = await Promise.all([loadModel(), readMapAreas()]);
  const { rows, brief, counts, sample } = model;
  const areas: SignalMapArea[] = rows
    .map((row) => {
      const outline = map.areas[row.id];
      if (!outline) return null;
      return {
        id: row.id,
        name: row.name,
        level: row.level,
        watch: row.watch,
        coverage: row.coverage,
        trust: row.trust,
        rings: outline.rings,
      };
    })
    .filter((area): area is SignalMapArea => area !== null);

  // The two worked examples are chosen from the data, never typed in: the one with the largest
  // case set, and the one whose spacing leaves out most of its districts.
  const frequencyReady = rows
    .filter((row) => row.frequency.state === "ok" && (row.frequency.counts.cases ?? 0) >= brief.intervalCases)
    .sort((a, b) => (b.frequency.counts.cases ?? 0) - (a.frequency.counts.cases ?? 0));
  const exemplar = frequencyReady[0] ?? null;
  const seasonal = rows.find((row) => row.coverage === "seasonal") ?? null;
  const latest = brief.latest;
  const latestRain = brief.latestRain;

  // Coverage status by country, computed from the rows on the page — each count travels with the
  // number of areas it is a share of, so no share is shown without its denominator.
  const byCountry = new Map<
    string,
    { code: string; name: string; nameBn: string; total: number; live: number; seasonal: number; cantTell: number; withCases: number }
  >();
  for (const row of rows) {
    const entry = byCountry.get(row.country) ?? {
      code: row.country,
      name: row.countryName,
      nameBn: row.countryBn,
      total: 0,
      live: 0,
      seasonal: 0,
      cantTell: 0,
      withCases: 0,
    };
    entry.total += 1;
    if (row.coverage === "live") entry.live += 1;
    else if (row.coverage === "seasonal") entry.seasonal += 1;
    else entry.cantTell += 1;
    if (row.frequency.state === "ok" && (row.frequency.level?.cases ?? 0) >= brief.intervalCases) entry.withCases += 1;
    byCountry.set(row.country, entry);
  }
  const countryRows = [...byCountry.values()].sort((a, b) => b.total - a.total);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          <T en="Signal Watch" bn="সংকেত পর্যবেক্ষণ" />
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="Is today normal here?" bn="আজ এখানে কি স্বাভাবিক?" />
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          <T
            en="One question per location: how does today's rain compare with every same date in the area's own record, and what has historical evidence said about rain at this level? Every location also states how far its data can be trusted, and where it cannot answer at all."
            bn="প্রতিটি স্থানের জন্য একটি প্রশ্ন: আজকের বৃষ্টি এই এলাকার নিজস্ব রেকর্ডের প্রতিটি একই তারিখের তুলনায় কেমন, আর এই মাত্রার বৃষ্টিতে ঐতিহাসিক প্রমাণ কী বলেছে? প্রতিটি স্থান আরও বলে তার তথ্য কতটুকু ভরসাযোগ্য, এবং কোথায় তা আদৌ উত্তর দিতে পারে না।"
          />
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-ink-2">
            <Radio size={14} aria-hidden className="text-accent-strong" />
            <T en="Observational screening · not a forecast" bn="পর্যবেক্ষণভিত্তিক স্ক্রিনিং · পূর্বাভাস নয়" />
          </span>
          <a
            href={brief.official.wmo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-ink-2 hover:text-ink"
          >
            <ShieldAlert size={14} aria-hidden />
            <T en="Official warnings (WMO SWIC)" bn="সরকারি সতর্কবার্তা (WMO SWIC)" />
            <ExternalLink size={12} aria-hidden />
          </a>
          <span className="text-ink-3">
            <T en={brief.official.line} bn="এটি পূর্বাভাস বা সরকারি সতর্কবার্তা নয়।" />
          </span>
        </div>
      </header>

      {sample && (
        <p role="status" className="mt-4 rounded-xl border border-watch bg-watch-soft px-4 py-2 text-sm text-watch">
          <T
            en="SAMPLE DATA — the rain readings behind this page are fixed samples, not real observations. Coverage counts, historical case sizes and the backtest on /accuracy come from real datasets."
            bn="নমুনা তথ্য — এই পাতার বৃষ্টির পাঠ স্থির নমুনা, বাস্তব পর্যবেক্ষণ নয়। আচ্ছাদনের সংখ্যা, ঐতিহাসিক নমুনার আকার এবং /accuracy-এর ব্যাকটেস্ট বাস্তব তথ্যসেট থেকে।"
          />
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Locations" labelBn="স্থান" value={counts.places.toLocaleString("en")} hint={`${counts.countries} countries`} hintBn={`${bnNum(counts.countries)} দেশ`} />
        <Stat label="Live Signal" labelBn="সরাসরি সংকেত" value={counts.live.toLocaleString("en")} hint="current rain observation" hintBn="সাম্প্রতিক বৃষ্টি-পর্যবেক্ষণ" />
        <Stat
          label="Seasonal Context Only"
          labelBn="কেবল মৌসুমি প্রেক্ষাপট"
          value={counts.seasonal.toLocaleString("en")}
          hint="no current reading"
          hintBn="সাম্প্রতিক পাঠ নেই"
        />
        <Stat
          label="Can’t Tell Here"
          labelBn="এখানে বলা সম্ভব নয়"
          value={counts.cantTell.toLocaleString("en")}
          hint="missing, sparse or stale data"
          hintBn="অনুপস্থিত, বিরল বা পুরোনো তথ্য"
        />
      </dl>

      <section aria-labelledby="coverage-by-country" className="mt-6">
        <h2 id="coverage-by-country" className="text-lg font-semibold text-ink">
          <T en="Coverage status by country" bn="দেশ অনুযায়ী আচ্ছাদন" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en={`Every count below is a share of the areas listed for that country, and every historical-frequency count carries the number of cases it is based on. A district whose rain is not covered is shown as Seasonal Context Only or Can't Tell Here — never as a calm or safe area.`}
            bn={`নিচের প্রতিটি সংখ্যা সেই দেশের তালিকাভুক্ত এলাকার একটি অনুপাত, আর প্রতিটি ঐতিহাসিক-ফ্রিকোয়েন্সি সংখ্যার সাথে তার ভিত্তি-ক্ষেত্রের সংখ্যা আছে। যেসব জেলার বৃষ্টি ঢাকা পড়ে না সেগুলো ‘কেবল মৌসুমি প্রেক্ষাপট’ বা ‘এখানে বলা সম্ভব নয়’ হিসেবে দেখানো হয় — কখনো শান্ত বা নিরাপদ এলাকা হিসেবে নয়।`}
          />
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">
              <T en="Coverage state counts per country, each with its area denominator" bn="দেশ অনুযায়ী আচ্ছাদন-অবস্থার সংখ্যা, প্রতিটির এলাকা-হরসহ" />
            </caption>
            <thead>
              <tr className="text-xs text-ink-3">
                <th scope="col" className="py-1.5 pr-3 font-medium"><T en="Country" bn="দেশ" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Areas" bn="এলাকা" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Live Signal" bn="সরাসরি সংকেত" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Seasonal" bn="মৌসুমি" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Can't tell" bn="বলা যায় না" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Frequency ready" bn="ফ্রিকোয়েন্সি প্রস্তুত" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {countryRows.map((entry) => (
                <tr key={entry.code}>
                  <th scope="row" className="py-2 pr-3 font-normal text-ink">
                    {entry.name} <span className="text-ink-3">({entry.code})</span>
                  </th>
                  <td className="py-2 text-right tabular-nums text-ink">{entry.total}</td>
                  <td className="py-2 text-right tabular-nums text-ink">{entry.live} <span className="text-xs text-ink-3">/ {entry.total}</span></td>
                  <td className="py-2 text-right tabular-nums text-ink-2">{entry.seasonal} <span className="text-xs text-ink-3">/ {entry.total}</span></td>
                  <td className="py-2 text-right tabular-nums text-ink-2">{entry.cantTell} <span className="text-xs text-ink-3">/ {entry.total}</span></td>
                  <td className="py-2 text-right tabular-nums text-ink-2">{entry.withCases} <span className="text-xs text-ink-3">/ {entry.total}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          <T
            en={`"Frequency ready" counts areas where at least ${brief.intervalCases} historical cases carry both a rain total and a catalogue query — the minimum the site uses before it will show a frequency at all.`}
            bn={`"ফ্রিকোয়েন্সি প্রস্তুত" মানে যেসব এলাকায় অন্তত ${bnNum(brief.intervalCases)}টি ঐতিহাসিক ক্ষেত্রে বৃষ্টির মোট ও ক্যাটালগ-অনুসন্ধান দুটোই আছে — কোনো ফ্রিকোয়েন্সি দেখানোর আগে কেবল এই ন্যূনতম শর্ত পূরণ করতে হয়।`}
          />
        </p>
      </section>

      <SignalExplorer rows={rows} areas={areas} countries={model.countries} initialId={null} />

      <section aria-labelledby="how" className="mt-10">
        <h2 id="how" className="text-lg font-semibold text-ink">
          <T en="How to read a Signal: three steps" bn="সংকেত কীভাবে পড়বেন: তিনটি ধাপ" />
        </h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            {
              Icon: Radio,
              n: "1",
              en: { t: "What is observed", b: "Is there a current rain reading here, how old is it, and where does it come from?" },
              bn: { t: "কী পর্যবেক্ষণ করা হচ্ছে", b: "এখানে কি সাম্প্রতিক বৃষ্টির পাঠ আছে, কত পুরোনো, আর তা কোথা থেকে আসে?" },
            },
            {
              Icon: Microscope,
              n: "2",
              en: { t: "Is it unusual", b: "Compare the reading with the same date in every past year, then set a Watch Level." },
              bn: { t: "এটি কি অস্বাভাবিক", b: "পাঠটিকে প্রতিটি আগের বছরের একই তারিখের সাথে তুলনা করা হয়, তারপর সতর্কতার মাত্রা নির্ধারিত হয়।" },
            },
            {
              Icon: CloudRain,
              n: "3",
              en: { t: "What history shows", b: "In past years with this much rain, how often were floods catalogued — with the sample size shown." },
              bn: { t: "ইতিহাস কী দেখায়", b: "এই পরিমাণ বৃষ্টি ছিল এমন আগের বছরগুলোয় কতবার বন্যা নথিভুক্ত হয়েছিল — নমুনার আকারসহ।" },
            },
          ].map((step) => (
            <li key={step.n} className="rounded-2xl border border-line bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-xs text-accent-strong">{step.n}</span>
                <step.Icon size={16} aria-hidden className="text-ink-3" />
                <T en={step.en.t} bn={step.bn.t} />
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                <T en={step.en.b} bn={step.bn.b} />
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="examples" className="mt-10">
        <h2 id="examples" className="text-lg font-semibold text-ink">
          <T en="One example that answers, one that cannot" bn="একটি উদাহরণ যেটি উত্তর দেয়, একটি যেটি পারে না" />
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {exemplar && (
            <article className="rounded-2xl border border-line bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
                <T en="Enough evidence" bn="যথেষ্ট প্রমাণ" />
              </p>
              <h3 className="mt-1 text-base font-semibold text-ink">
                {exemplar.name}, {exemplar.countryName}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <CoverageBadge state={exemplar.coverage} />
                <WatchBadge level={exemplar.watch} compact />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                <T
                  en={`${exemplar.frequency.counts.cases} years have both a rain total and a catalogue query. At or above ${exemplar.frequency.level?.mm ?? "–"} mm of annual rain, floods were catalogued in ${exemplar.frequency.level?.floods ?? "–"} of those ${exemplar.frequency.level?.cases ?? "–"} years (95% interval ${((exemplar.frequency.level?.low ?? 0) * 100).toFixed(0)}–${((exemplar.frequency.level?.high ?? 0) * 100).toFixed(0)}%).`}
                  bn={`${bnNum(exemplar.frequency.counts.cases)} বছরে বৃষ্টির মোট ও ক্যাটালগ-অনুসন্ধান দুটোই আছে। বছরে ${exemplar.frequency.level?.mm ?? "–"} মিমি বা তার বেশি বৃষ্টিতে ${exemplar.frequency.level?.cases ?? "–"} বছরের মধ্যে ${exemplar.frequency.level?.floods ?? "–"}টিতে বন্যা নথিভুক্ত (৯৫% ব্যবধান ${((exemplar.frequency.level?.low ?? 0) * 100).toFixed(0)}–${((exemplar.frequency.level?.high ?? 0) * 100).toFixed(0)}%)।`}
                />
              </p>
              <Link href={`/signal/${exemplar.id}`} className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-accent-strong underline decoration-line underline-offset-2">
                <T en="Open this Signal" bn="এই সংকেত খুলুন" />
                <ArrowRight size={15} aria-hidden />
              </Link>
            </article>
          )}
          {seasonal && (
            <article className="rounded-2xl border border-line bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-watch">
                <T en="Cannot answer here" bn="এখানে উত্তর দেওয়া যায় না" />
              </p>
              <h3 className="mt-1 text-base font-semibold text-ink">
                {seasonal.name}, {seasonal.countryName}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <CoverageBadge state={seasonal.coverage} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                <T
                  en={`${seasonal.coverage === "seasonal" ? seasonal.coverageReason.en : seasonal.watchReasons[0]?.en ?? ""} We show the recorded climate context and say plainly that a current answer is not available, rather than substituting a guess.`}
                  bn={`${seasonal.coverageReason.bn} আমরা অনুমানের বদলে রেকর্ডকৃত জলবায়ু-প্রেক্ষাপট দেখাই এবং স্পষ্টভাবে বলি যে এখনকার উত্তর পাওয়া যায় না।`}
                />
              </p>
              <Link href={`/signal/${seasonal.id}`} className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-accent-strong underline decoration-line underline-offset-2">
                <T en="See why" bn="কারণ দেখুন" />
                <ArrowRight size={15} aria-hidden />
              </Link>
            </article>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          <T
            en="Both examples are chosen automatically from the data. A frequency is the share of historical years with a catalogued flood at that rainfall level: not a forecast, not a probability for this year."
            bn="দুটি উদাহরণই তথ্য থেকে স্বয়ংক্রিয়ভাবে বাছা। ফ্রিকোয়েন্সি হলো ঐ মাত্রার বৃষ্টিতে নথিভুক্ত বন্যা থাকা ঐতিহাসিক বছরের অনুপাত: পূর্বাভাস নয়, এ বছরের সম্ভাবনাও নয়।"
          />
        </p>
      </section>

      <section aria-labelledby="latest" className="mt-10">
        <h2 id="latest" className="text-lg font-semibold text-ink">
          <T en="Latest relevant observations" bn="সাম্প্রতিক প্রাসঙ্গিক পর্যবেক্ষণ" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="The newest published month of the two long NASA records behind every climate baseline here. These are monthly climate analyses, published weeks to months after the month ends, not current weather."
            bn="এখানকার প্রতিটি জলবায়ু-ভিত্তির পেছনের দুটি দীর্ঘ নাসা রেকর্ডের সর্বশেষ প্রকাশিত মাস। এগুলো মাসিক জলবায়ু-বিশ্লেষণ, মাস শেষ হওয়ার কয়েক সপ্তাহ থেকে মাস পরে প্রকাশিত, বর্তমান আবহাওয়া নয়।"
          />
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-card p-4">
            <dt className="text-sm font-medium text-ink">
              <T en="Temperature, study area" bn="তাপমাত্রা, গবেষণা এলাকা" />
            </dt>
            {latest?.zones["study-area"] ? (
              <dd className="mt-1 text-sm text-ink-2">
                <span className="text-2xl font-semibold tabular-nums text-ink">
                  {latest.zones["study-area"].anomaly > 0 ? "+" : ""}
                  {latest.zones["study-area"].anomaly.toFixed(2)} °C
                </span>{" "}
                <T en={`vs ${latest.baseline}, ${latest.month}`} bn={`${latest.baseline}-এর তুলনায়, ${latest.month}`} /> ·{" "}
                <T
                  en={`rank ${latest.zones["study-area"].rank} of ${latest.zones["study-area"].of} years`}
                  bn={`${latest.zones["study-area"].of} বছরের মধ্যে ${latest.zones["study-area"].rank}তম`}
                />
                <span className="mt-1 block text-xs text-ink-3">NASA GISTEMP v4</span>
              </dd>
            ) : (
              <dd className="mt-1 text-sm text-ink-3">
                <T en="No monthly snapshot is committed." bn="কোনো মাসিক স্ন্যাপশট সংরক্ষিত নেই।" />
              </dd>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-card p-4">
            <dt className="text-sm font-medium text-ink">
              <T en="Rainfall, study area" bn="বৃষ্টিপাত, গবেষণা এলাকা" />
            </dt>
            {latestRain?.zones["study-area"] ? (
              <dd className="mt-1 text-sm text-ink-2">
                <span className="text-2xl font-semibold tabular-nums text-ink">{latestRain.zones["study-area"].percentOfNormal}%</span>{" "}
                <T en={`of normal, ${latestRain.month}`} bn={`স্বাভাবিকের, ${latestRain.month}`} /> ·{" "}
                <T
                  en={`${latestRain.zones["study-area"].mm} mm, rank ${latestRain.zones["study-area"].rank} of ${latestRain.zones["study-area"].of} years`}
                  bn={`${latestRain.zones["study-area"].mm} মিমি, ${latestRain.zones["study-area"].of} বছরের মধ্যে ${latestRain.zones["study-area"].rank}তম`}
                />
                <span className="mt-1 block text-xs text-ink-3">GPCP v2.3 monthly</span>
              </dd>
            ) : (
              <dd className="mt-1 text-sm text-ink-3">
                <T en="No monthly snapshot is committed." bn="কোনো মাসিক স্ন্যাপশট সংরক্ষিত নেই।" />
              </dd>
            )}
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink-3">
          <T
            en="These are regional monthly means, not readings for one district; each Signal row carries its own observation date and age."
            bn="এগুলো আঞ্চলিক মাসিক গড়, একটি জেলার পাঠ নয়; প্রতিটি সংকেত-সারিতে নিজস্ব পর্যবেক্ষণের তারিখ ও বয়স আছে।"
          />
        </p>
      </section>

      <nav aria-label="Related" className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/gap", en: "Where the data stops", bn: "তথ্য কোথায় শেষ", text: { en: "Coverage gaps and why a location cannot get a signal.", bn: "আচ্ছাদনের ফাঁক এবং কেন একটি স্থান সংকেত পায় না।" } },
          { href: "/accuracy", en: "Does the screen work?", bn: "স্ক্রিনিং কি কাজ করে?", text: { en: "A year-by-year backtest against the GDACS flood record.", bn: "GDACS বন্যা-রেকর্ডের সাথে বছরে-বছরে ব্যাকটেস্ট।" } },
          { href: "/act", en: "What to do now", bn: "এখন কী করবেন", text: { en: "Preparedness guidance, checklists and shareable cards.", bn: "প্রস্তুতির নির্দেশনা, চেকলিস্ট ও শেয়ারযোগ্য কার্ড।" } },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
          >
            <span>
              <span className="block text-sm font-medium text-ink">
                <T en={item.en} bn={item.bn} />
              </span>
              <span className="mt-0.5 block text-sm text-ink-2">
                <T en={item.text.en} bn={item.text.bn} />
              </span>
            </span>
            <ArrowRight size={18} aria-hidden className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </nav>
    </main>
  );
}
