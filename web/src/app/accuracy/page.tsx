import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/lib/i18n";
import { SampleBanner } from "@/components/signals/parts";
import { ageOf } from "@/lib/signals/age";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readAccuracy, readPlaces, readSignalsConfig, readSignalsMeta } from "@/lib/signals/data";

/**
 * The measured finding from analysis/evaluation_baseline.json, read rather than retyped. When the
 * file is missing the page says nothing rather than quoting a number it cannot back.
 */
async function readBaseline(): Promise<{ floodFalseAlarm: number | null; missed: number | null }> {
  try {
    const file = path.join(process.cwd(), "..", "analysis", "evaluation_baseline.json");
    const raw = JSON.parse(await readFile(file, "utf8")) as {
      falseAlarmRate?: { byHazard?: { flood?: number | null } };
      missedEvents?: number | null;
    };
    return { floodFalseAlarm: raw.falseAlarmRate?.byHazard?.flood ?? null, missed: raw.missedEvents ?? null };
  } catch {
    return { floodFalseAlarm: null, missed: null };
  }
}

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Trust and evidence · Earth's Hidden Signals",
  description:
    "What we can measure about our own rain signal: how often it rose before a verified flood (misses included), which places can be warned at all, and the leads that go unmeasured. Historical replay, never a live warning.",
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

function Counter({ value, en, bn }: { value: number | null; en: string; bn: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <p className="text-xs text-ink-3">
        <T en={en} bn={bn} />
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value === null ? "—" : value}</p>
    </div>
  );
}

const TRUST_STATES = [
  {
    key: "detectable" as const,
    en: "Detectable",
    bn: "শনাক্তযোগ্য",
    cls: "text-accent-strong",
    body: {
      en: "The area's own 45-year record separates a trend from year-to-year noise in at least one variable, so a raised signal here can be checked against history.",
      bn: "এই এলাকার নিজস্ব ৪৫ বছরের রেকর্ড অন্তত একটি পরিমাপে প্রবণতাকে বছরে-বছরে ওঠানামা থেকে আলাদা করতে পারে, তাই এখানকার বাড়তি সংকেত ইতিহাসের সাথে যাচাই করা যায়।",
    },
  },
  {
    key: "blind-spot" as const,
    en: "Blind spot",
    bn: "অন্ধ স্থান",
    cls: "text-watch",
    body: {
      en: "No trend in these cells can be told apart from noise. We can still show today's rain, but we cannot yet say it is a change, so treat the colour as provisional.",
      bn: "এই কোষগুলোর কোনো প্রবণতা কোলাহল থেকে আলাদা করা যায় না। আজকের বৃষ্টি দেখাতে পারি, তবে এটি পরিবর্তন বলে বলতে পারি না, তাই রংটিকে প্রাথমিক ধরে নিন।",
    },
  },
  {
    key: "no-data" as const,
    en: "No history",
    bn: "ইতিহাস নেই",
    cls: "text-ink-3",
    body: {
      en: "No gridded history covers this area. Nothing can be compared, and the place shows No data rather than a colour.",
      bn: "এই এলাকা কোনো গ্রিডযুক্ত ইতিহাসে পড়ে না। তুলনার কিছু নেই, তাই জায়গাটি রঙের বদলে ‘তথ্য নেই’ দেখায়।",
    },
  },
];

export default async function AccuracyPage() {
  const [accuracy, meta, config, places, baseline] = await Promise.all([
    readAccuracy(),
    readSignalsMeta(),
    readSignalsConfig(),
    readPlaces(),
    readBaseline(),
  ]);
  const age = ageOf(meta.measurementTime, new Date(meta.generatedAt), config.staleHours, meta.sampleData);
  const trustCounts = places.areas.reduce(
    (acc, area) => ({ ...acc, [area.trust.state]: acc[area.trust.state] + 1 }),
    { detectable: 0, "blind-spot": 0, "no-data": 0 } as Record<string, number>,
  );
  const measured = (accuracy.hits ?? 0) + (accuracy.misses ?? 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      {meta.sampleData && <SampleBanner clock={meta.clock} />}
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        <T en="Trust and evidence" bn="ভরসা ও প্রমাণ" />
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        <T
          en="This page shows what we can measure about our own signal and where it stops. That is a different question from accuracy: how often the rain signal rose before a verified flood (misses included), which places can be warned at all, and what we do not measure yet. It is a historical replay, never a live warning."
          bn="এই পাতায় দেখানো হয় আমাদের নিজের সংকেত সম্পর্কে আমরা কী মাপতে পারি আর কোথায় থামে। এটি নির্ভুলতা থেকে আলাদা প্রশ্ন: যাচাইকৃত বন্যার আগে বৃষ্টির সংকেত কতবার বেড়েছে (বাদ পড়াগুলোসহ), কোন জায়গাগুলোকে আদৌ সতর্ক করা যায়, আর আমরা এখনো কী মাপি না। এটি ঐতিহাসিক পুনরাবৃত্তি, কখনো সরাসরি সতর্কবার্তা নয়।"
        />
      </p>

      {(baseline.floodFalseAlarm !== null || baseline.missed !== null) && (
        <section aria-labelledby="finding" className="mt-6 rounded-2xl border border-line bg-card p-4">
          <h2 id="finding" className="text-base font-semibold text-ink">
            <T en="What the backtest measured" bn="ব্যাকটেস্টে যা মাপা হয়েছে" />
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            {baseline.floodFalseAlarm !== null && (
              <div>
                <dt className="text-xs text-ink-3">
                  <T en="Flood alerts with no flood in the backtest" bn="ব্যাকটেস্টে বন্যা-হীন বন্যা-সংকেত" />
                </dt>
                <dd className="text-2xl font-semibold tabular-nums text-ink">{Math.round(baseline.floodFalseAlarm * 100)}%</dd>
              </div>
            )}
            {baseline.missed !== null && (
              <div>
                <dt className="text-xs text-ink-3">
                  <T en="Events missed" bn="বাদ পড়া ঘটনা" />
                </dt>
                <dd className="text-2xl font-semibold tabular-nums text-ink">{Math.round(baseline.missed * 100)}%</dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-sm text-ink-2">
            <T
              en={`These are the numbers behind the Trust axis, and they are the finding, not a bug to hide: on the backtest the edge-case alert rule fires where no flood was recorded (${Math.round((baseline.floodFalseAlarm ?? 0) * 100)}%) and misses most events that were (${Math.round((baseline.missed ?? 0) * 100)}%). A genuinely destructive flood can still have no alert or a missed one, so nothing here claims to warn people in time. Each place instead says whether its history can be checked at all.`}
              bn={`এগুলোই ভরসার অক্ষের পেছনের সংখ্যা, এবং এগুলোই ফলাফল, লুকানোর মতো ত্রুটি নয়: ব্যাকটেস্টে যেখানে বন্যা নথিভুক্ত নেই সেখানেও সংকেত ওঠে (${Math.round((baseline.floodFalseAlarm ?? 0) * 100)}%) এবং যেখানে বন্যা ছিল তার বেশিরভাগই বাদ পড়ে (${Math.round((baseline.missed ?? 0) * 100)}%)। তাই এখানে কিছুই সময়মতো সতর্ক করার দাবি করে না; বদলে প্রতিটি জায়গা বলে তার ইতিহাস আদৌ যাচাই করা যায় কি না।`}
            />
          </p>
          <p className="mt-1 text-xs text-ink-3">
            <T
              en="From analysis/evaluation_baseline.json. It measures the earlier hazard alerts on the backtest, not the rain signal replayed below."
              bn="analysis/evaluation_baseline.json থেকে। এটি নিচে পুনরাবৃত্ত বৃষ্টির সংকেত নয়, আগের বিপদ-সতর্কতাগুলোকে ব্যাকটেস্টে মাপে।"
            />
          </p>
        </section>
      )}

      <section aria-labelledby="replay" className="mt-6">
        <h2 id="replay" className="text-base font-semibold text-ink">
          <T en="Does the signal rise before real floods?" bn="বাস্তব বন্যার আগে সংকেত কি বেড়েছে?" />
        </h2>
        {accuracy.notEnough ? (
          <p className="mt-2 rounded-xl border border-line bg-card p-4 text-sm text-ink">
            <T en={accuracy.notEnoughText} bn="এখনো যথেষ্ট ঘটনা নেই।" />
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Counter value={accuracy.hits} en="Caught" bn="ধরা পড়েছে" />
          <Counter value={accuracy.misses} en="Missed" bn="ধরা পড়েনি" />
          <Counter value={accuracy.satelliteConfirmed} en="Satellite-confirmed" bn="স্যাটেলাইট-নিশ্চিত" />
        </div>
        <p className="mt-1 text-xs tabular-nums text-ink-3">
          {measured > 0 && accuracy.hits !== null ? (
            <>
              {Math.round(((accuracy.hits ?? 0) / measured) * 100)}%{" "}
              <T
                en={`of the ${measured} events we could measure. A rate below 100% is shown, not hidden: a miss is the part of the record we most need.`}
                bn={`মাপার যোগ্য ${measured}টি ঘটনার। ১০০%-এর নিচের হারও দেখানো হয়, লুকানো হয় না: বাদ পড়া ঘটনাই আমাদের রেকর্ডের সবচেয়ে জরুরি অংশ।`}
              />
            </>
          ) : (
            <T en="No event has been replayed yet." bn="এখনো কোনো ঘটনা পুনরাবৃত্তি করা হয়নি।" />
          )}
        </p>
        <p className="mt-2 text-xs text-ink-3">
          <T en={accuracy.unmatchedText} bn="ক্যাটালগভুক্ত ঘটনা ছাড়া সংকেত (ঊর্ধ্বসীমা; বন্যার ক্যাটালগ অসম্পূর্ণ)।" />
        </p>

        <ul className="mt-3 space-y-2">
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
                  GDACS {event.gdacsId}
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

      <section aria-labelledby="trust" className="mt-8">
        <h2 id="trust" className="text-base font-semibold text-ink">
          <T en="Where the signal can be checked at all" bn="কোথায় সংকেত যাচাই করা যায়" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en={`Each covered area carries one Trust label, taken from the same 95% interval as its Before strip. Of ${places.areas.length} areas: ${trustCounts.detectable} detectable, ${trustCounts["blind-spot"]} blind spots, ${trustCounts["no-data"]} with no history.`}
            bn={`প্রতিটি আচ্ছাদিত এলাকার একটি ভরসা-লেবেল আছে, যা তার ‘আগে’ স্তরের একই ৯৫% ব্যবধান থেকে আসে। ${places.areas.length}টি এলাকার মধ্যে: ${trustCounts.detectable}টি শনাক্তযোগ্য, ${trustCounts["blind-spot"]}টি অন্ধ স্থান, ${trustCounts["no-data"]}টির ইতিহাস নেই।`}
          />
        </p>
        <dl className="mt-3 space-y-2">
          {TRUST_STATES.map((state) => (
            <div key={state.key} className="rounded-xl border border-line bg-card p-3">
              <dt className={`text-sm font-semibold ${state.cls}`}>
                <T en={state.en} bn={state.bn} />{" "}
                <span className="font-normal tabular-nums text-ink-3">{trustCounts[state.key]}</span>
              </dt>
              <dd className="mt-1 text-sm text-ink-2">
                <T en={state.body.en} bn={state.body.bn} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-3">
          <T
            en="Trust is not a probability and not a confidence percentage. It answers one question: can the data here tell a change from noise?"
            bn="ভরসা কোনো সম্ভাবনা নয়, শতাংশও নয়। এটি একটাই প্রশ্নের উত্তর দেয়: এখানকার তথ্য কি পরিবর্তনকে কোলাহল থেকে আলাদা করতে পারে?"
          />
        </p>
      </section>

      <section aria-labelledby="leads" className="mt-8 rounded-xl border border-line bg-sunken p-4">
        <h2 id="leads" className="text-base font-semibold text-ink">
          <T en="Leads we do not measure yet" bn="যে সূত্র আমরা এখনো মাপি না" />
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>
            <T
              en={`First 48 hours: the outcome tested here is a ${accuracy.leadDays}-day lead (a Yellow or Red cell within ${accuracy.radiusKm} km of the event, in the days before it started). The in-tile flood record is too sparse for a separate 48-hour rate to be anything but noise, so we do not publish one.`}
              bn={`প্রথম ৪৮ ঘণ্টা: এখানে যাচাই করা ফলটি ${accuracy.leadDays} দিনের আগাম সংকেত (ঘটনার আগের দিনগুলোয়, ঘটনার ${accuracy.radiusKm} কিমি মধ্যে হলুদ বা লাল কোষ)। টাইলের বন্যা-রেকর্ড এতই পাতলা যে আলাদা ৪৮-ঘণ্টার হার কোলাহল ছাড়া আর কিছু হবে না, তাই আমরা তা প্রকাশ করি না।`}
            />
          </li>
          <li>
            <T
              en="Urban and street flooding: IMERG smooths a city into cells of about 10 km, so a short intense cell can be missed."
              bn="শহর ও রাস্তার বন্যা: IMERG একটি শহরকে প্রায় ১০ কিমি কোষে মসৃণ করে, তাই ছোট কিন্তু তীব্র একটি কোষ বাদ পড়তে পারে।"
            />
          </li>
          <li>
            <T
              en="Landslides: we do not claim to predict them here; rain is only one input."
              bn="ভূমিধস: এখানে এর পূর্বাভাসের দাবি করি না; বৃষ্টি শুধু একটি উপাদান।"
            />
          </li>
          <li>
            <T
              en={age.stale ? "The measurement is older than the freshness limit, so it is shown as Grey." : `Freshness: a reading older than ${config.staleHours} hours is shown as Grey rather than used.`}
              bn={age.stale ? "পরিমাপটি সতেজতার সীমার চেয়ে পুরোনো, তাই ধূসর দেখানো হয়েছে।" : `সতেজতা: ${config.staleHours} ঘণ্টার বেশি পুরোনো পাঠ ব্যবহার না করে ধূসর দেখানো হয়।`}
            />
          </li>
        </ul>
      </section>

      <section className="mt-8 rounded-xl border border-line bg-card p-4 text-sm text-ink-2">
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
          <Link href="/methods#signals" className="underline decoration-line underline-offset-2 hover:text-ink">
            <T en="Methods" bn="পদ্ধতি" />
          </Link>{" "}
          ·{" "}
          <Link href="/signals" className="underline decoration-line underline-offset-2 hover:text-ink">
            <T en="Open Signals" bn="সংকেত দেখুন" />
          </Link>
        </p>
      </section>
    </main>
  );
}
