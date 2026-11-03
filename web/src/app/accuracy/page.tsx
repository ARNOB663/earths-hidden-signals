import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/lib/i18n";
import { SampleBanner } from "@/components/signals/parts";
import { ageOf } from "@/lib/signals/age";
import { readAccuracy, readSignalsConfig, readSignalsMeta } from "@/lib/signals/data";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Accuracy · Earth's Hidden Signals",
  description:
    "How often the rain signal rose before a verified flood, and where it did not. Historical replay of real events, never a live warning.",
};

/** Replay outcome words. A replay that is not built yet is neutral, never the Grey "no data". */
function ReplayOutcome({ status, hit }: { status: string; hit: boolean | null }) {
  if (status === "pending-real-data") {
    return (
      <span className="rounded-full border border-line bg-sunken px-2 py-0.5 text-xs text-ink-2">
        <T en="Not built yet" bn="এখনো তৈরি হয়নি" />
      </span>
    );
  }
  if (status !== "ok" || hit === null) {
    return (
      <span className="rounded-full border border-line bg-sunken px-2 py-0.5 text-xs text-ink-2">
        <T en="Not measured" bn="মাপা হয়নি" />
      </span>
    );
  }
  return hit ? (
    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-ink">
      <T en="Signal rose" bn="সংকেত বেড়েছিল" />
    </span>
  ) : (
    <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-ink-2">
      <T en="No rise" bn="সংকেত বাড়েনি" />
    </span>
  );
}

function Counter({ label, value, en, bn }: { label: string; value: number | null; en: string; bn: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <p className="text-xs text-ink-3">
        <T en={en} bn={bn} />
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value === null ? "—" : value}</p>
      <p className="text-xs text-ink-3">{label}</p>
    </div>
  );
}

export default async function AccuracyPage() {
  const [accuracy, meta, config] = await Promise.all([readAccuracy(), readSignalsMeta(), readSignalsConfig()]);
  const age = ageOf(meta.measurementTime, new Date(meta.generatedAt), config.staleHours, meta.sampleData);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      {meta.sampleData && <SampleBanner clock={meta.clock} />}
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        <T en="Accuracy" bn="নির্ভুলতা" />
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        <T
          en="Did the signal rise before real floods? We check it against verified flood events from GDACS and show the misses too. Historical replay, not live."
          bn="বাস্তব বন্যায় সংকেত আগে বেড়েছিল কি? GDACS-এর যাচাইকৃত বন্যার সাথে মিলিয়ে দেখি, ব্যর্থতাও দেখাই। ঐতিহাসিক পুনরাবৃত্তি, সরাসরি নয়।"
        />
      </p>

      {accuracy.notEnough ? (
        <p className="mt-4 rounded-xl border border-line bg-card p-4 text-sm text-ink">
          <T en={accuracy.notEnoughText} bn="এখনো যথেষ্ট ঘটনা নেই।" />
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Counter label="hits" value={accuracy.hits} en="Caught" bn="ধরা পড়েছে" />
        <Counter label="misses" value={accuracy.misses} en="Missed" bn="ধরা পড়েনি" />
        <Counter label="unmatched" value={accuracy.unmatched} en="No catalogued event" bn="ক্যাটালগভুক্ত ঘটনা নেই" />
        <Counter label="confirmed" value={accuracy.satelliteConfirmed} en="Satellite-confirmed" bn="স্যাটেলাইট-নিশ্চিত" />
      </div>

      <p className="mt-2 text-xs text-ink-3">
        <T en={accuracy.unmatchedText} bn="ক্যাটালগভুক্ত ঘটনা ছাড়া সংকেত (ঊর্ধ্বসীমা; বন্যার ক্যাটালগ অসম্পূর্ণ)।" />
      </p>

      <section className="mt-5">
        <h2 className="text-base font-semibold text-ink">
          <T en="Verified flood events replayed" bn="পুনরাবৃত্তি করা যাচাইকৃত বন্যা" />
        </h2>
        <ul className="mt-2 space-y-2">
          {accuracy.events.map((event) => (
            <li key={event.id} className="rounded-xl border border-line bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium tabular-nums text-ink">
                  {event.lat.toFixed(2)}, {event.lon.toFixed(2)}
                </span>
                <ReplayOutcome status={event.status} hit={event.hit} />
              </div>
              <p className="mt-1 text-xs text-ink-3">
                {event.start} ·{" "}
                <a
                  href={`https://www.gdacs.org/report.aspx?eventtype=FL&eventid=${event.gdacsId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-line underline-offset-2 hover:text-ink"
                >
                  <T en={`GDACS ${event.gdacsId}`} bn={`GDACS ${event.gdacsId}`} />
                </a>
                {!event.inCoverage && (
                  <>
                    {" "}· <T en="Outside the covered tiles" bn="আচ্ছাদিত টাইলের বাইরে" />
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 rounded-xl border border-line bg-card p-4 text-sm text-ink-2">
        <h2 className="text-base font-semibold text-ink">
          <T en="How the counts are made" bn="সংখ্যাগুলো কীভাবে গণনা করা হয়" />
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <T
              en={`A hit is a Yellow or Red cell within ${accuracy.radiusKm} km of the event, in the ${accuracy.leadDays} days before it started.`}
              bn={`হিট হলো ঘটনার ${accuracy.radiusKm} কিমি মধ্যে, শুরুর আগের ${accuracy.leadDays} দিনে হলুদ বা লাল কোষ।`}
            />
          </li>
          <li>
            <T
              en={`The comparison rain is IMERG ${accuracy.product}, the same product as the live signal, and the event's own year is left out of its reference years.`}
              bn={`তুলনার বৃষ্টি IMERG ${accuracy.product}, সরাসরি সংকেতের মতোই, এবং ঘটনার বছর তার নিজের তুলনার বছর থেকে বাদ।`}
            />
          </li>
          <li>
            <T
              en="Red is provisional until these counts are large enough."
              bn="এই সংখ্যাগুলো যথেষ্ট বড় না হওয়া পর্যন্ত লাল প্রাথমিক।"
            />
          </li>
        </ul>
        <p className="mt-3 text-xs text-ink-3">
          {age.label} ·{" "}
          <Link href="/methods" className="underline decoration-line underline-offset-2 hover:text-ink">
            <T en="Methods" bn="পদ্ধতি" />
          </Link>
        </p>
      </section>
    </main>
  );
}
