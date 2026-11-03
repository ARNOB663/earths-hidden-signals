import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { T } from "@/lib/i18n";
import { countSignalRows, loadSignalDirectory } from "@/lib/geography/data";
import { CountrySignalList } from "@/components/signals/CountrySignalList";
import { DemoNotice, SignalLegend } from "@/components/signals/Legend";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Signals · Earth's Hidden Signals",
  description:
    "Green, Yellow and Red signals for South Asian countries and their local administrative areas, built on NASA Earth-observation data, with fixed demo scores clearly labelled as samples.",
};

export default async function SignalsPage() {
  const directory = await loadSignalDirectory();
  const { countries, demo, coverage } = directory;
  const { counts, levels } = countSignalRows(countries);

  const countryCount = countries.length;
  const adm1Count = levels.ADM1 ?? 0;
  const adm2Count = levels.ADM2 ?? 0;
  // Each country names its own levels; group countries by the ADM2 name they publish.
  const adm2Names = [
    ...new Set(countries.map((country) => country.areaName).filter((name) => !/^ADM2 areas$/i.test(name))),
  ];
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
            en="One preparedness view across South Asia: every country and its local administrative areas, each with a signal colour, a percentage score and how much of it NASA data actually covers."
            bn="দক্ষিণ এশিয়ার এক প্রস্তুতি-দৃশ্য: প্রতিটি দেশ ও তার স্থানীয় প্রশাসনিক এলাকা, প্রতিটির সংকেত রং, শতাংশ স্কোর এবং কতটা নাসা তথ্যে আচ্ছাদিত।"
          />
        </p>
      </header>

      <div className="mt-4 space-y-3">
        <DemoNotice event={demo.event} eventPeriod={demo.eventPeriod} />
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
              <T en={en} bn={bn} />
            </dt>
            <dd className="text-xl font-semibold tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 text-xs text-ink-3">
        <T
          en={`Data coverage: ${coverageRule} Coverage counts the NASA series that qualify (Temperature, Rainfall, Hot months, Heavy-rain days, Dry spells, Wettest day).`}
          bn={`তথ্যের আচ্ছাদন: ${coverageRule} আচ্ছাদনে যোগ্য নাসা সিরিজ (তাপমাত্রা, বৃষ্টিপাত, উষ্ণ মাস, ভারী বৃষ্টির দিন, খরা কাল, সর্বোচ্চ বৃষ্টির দিন) গণনা করা হয়।`}
        />
      </p>

      <CountrySignalList countries={countries} />

      <p className="mt-6 rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">
        <T
          en={`Areas covered here: ${countryCount} countries (geoBoundaries ADM0), ${adm1Count} ADM1 areas and ${adm2Count} ADM2 areas. geoBoundaries names and publishes levels differently in each country (ADM2 is called ${adm2Names.join(", ")} here), and the index lists only the levels it actually has. Coverage is measured per country and ADM1 area; ADM2 areas are usually smaller than the analysis grids, so they show No data until a finer dataset exists.`}
          bn={`এখানে অন্তর্ভুক্ত: ${countryCount} দেশ (geoBoundaries ADM0), ${adm1Count} ADM1 এলাকা এবং ${adm2Count} ADM2 এলাকা। geoBoundaries প্রতিটি দেশে স্তরের নাম ও উপলভ্যতা আলাদাভাবে দেয় (এখানে ADM2: ${adm2Names.join(", ")}), এবং তালিকায় কেবল সত্যিকার উপলভ্য স্তরই আছে। আচ্ছাদন দেশ ও ADM1 এলাকার জন্য মাপা; ADM2 এলাকা সাধারণত বিশ্লেষণ গ্রিডের চেয়ে ছোট, তাই সূক্ষ্ম তথ্য না আসা পর্যন্ত তথ্য নেই দেখায়।`}
        />
      </p>

      <section aria-labelledby="next" className="mt-6 grid gap-3 sm:grid-cols-2">
        <h2 id="next" className="sr-only">
          <T en="Related pages" bn="সম্পর্কিত পাতা" />
        </h2>
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
