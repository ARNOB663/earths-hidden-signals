import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/lib/i18n";
import { ageOf } from "@/lib/signals/age";
import { readSignalsConfig, readSignalsMeta, readSources } from "@/lib/signals/data";
import { DataProvenance, SampleBanner } from "@/components/signals/parts";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Evidence and checks · Earth's Hidden Signals",
  description:
    "The measured facts behind the signals: file encoding, a scale check against POWER and a ground station, source availability with dates, and what is still unverified.",
};

// Static text taken from the measurement spike (scripts/signals/spike_report.md), 2026-11-03.
const ENCODING = [
  { en: "Pixel size", bn: "পিক্সেলের আকার", value: "0.1° × 0.1°" },
  { en: "Grid", bn: "গ্রিড", value: "3600 × 1800 (global, north-up)" },
  { en: "Stored value", bn: "সংরক্ষিত মান", value: "rain × 10 (so 1 means 0.1 mm)" },
  { en: "No-data value", bn: "তথ্যহীন মান", value: "29999" },
];

const SCALE_CHECK = [
  { point: "23.81, 90.41", imerg: "needs token", power: "149.0", station: "155.8 (12 d)", name: "BGM00041923 TEJGAON 0.9 km" },
];

export default async function EvidencePage() {
  const [meta, config, sources] = await Promise.all([readSignalsMeta(), readSignalsConfig(), readSources()]);
  const age = ageOf(meta.measurementTime, new Date(meta.generatedAt), config.staleHours, meta.sampleData);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      {meta.sampleData && <SampleBanner clock={meta.clock} />}
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        <T en="Evidence and checks" bn="প্রমাণ ও যাচাই" />
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        <T
          en="What we measured before trusting the data, and what is still unverified. Measured on 2026-11-03; this page does not change with each run."
          bn="তথ্য বিশ্বাস করার আগে আমরা কী মেপেছি, আর কী এখনো যাচাই হয়নি। ২০২৬-১১-০৩ তারিখে মাপা; প্রতিটি চালনায় এই পাতা বদলায় না।"
        />
      </p>

      <section aria-labelledby="encoding" className="mt-5">
        <h2 id="encoding" className="text-base font-semibold text-ink">
          <T en="File encoding we assert" bn="যে এনকোডিং আমরা নিশ্চিত করি" />
        </h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-line bg-card p-3 text-sm">
          {ENCODING.map((row) => (
            <div key={row.value} className="contents">
              <dt className="text-ink-3">
                <T en={row.en} bn={row.bn} />
              </dt>
              <dd className="tabular-nums text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="scale" className="mt-5">
        <h2 id="scale" className="text-base font-semibold text-ink">
          <T en="Scale check: POWER and a ground station" bn="স্কেল যাচাই: POWER ও একটি ভূপৃষ্ঠ কেন্দ্র" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="10–25 July 2024, one point in the Bengal delta. POWER is an independent daily rain product; GHCN is a ground station within 1 km."
            bn="১০–২৫ জুলাই ২০২৪, বেঙ্গল ডেল্টার একটি বিন্দু। POWER একটি স্বাধীন দৈনিক বৃষ্টি পণ্য; GHCN ১ কিমির মধ্যে একটি ভূপৃষ্ঠ কেন্দ্র।"
          />
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th className="border-b border-line py-1 pr-3 font-medium">
                  <T en="Point" bn="বিন্দু" />
                </th>
                <th className="border-b border-line py-1 pr-3 font-medium">IMERG (mm)</th>
                <th className="border-b border-line py-1 pr-3 font-medium">POWER (mm)</th>
                <th className="border-b border-line py-1 pr-3 font-medium">GHCN (mm)</th>
                <th className="border-b border-line py-1 font-medium">
                  <T en="Nearest station" bn="নিকটতম কেন্দ্র" />
                </th>
              </tr>
            </thead>
            <tbody>
              {SCALE_CHECK.map((row) => (
                <tr key={row.point}>
                  <td className="border-b border-line py-1 pr-3 tabular-nums">{row.point}</td>
                  <td className="border-b border-line py-1 pr-3 tabular-nums">{row.imerg}</td>
                  <td className="border-b border-line py-1 pr-3 tabular-nums">{row.power}</td>
                  <td className="border-b border-line py-1 pr-3 tabular-nums">{row.station}</td>
                  <td className="border-b border-line py-1">{row.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-ink-2">
          <T
            en="POWER and the station agree to within 1.0×, so there is no obvious scale error. The station has zero-rain days inside a clearly wet period, so we treat it as a second, weaker check: scale OK, station unconfirmed."
            bn="POWER ও কেন্দ্র ১.০× এর মধ্যে মেলে, তাই স্পষ্ট স্কেল ত্রুটি নেই। স্পষ্ট ভেজা সময়েও কেন্দ্রে বৃষ্টিহীন দিন আছে, তাই এটি দ্বিতীয়, দুর্বল যাচাই: স্কেল ঠিক, কেন্দ্র অনিশ্চিত।"
          />
        </p>
      </section>

      <section aria-labelledby="sources" className="mt-5">
        <h2 id="sources" className="text-base font-semibold text-ink">
          <T en="Sources and when we checked" bn="উৎস ও যাচাইয়ের তারিখ" />
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-ink-2">
          {Object.entries(sources)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, source]) => (
              <li key={key} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2">
                <span className="font-medium text-ink">{key}</span>
                <span className="text-xs text-ink-3">
                  {source.sample ? (
                    <T en="sample" bn="নমুনা" />
                  ) : (
                    String(source.status).replace(/-/g, " ")
                  )}
                  {source.checkedOn ? ` · ${source.checkedOn}` : ""}
                </span>
              </li>
            ))}
        </ul>
        <p className="mt-2 text-xs text-ink-3">
          <T
            en="Still unverified: IMERG totals from the real three tiles against POWER. That check runs in the first real-data build and its result appears here."
            bn="এখনো যাচাই হয়নি: বাস্তব তিন টাইলের IMERG মোট POWER-এর সাথে। সেই যাচাই প্রথম বাস্তব তথ্য তৈরিতে চলে এবং ফল এখানে আসে।"
          />
        </p>
      </section>

      <p className="mt-5 text-sm text-ink-2">
        <Link href="/signals" className="underline decoration-line underline-offset-2 hover:text-ink">
          <T en="Back to Signals" bn="সংকেতে ফিরুন" />
        </Link>
        {" · "}
        <Link href="/about" className="underline decoration-line underline-offset-2 hover:text-ink">
          <T en="About the signals" bn="সংকেত সম্পর্কে" />
        </Link>
      </p>

      <div className="mt-4">
        <DataProvenance
          source={meta.sampleData ? "IMERG Late (sample)" : `IMERG ${meta.product}`}
          measurementTime={meta.measurementTime}
          ageLabel={age.label}
          ageStale={age.stale}
          wmoUrl={config.official.wmo}
          disclaimer={config.official.line}
        />
      </div>
    </main>
  );
}
