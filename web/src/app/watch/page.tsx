import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellOff, CalendarClock, CloudSun, Database } from "lucide-react";
import { WatchManager } from "@/components/signal/WatchManager";
import { CoverageBadge, Pill, WatchBadge } from "@/components/signal/levels";
import { T } from "@/lib/i18n";
import { loadModel } from "@/lib/signals/model";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Watch · Earth's Hidden Signals",
  description:
    "Save the locations you care about and choose what you would want to be told. Preferences are stored in your own browser; there are no server-side notifications.",
};

export default async function WatchPage() {
  const model = await loadModel();
  const { rows, brief, counts } = model;
  // Only the fields the browser needs: no weather values are stored in the browser.
  const options = rows.map((row) => ({
    id: row.id,
    name: row.name,
    countryName: row.countryName,
    coverage: row.coverage,
    watch: row.watch,
    trust: row.trust,
    tileLabel: row.tileLabel,
  }));
  const example = rows.find((row) => row.coverage === "live") ?? null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          <T en="Watch" bn="নজর" />
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="Keep an eye on the places you care about" bn="আপনার প্রিয় স্থানগুলোয় নজর রাখুন" />
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          <T
            en="Save locations, choose which Watch Level and Trust Grade you want to be told about, and add a calendar reminder. Everything here is stored in this browser only."
            bn="স্থান সংরক্ষণ করুন, কোন সতর্কতার মাত্রা ও ভরসার গ্রেড সম্পর্কে জানতে চান তা বাছুন, এবং ক্যালেন্ডার রিমাইন্ডার যোগ করুন। এখানকার সবকিছু কেবল এই ব্রাউজারে সংরক্ষিত।"
          />
        </p>
      </header>

      <section aria-labelledby="limits" className="mt-5 rounded-2xl border border-watch bg-watch-soft p-4">
        <h2 id="limits" className="flex items-center gap-2 text-sm font-semibold text-watch">
          <BellOff size={16} aria-hidden />
          <T en="What this does not do" bn="এটি যা করে না" />
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-2">
          <li>
            <T
              en="There are no server-side notifications and no push notifications. Nothing is sent to us, and nothing will arrive while this site is closed."
              bn="কোনো সার্ভার-ভিত্তিক বিজ্ঞপ্তি বা পুশ বিজ্ঞপ্তি নেই। আমাদের কাছে কিছু পাঠানো হয় না, আর এই সাইট বন্ধ থাকলে কিছু পৌঁছাবে না।"
            />
          </li>
          <li>
            <T
              en="The saved list is a personal checklist for your next visit. To be reminded, use the calendar reminder (.ics) the page generates; it opens in your own calendar app."
              bn="সংরক্ষিত তালিকা আপনার পরবর্তী ভিজিটের জন্য ব্যক্তিগত চেকলিস্ট। মনে করিয়ে দিতে পাতাটি যে ক্যালেন্ডার রিমাইন্ডার (.ics) তৈরি করে তা ব্যবহার করুন; এটি আপনার নিজের ক্যালেন্ডার অ্যাপে খোলে।"
            />
          </li>
          <li>
            <T
              en="Notification preferences are part of the planned roadmap and are labelled as such below; they do not change what is shown today."
              bn="বিজ্ঞপ্তি-পছন্দ পরিকল্পিত রোডম্যাপের অংশ এবং নিচে তা-ই লেখা; এগুলো আজ যা দেখানো হয় তা বদলায় না।"
            />
          </li>
        </ul>
      </section>

      <WatchManager locations={options} />

      <section aria-labelledby="what" className="mt-8">
        <h2 id="what" className="text-lg font-semibold text-ink">
          <T en="What a watched location shows" bn="নজরে থাকা স্থান কী দেখায়" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en={`Each saved location opens its full Signal: observation date, source, resolution, baseline, value, percentile, Watch Level and Data Trust Grade. Today ${counts.live} of ${counts.places} covered locations carry a current reading; the other ${counts.seasonal + counts.cantTell} say why they cannot.`}
            bn={`প্রতিটি সংরক্ষিত স্থান তার সম্পূর্ণ সংকেত খোলে: পর্যবেক্ষণের তারিখ, উৎস, রেজোলিউশন, ভিত্তি, মান, শতকরা স্থান, সতর্কতার মাত্রা ও তথ্য-ভরসার গ্রেড। আজ ${counts.places}টি আচ্ছাদিত স্থানের ${counts.live}টিতে সাম্প্রতিক পাঠ আছে; বাকি ${counts.seasonal + counts.cantTell}টি কেন পারে না তা বলে।`}
          />
        </p>
        {example && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-ink">
                {example.name}, {example.countryName}
              </span>
              <CoverageBadge state={example.coverage} />
              <WatchBadge level={example.watch} compact />
            </div>
            <Link href={`/signal/${example.id}`} className="inline-flex min-h-9 items-center gap-1 text-sm text-accent-strong underline decoration-line underline-offset-2">
              <T en="Open" bn="খুলুন" />
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="roadmap" className="mt-8 rounded-2xl border border-line bg-sunken p-4">
        <h2 id="roadmap" className="text-lg font-semibold text-ink">
          <T en="Planned — not implemented" bn="পরিকল্পিত — বাস্তবায়িত নয়" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="These are the notification features the project intends to build. They are listed as planned so nobody expects them today."
            bn="এগুলো সেই বিজ্ঞপ্তি-সুবিধা যা প্রকল্পটি তৈরি করতে চায়। আজ কেউ যেন এগুলো প্রত্যাশা না করে সেজন্যপরিকল্পিত হিসেবে তালিকাভুক্ত।"
          />
        </p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            { Icon: CloudSun, en: "Rain outlook for saved locations, when it meets the evidence rules on the Accuracy page.", bn: "সংরক্ষিত স্থানের বৃষ্টির পূর্বাভাস, যখন তা নির্ভুলতা পাতার প্রমাণ-শর্ত পূরণ করবে।" },
            { Icon: Database, en: "A dataset-freshness alert that tells you when a reading for a saved place is stale.", bn: "তথ্যসেট-সতেজতার সতর্কতা, যা জানায় সংরক্ষিত স্থানের পাঠ পুরোনো হয়ে গেছে।" },
            { Icon: CalendarClock, en: "Weekly digest email through a dedicated mailing service.", bn: "নিবেদিত মেইলিং সেবার মাধ্যমে সাপ্তাহিক সারসংক্ষেপ ইমেইল।" },
            { Icon: BellOff, en: "Official-warning links for each saved location's national agency.", bn: "প্রতিটি সংরক্ষিত স্থানের জাতীয় সংস্থার সরকারি সতর্কবার্তার লিঙ্ক।" },
          ].map((item) => (
            <li key={item.en} className="flex gap-2 rounded-xl border border-line bg-card p-3 text-sm text-ink-2">
              <item.Icon size={16} aria-hidden className="mt-0.5 shrink-0 text-ink-3" />
              <span>
                <Pill tone="muted" className="mb-1">
                  <T en="Planned" bn="পরিকল্পিত" />
                </Pill>
                <T en={item.en} bn={item.bn} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-xs text-ink-3">
        <T en={brief.official.line} bn="এটি পূর্বাভাস বা সরকারি সতর্কবার্তা নয়।" />
      </p>
    </main>
  );
}
