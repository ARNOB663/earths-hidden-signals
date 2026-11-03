import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { T } from "@/lib/i18n";
import {
  countSignalRows,
  coverageSummary,
  loadSignalDirectory,
  readGeographyLicense,
  readSignalsSources,
} from "@/lib/geography/data";
import { CountrySignalList } from "@/components/signals/CountrySignalList";
import { DemoNotice, SignalLegend } from "@/components/signals/Legend";
import { Provenance } from "@/components/signals/Provenance";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Signals · Earth's Hidden Signals",
  description:
    "Green, Yellow and Red signals for every country and territory geoBoundaries publishes and its local administrative areas. NASA data coverage is measured separately from the fixed demo scores, which are clearly labelled as simulated.",
};

export default async function SignalsPage() {
  const [directory, license, sources] = await Promise.all([
    loadSignalDirectory(),
    readGeographyLicense(),
    readSignalsSources(),
  ]);
  const { countries, demo, coverage, geography } = directory;
  const { counts, levels } = countSignalRows(directory);
  const measured = coverageSummary(countries);
  const fmt = (value: number) => value.toLocaleString("en");
  const layerCount = Object.keys(coverage.variables).length;

  // Totals come from the boundary files' own counts, never a hardcoded number.
  const countryCount = geography.counts?.countries ?? countries.length;
  const adm1Count = levels.ADM1 ?? 0;
  const adm2Count = levels.ADM2 ?? 0;
  const adm1Countries = geography.counts?.ADM1 ?? countries.filter((country) => country.levels.ADM1).length;
  const adm2Countries = geography.counts?.ADM2 ?? countries.filter((country) => country.levels.ADM2).length;
  const noAdm1 = countries.filter((country) => !country.levels.ADM1).length;
  const noAdm2 = countries.filter((country) => !country.levels.ADM2).length;
  const skipped = geography.skipped ?? [];
  const measuredIn = coverage.measuredCountries ?? [];
  const grid = coverage.gridExtent;
  // Every variable uses the same rule; read it from the file rather than restating the numbers.
  const coverageRule = Object.values(coverage.variables)[0]?.rule ?? "";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="Signals" bn="সংকেত" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          <T
            en="One global preparedness view: every country and territory geoBoundaries publishes, with its local administrative areas, a simulated signal colour, a sample percentage and a separate count of how much NASA data actually covers it."
            bn="এক বৈশ্বিক প্রস্তুতি-দৃশ্য: geoBoundaries যে প্রতিটি দেশ ও অঞ্চল প্রকাশ করে, তার স্থানীয় প্রশাসনিক এলাকাসহ, একটি অনুকরণ সংকেত রং, নমুনা শতাংশ এবং আলাদাভাবে কতটা নাসা তথ্যে আচ্ছাদিত তার হিসাব।"
          />
        </p>
      </header>

      <div className="mt-4 space-y-3">
        <DemoNotice
          event={demo.event}
          eventPeriod={demo.eventPeriod}
          coverageText={{
            en: `“Data: 3 of ${layerCount} layers” is how many of the ${layerCount} NASA series have measured values for that area; the percentage beside it is the share of those layers' grid cells inside the boundary that carry data. Coverage is measured and separate from the demo score.`,
            bn: `“তথ্য: ${layerCount} স্তরের ৩টি” মানে ওই এলাকার জন্য ${layerCount}টি নাসা সিরিজের কতটিতে মাপা মান আছে; পাশের শতাংশটি সীমানার ভেতরে ওই স্তরগুলোর গ্রিড কোষের কত অংশে তথ্য আছে। আচ্ছাদন মাপা হয় এবং ডেমো স্কোর থেকে আলাদা।`,
          }}
        />
        <SignalLegend bands={demo.signalBands} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["green", counts.green, "Green", "সবুজ"],
            ["yellow", counts.yellow, "Yellow", "হলুদ"],
            ["red", counts.red, "Red", "লাল"],
            ["no-data", counts["no-data"], "No data", "তথ্য নেই"],
          ] as const
        ).map(([state, value, en, bn]) => (
          <div key={state} className="rounded-xl border border-line bg-card px-3 py-2">
            <dt className="text-xs text-ink-3">
              <T en={`${en} (demo)`} bn={`${bn} (ডেমো)`} />
            </dt>
            <dd className="text-xl font-semibold tabular-nums text-ink">{value.toLocaleString("en")}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 text-xs text-ink-3">
        <T
          en={`Measured NASA coverage: ${fmt(measured.country.withData)} of ${fmt(measured.country.total)} countries and ${fmt(measured.ADM1.withData)} of ${fmt(measured.ADM1.total)} ADM1 areas have usable data; ${fmt(measured.ADM2.withData)} of ${fmt(measured.ADM2.total)} ADM2 areas do, because ADM2 polygons are usually smaller than the grids. Our NASA analysis grids cover South Asia only (${grid ? `${grid.lon[0]}–${grid.lon[1]}°E, ${grid.lat[0]}–${grid.lat[1]}°N` : "South Asia"}), so the ${fmt(measured.country.total - measuredIn.length)} countries outside that extent show No data. ${coverageRule}`}
          bn={`মাপা নাসা আচ্ছাদন: ${measured.country.total} দেশের ${measured.country.withData}টি এবং ${measured.ADM1.total} ADM1 এলাকার ${measured.ADM1.withData}টিতে ব্যবহারযোগ্য তথ্য আছে; ${measured.ADM2.total} ADM2 এলাকার ${measured.ADM2.withData}টিতে আছে, কারণ ADM2 বহুভুজ সাধারণত গ্রিডের চেয়ে ছোট। আমাদের নাসা বিশ্লেষণ গ্রিড কেবল দক্ষিণ এশিয়া জুড়ে (${grid ? `${grid.lon[0]}–${grid.lon[1]}°পূ, ${grid.lat[0]}–${grid.lat[1]}°উ` : "দক্ষিণ এশিয়া"}), তাই ওই সীমার বাইরের ${measured.country.total - measuredIn.length}টি দেশ তথ্য নেই দেখায়। ${coverageRule}`}
        />
      </p>

      <CountrySignalList countries={countries} totalLayers={layerCount} />

      <p className="mt-6 rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">
        <T
          en={`Boundaries loaded from geoBoundaries gbOpen: ${fmt(countryCount)} countries and territories at ADM0. ADM1 is published for ${fmt(adm1Countries)} of them (${fmt(adm1Count)} areas); ADM2 for ${fmt(adm2Countries)} (${fmt(adm2Count)} areas). ${noAdm1} have no ADM1 and ${noAdm2} no ADM2, mostly small islands and territories, and the list shows only the levels each country has.${skipped.length ? ` ${skipped.map((item) => item.iso).join(", ")} has ${skipped.map((item) => item.levels.join("/")).join(", ")} but no ADM0, so it is not listed as a country.` : ""}`}
          bn={`geoBoundaries gbOpen থেকে লোড করা সীমানা: ADM0 স্তরে ${countryCount} দেশ ও অঞ্চল। এদের মধ্যে ${adm1Countries}টির জন্য ADM1 (${adm1Count} এলাকা) এবং ${adm2Countries}টির জন্য ADM2 (${adm2Count} এলাকা) প্রকাশিত। ${noAdm1}টির ADM1 নেই এবং ${noAdm2}টির ADM2 নেই, বেশিরভাগই ছোট দ্বীপ ও অঞ্চল; তালিকায় প্রতিটি দেশের সত্যিকার উপলভ্য স্তরই দেখানো হয়।${skipped.length ? ` ${skipped.map((item) => item.iso).join(", ")}-এ ${skipped.map((item) => item.levels.join("/")).join(", ")} আছে কিন্তু ADM0 নেই, তাই দেশ হিসেবে তালিকাভুক্ত নয়।` : ""}`}
        />
      </p>

      <Provenance license={license} sources={sources} layerCount={layerCount} />

      <section aria-labelledby="next" className="mt-6 grid gap-3 sm:grid-cols-2">
        <h2 id="next" className="sr-only">
          <T en="Related pages" bn="সম্পর্কিত পাতা" />
        </h2>
        <Link
          href="/watch"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
        >
          <span>
            <span className="block text-sm font-medium text-ink">
              <T en="Watch" bn="কী দেখবেন" />
            </span>
            <span className="mt-0.5 block text-sm text-ink-2">
              <T en="Places where the signal rose since the previous snapshot." bn="আগের স্ন্যাপশট থেকে সংকেত বেড়েছে এমন জায়গা।" />
            </span>
          </span>
          <ArrowRight size={18} aria-hidden className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/accuracy"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
        >
          <span>
            <span className="block text-sm font-medium text-ink">
              <T en="Accuracy" bn="নির্ভুলতা" />
            </span>
            <span className="mt-0.5 block text-sm text-ink-2">
              <T en="How often the signal rose before a verified flood, misses included." bn="যাচাইকৃত বন্যার আগে সংকেত কতবার বেড়েছে, বাদ পড়া ঘটনাগুলোসহ।" />
            </span>
          </span>
          <ArrowRight size={18} aria-hidden className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/methods"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
        >
          <span>
            <span className="block text-sm font-medium text-ink">
              <T en="How the signals are built" bn="সংকেত কীভাবে তৈরি" />
            </span>
            <span className="mt-0.5 block text-sm text-ink-2">
              <T
                en="Geographic levels, coverage rule, demo-data status and credits."
                bn="ভৌগোলিক স্তর, আচ্ছাদনের নিয়ম, ডেমো তথ্যের অবস্থা ও স্বীকৃতি।"
              />
            </span>
          </span>
          <ArrowRight size={18} aria-hidden className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/explore"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
        >
          <span>
            <span className="block text-sm font-medium text-ink">
              <T en="Satellite map" bn="স্যাটেলাইট মানচিত্র" />
            </span>
            <span className="mt-0.5 block text-sm text-ink-2">
              <T en="The NASA imagery behind the measurements." bn="পরিমাপের পেছনের নাসা চিত্র।" />
            </span>
          </span>
          <ArrowRight size={18} aria-hidden className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </section>
    </main>
  );
}
