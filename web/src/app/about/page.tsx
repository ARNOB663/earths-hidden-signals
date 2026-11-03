import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { T } from "@/lib/i18n";
import { ageOf } from "@/lib/signals/age";
import { readSignalsConfig, readSignalsMeta, readSources } from "@/lib/signals/data";
import { DataProvenance, SampleBanner } from "@/components/signals/parts";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "About the signals · Earth's Hidden Signals",
  description:
    "Where the rain data comes from, how 'normal' is defined, how many past values a reading needs, and who provides the place search. Not a forecast or an official warning.",
};

const SOURCES: { key: string; name: string; url: string; use: { en: string; bn: string } }[] = [
  {
    key: "imerg-late",
    name: "NASA IMERG Late (GES DISC / PPS)",
    url: "https://gpm.nasa.gov/data/imerg",
    use: { en: "Daily rain totals for the tiles.", bn: "টাইলের দৈনিক বৃষ্টির পরিমাণ।" },
  },
  {
    key: "outlook-open-meteo",
    name: "Open-Meteo (CC-BY 4.0)",
    url: "https://open-meteo.com/",
    use: {
      en: "7-day outlook on the place page, labelled as external. Never used in a status.",
      bn: "জায়গার পাতায় ৭ দিনের পরিপ্রেক্ষিত, বহিরাগত হিসেবে চিহ্নিত। অবস্থায় কখনো ব্যবহৃত নয়।",
    },
  },
  {
    key: "wmo",
    name: "WMO Severe Weather Information Centre",
    url: "https://severeweather.wmo.int/",
    use: { en: "Official warnings. Always the authority, not us.", bn: "সরকারি সতর্কবার্তা। সর্বদা কর্তৃপক্ষ, আমরা নই।" },
  },
  {
    key: "gdacs",
    name: "GDACS flood events",
    url: "https://www.gdacs.org/",
    use: {
      en: "Verified flood events used for the accuracy backtest.",
      bn: "নির্ভুলতা পরীক্ষায় ব্যবহৃত যাচাইকৃত বন্যার ঘটনা।",
    },
  },
];

export default async function AboutPage() {
  const [meta, config, sources] = await Promise.all([readSignalsMeta(), readSignalsConfig(), readSources()]);
  const age = ageOf(meta.measurementTime, new Date(meta.generatedAt), config.staleHours, meta.sampleData);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      {meta.sampleData && <SampleBanner clock={meta.clock} />}
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        <T en="About the signals" bn="সংকেত সম্পর্কে" />
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        <T
          en="A source catalogue and the exact rules behind every colour. This is a preparedness signal, not a forecast or an official warning."
          bn="উৎসের তালিকা এবং প্রতিটি রঙের পেছনের নিয়ম। এটি প্রস্তুতির সংকেত, পূর্বাভাস বা সরকারি সতর্কবার্তা নয়।"
        />
      </p>

      <section aria-labelledby="sources" className="mt-5">
        <h2 id="sources" className="text-base font-semibold text-ink">
          <T en="Where the data comes from" bn="তথ্য কোথা থেকে আসে" />
        </h2>
        <ul className="mt-2 space-y-2">
          {SOURCES.map((source) => {
            const status = sources[source.key];
            return (
              <li key={source.key} className="rounded-xl border border-line bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-ink underline decoration-line underline-offset-2"
                  >
                    {source.name}
                    <ArrowUpRight size={14} aria-hidden />
                  </a>
                  <span className="text-xs text-ink-3">
                    {status?.sample ? (
                      <T en="Sample" bn="নমুনা" />
                    ) : status?.status ? (
                      String(status.status).replace(/-/g, " ")
                    ) : (
                      <T en="Not checked" bn="যাচাই হয়নি" />
                    )}
                    {status?.checkedOn ? (
                      <>
                        {" · "}
                        <T en="checked" bn="যাচাই" /> <time dateTime={status.checkedOn}>{status.checkedOn}</time>
                      </>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-2">
                  <T en={source.use.en} bn={source.use.bn} />
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-3">
          <T
            en="Place search is provided by Open-Meteo geocoding (CC-BY 4.0). No coordinates leave your device except to that search."
            bn="স্থান অনুসন্ধান Open-Meteo জিওকোডিং (CC-BY 4.0) থেকে। সেই অনুসন্ধান ছাড়া কোনো অবস্থান আপনার ডিভাইস ছাড়ে না।"
          />
        </p>
      </section>

      <section aria-labelledby="normal" className="mt-5 rounded-2xl border border-line bg-card p-4">
        <h2 id="normal" className="text-base font-semibold text-ink">
          <T en="What “normal” means here" bn="এখানে “স্বাভাবিক” মানে কী" />
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-2">
          <li>
            <T
              en={`For the same dates in each past year, we take only wet days (at least ${config.wetDayMinMm} mm) and use their median as “normal”.`}
              bn={`প্রতিটি অতীত বছরে একই তারিখগুলোতে কেবল ভেজা দিন (কমপক্ষে ${config.wetDayMinMm} মিমি) নিই এবং তাদের মধ্যককে “স্বাভাবিক” ধরি।`}
            />
          </li>
          <li>
            <T
              en={`Each date is compared with a window of ±${config.doyHalfWindow} days around it, so a reading is never judged against a single calendar day.`}
              bn={`প্রতিটি তারিখের সাথে তার আশপাশের ±${config.doyHalfWindow} দিনের তুলনা হয়, তাই একটি পাঠ কখনো একদিনের সাথে বিচার হয় না।`}
            />
          </li>
          <li>
            <T
              en={`A reading needs at least ${config.baselineYearsMin} past years and ${config.baselineCountMin} past values. Short of that, the cell is Grey, not Green.`}
              bn={`একটি পাঠের জন্য অন্তত ${config.baselineYearsMin} অতীত বছর ও ${config.baselineCountMin} অতীত মান লাগে। কম হলে কোষ ধূসর, সবুজ নয়।`}
            />
          </li>
          <li>
            {config.baselineProduct}.{" "}
            <T en={config.baselineNote} bn="বেসলাইন দীর্ঘ, সামঞ্জস্যপূর্ণ রেকর্ড ব্যবহার করে। NASA সংস্করণ বদলালে জানালা মিশ্র হয় না; তখন চালনা থেমে যায়।" />
          </li>
        </ul>
      </section>

      <section aria-labelledby="limits" className="mt-5">
        <h2 id="limits" className="text-base font-semibold text-ink">
          <T en="What this cannot tell you" bn="এটি যা বলতে পারে না" />
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>
            <T
              en="It cannot say where water will go, or whether a flood will reach a village."
              bn="পানি কোথায় যাবে বা বন্যা গ্রামে পৌঁছাবে কি না তা বলতে পারে না।"
            />
          </li>
          <li>
            <T
              en="Grey means no usable data for that area; it does not mean the area is safe."
              bn="ধূসর মানে ওই এলাকায় ব্যবহারযোগ্য তথ্য নেই; এর মানে এলাকা নিরাপদ নয়।"
            />
          </li>
          <li>
            <T
              en="Coarse soil-moisture context is about 36 km and does not change any status."
              bn="মোটা মাটির আর্দ্রতার প্রেক্ষাপট প্রায় ৩৬ কিমি এবং কোনো অবস্থা বদলায় না।"
            />
          </li>
        </ul>
        <p className="mt-2 text-sm text-ink-2">
          <Link href="/methods" className="underline decoration-line underline-offset-2 hover:text-ink">
            <T en="Read the full methods" bn="সম্পূর্ণ পদ্ধতি পড়ুন" />
          </Link>
          {" · "}
          <Link href="/signals/evidence" className="underline decoration-line underline-offset-2 hover:text-ink">
            <T en="Evidence and checks" bn="প্রমাণ ও যাচাই" />
          </Link>
        </p>
      </section>

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
