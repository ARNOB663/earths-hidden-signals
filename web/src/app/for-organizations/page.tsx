import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Database, FileText, Mail, MapPinned, ScanEye, Workflow } from "lucide-react";
import { T } from "@/lib/i18n";
import { bnNum } from "@/lib/bn";
import { readCoverage, readGeographyIndex } from "@/lib/geography/data";
import { loadModel } from "@/lib/signals/model";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "For organizations · Earth's Hidden Signals",
  description:
    "What Earth's Hidden Signals is, the coverage audit it can produce, and the data feeds on the roadmap. Roadmap items are planned, not implemented. Not a forecast or an official warning.",
};

const GITHUB = "https://github.com/ARNOB663/earths-hidden-signals";
const CONTACT = "mailto:?subject=Earth%27s%20Hidden%20Signals%20enquiry";

/**
 * For organizations: what the platform is today, a worked coverage-audit example from the same
 * computed files the Gap page uses, and a roadmap. Every roadmap row is explicitly labelled
 * PLANNED — nothing here is described as running that is not running.
 */
export default async function ForOrganizationsPage() {
  const [model, geography, coverage] = await Promise.all([
    loadModel(),
    readGeographyIndex(),
    readCoverage(),
  ]);

  const listed = geography.counts?.countries ?? 0;
  const measured = (coverage.measuredCountries ?? []).length;
  const ready = model.rows.length;
  const live = model.counts.live;
  const countries = model.counts.countries;
  const pct = (part: number, whole: number) => (whole === 0 ? "0" : ((part / whole) * 100).toFixed(1));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          <T en="For organizations" bn="প্রতিষ্ঠানের জন্য" />
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="A coverage audit you can act on" bn="কাজে লাগানোর মতো আচ্ছাদন-নিরীক্ষা" />
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          <T
            en="Earth's Hidden Signals turns NASA and partner records into a per-district answer to one question: is today's rain unusual here, can the data be trusted, and where is the answer simply unavailable? It is observational screening. It is not a forecast and not an official warning, and it never replaces a national agency."
            bn="আর্থস হিডেন সিগন্যালস নাসা ও সহযোগী রেকর্ড থেকে প্রতি জেলার জন্য একটি প্রশ্নের উত্তর তৈরি করে: এখানে আজকের বৃষ্টি অস্বাভাবিক কি না, তথ্য ভরসাযোগ্য কি না, আর কোথায় উত্তরটি আদৌ পাওয়া যায় না? এটি পর্যবেক্ষণভিত্তিক স্ক্রিনিং। পূর্বাভাস নয়, সরকারি সতর্কবার্তাও নয়, এবং জাতীয় সংস্থার বিকল্প কখনো নয়।"
          />
        </p>
      </header>

      {/* ── What it is ── */}
      <section aria-labelledby="what" className="mt-8">
        <h2 id="what" className="text-lg font-semibold text-ink">
          <T en="What the platform offers" bn="প্ল্যাটফর্ম কী দেয়" />
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {OFFERS.map(({ Icon, en, bn }) => (
            <article key={en.t} className="flex gap-3 rounded-2xl border border-line bg-card p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon size={20} aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  <T en={en.t} bn={bn.t} />
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">
                  <T en={en.b} bn={bn.b} />
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Worked coverage-audit example ── */}
      <section aria-labelledby="audit" className="mt-10">
        <h2 id="audit" className="text-lg font-semibold text-ink">
          <T en="Coverage audit: a worked example" bn="আচ্ছাদন-নিরীক্ষা: একটি উদাহরণ" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="The same accounting the Gap page runs, stated as an audit. Every figure is computed from the files this site ships, on every build."
            bn="‘ফাঁক’ পাতা যে হিসাব চালায় তা-ই একটি নিরীক্ষা হিসেবে। প্রতিটি সংখ্যা এই সাইটের ফাইল থেকেই, প্রতিবার গড়ার সময় গণনা করা।"
          />
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Listed", labelBn: "তালিকাভুক্ত", value: listed, hint: "countries with a boundary", hintBn: "সীমানাসহ দেশ" },
            { label: "Measured", labelBn: "পরিমাপকৃত", value: measured, hint: "overlap the analysis grids", hintBn: "বিশ্লেষণ-গ্রিডের সাথে মেলে" },
            { label: "Decision-ready", labelBn: "সিদ্ধান্তযোগ্য", value: ready, hint: `${countries} countries`, hintBn: `${bnNum(countries)} দেশ` },
            { label: "Live Signal", labelBn: "সরাসরি সংকেত", value: live, hint: "current rain observation", hintBn: "সাম্প্রতিক বৃষ্টি-পর্যবেক্ষণ" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-line bg-card px-3 py-2.5">
              <dt className="text-xs text-ink-3">
                <T en={item.label} bn={item.labelBn} />
              </dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-ink">{item.value.toLocaleString("en-US")}</dd>
              <dd className="mt-0.5 text-[11px] leading-snug text-ink-3">
                <T en={item.hint} bn={item.hintBn} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          <T
            en={`Of ${listed} listed countries, ${measured} overlap the NASA analysis grids (${pct(measured, listed)}%) and ${ready.toLocaleString("en-US")} administrative areas carry a place record. That fall from listed geography to a decision-ready reading is the finding, not a defect — and it is what an organization planning coverage needs to see.`}
            bn={`${bnNum(listed)}টি তালিকাভুক্ত দেশের মধ্যে ${bnNum(measured)}টি (${bnNum(pct(measured, listed))}%) নাসার বিশ্লেষণ-গ্রিডের সাথে মেলে, আর ${bnNum(ready.toLocaleString("en-US"))}টি প্রশাসনিক এলাকার রেকর্ড আছে। তালিকাভুক্ত ভূগোল থেকে সিদ্ধান্তযোগ্য পাঠে এই পতনটাই ফলাফল, ত্রুটি নয় — আর আচ্ছাদন পরিকল্পনা করা প্রতিষ্ঠানের জন্য এটিই দেখা দরকার।`}
          />
        </p>
        <Link
          href="/gap"
          className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-accent-strong underline decoration-line underline-offset-2 hover:decoration-current"
        >
          <ScanEye size={15} aria-hidden />
          <T en="See the full coverage audit" bn="সম্পূর্ণ আচ্ছাদন-নিরীক্ষা দেখুন" />
          <ArrowRight size={14} aria-hidden />
        </Link>
      </section>

      {/* ── Roadmap, explicitly planned ── */}
      <section aria-labelledby="roadmap" className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="roadmap" className="text-lg font-semibold text-ink">
            <T en="Potential data-feed roadmap" bn="সম্ভাব্য তথ্য-প্রবাহের রোডম্যাপ" />
          </h2>
          <span className="rounded-full bg-watch-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-watch">
            <T en="Planned — not implemented" bn="পরিকল্পিত — বাস্তবায়িত নয়" />
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="These feeds are not running. Nothing on this page should be read as a current capability; each row states what would be needed to build it."
            bn="এই তথ্যপ্রবাহগুলো চালু নেই। এই পাতার কিছুই বর্তমান সক্ষমতা হিসেবে পড়া উচিত নয়; প্রতিটি সারি বলে এটি গড়তে কী দরকার হবে।"
          />
        </p>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
          {ROADMAP.map((item) => (
            <li key={item.en.t} className="flex flex-wrap items-start gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sunken text-ink-3">
                <item.Icon size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">
                    <T en={item.en.t} bn={item.bn.t} />
                  </h3>
                  <span className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                    <T en="Planned" bn="পরিকল্পিত" />
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">
                  <T en={item.en.b} bn={item.bn.b} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Contact ── */}
      <section aria-labelledby="contact" className="mt-10 rounded-2xl border border-line bg-sunken p-5">
        <h2 id="contact" className="text-base font-semibold text-ink">
          <T en="Get in touch" bn="যোগাযোগ" />
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          <T
            en="The whole project — pipeline, data and site — is open. For a coverage audit of your region, a data question, or to report something wrong, the repository and its issue tracker are the working channel."
            bn="পুরো প্রকল্প — পাইপলাইন, তথ্য ও সাইট — উন্মুক্ত। আপনার অঞ্চলের আচ্ছাদন-নিরীক্ষা, তথ্য সংক্রান্ত প্রশ্ন, বা কোনো ভুল জানাতে রিপোজিটরি ও তার ইস্যু-ট্র্যাকারই কাজের মাধ্যম।"
          />
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-medium text-ink hover:border-ink-3"
          >
            <FileText size={15} aria-hidden />
            <T en="Open the repository" bn="রিপোজিটরি খুলুন" />
          </a>
          <a
            href={CONTACT}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-medium text-ink hover:border-ink-3"
          >
            <Mail size={15} aria-hidden />
            <T en="Start an email" bn="ইমেইল শুরু করুন" />
          </a>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          <T
            en="The email link opens your own mail app; this site sends nothing and stores no contact details."
            bn="ইমেইল লিংক আপনার নিজের মেইল অ্যাপ খোলে; এই সাইট কিছু পাঠায় না এবং কোনো যোগাযোগের তথ্য সংরক্ষণ করে না।"
          />
        </p>
      </section>

      <p className="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-ink-3">
        <T
          en="Observational screening. Not a forecast, not an official warning. Every number on this page is computed from the committed datasets; roadmap items are labelled planned and are not running."
          bn="পর্যবেক্ষণভিত্তিক স্ক্রিনিং। পূর্বাভাস নয়, সরকারি সতর্কবার্তা নয়। এই পাতার প্রতিটি সংখ্যা সংরক্ষিত তথ্যসেট থেকে গণনা করা; রোডম্যাপের বিষয়গুলো পরিকল্পিত হিসেবে চিহ্নিত এবং চালু নয়।"
        />
      </p>
    </main>
  );
}

const OFFERS: {
  Icon: typeof Building2;
  en: { t: string; b: string };
  bn: { t: string; b: string };
}[] = [
  {
    Icon: MapPinned,
    en: {
      t: "Per-district coverage, stated honestly",
      b: "Every listed area carries one of three coverage states with the reason, so an absence of signal is visible rather than hidden.",
    },
    bn: {
      t: "প্রতি জেলার আচ্ছাদন, সৎভাবে বলা",
      b: "প্রতিটি তালিকাভুক্ত এলাকা কারণসহ তিনটি আচ্ছাদন-অবস্থার একটি বহন করে, তাই সংকেতের অনুপস্থিতি লুকানো নয়, দৃশ্যমান।",
    },
  },
  {
    Icon: Database,
    en: {
      t: "Sample sizes on every frequency",
      b: "Historical frequency is always shown with the number of cases and a 95% interval, never as a bare percentage.",
    },
    bn: {
      t: "প্রতিটি ফ্রিকোয়েন্সিতে নমুনার আকার",
      b: "ঐতিহাসিক ফ্রিকোয়েন্সি সবসময় কতটি ক্ষেত্রে এবং ৯৫% ব্যবধানসহ দেখানো হয়, কখনো শুধু শতাংশ হিসেবে নয়।",
    },
  },
  {
    Icon: Workflow,
    en: {
      t: "A backtest you can inspect",
      b: "Replay and Accuracy show hits, misses and the tests that failed, year by year, with the same data the screen would have had at the time.",
    },
    bn: {
      t: "পরীক্ষা করার মতো ব্যাকটেস্ট",
      b: "‘পুনরাবৃত্তি’ ও ‘নির্ভুলতা’ বছরে-বছরে হিট, বাদ পড়া ও ব্যর্থ পরীক্ষা দেখায়, স্ক্রিনিং তখন যে তথ্য পেত তা দিয়েই।",
    },
  },
  {
    Icon: FileText,
    en: {
      t: "Open methods and data",
      b: "Thresholds, statistics and sources are published, and the pipeline is committed, so any figure can be traced to its origin.",
    },
    bn: {
      t: "উন্মুক্ত পদ্ধতি ও তথ্য",
      b: "সীমা, পরিসংখ্যান ও সূত্র প্রকাশিত, আর পাইপলাইন সংরক্ষিত, তাই যেকোনো সংখ্যার উৎস খুঁজে পাওয়া যায়।",
    },
  },
];

const ROADMAP: {
  Icon: typeof Building2;
  en: { t: string; b: string };
  bn: { t: string; b: string };
}[] = [
  {
    Icon: Database,
    en: {
      t: "More regions",
      b: "Extending the analysis grids beyond South Asia would need the same NASA products tiled, gridded and baselined for each new region before any reading is shown.",
    },
    bn: {
      t: "আরও অঞ্চল",
      b: "দক্ষিণ এশিয়ার বাইরে বিশ্লেষণ-গ্রিড বাড়াতে প্রতিটি নতুন অঞ্চলের জন্য একই নাসা-পণ্য টাইল, গ্রিড ও ভিত্তি-রেকর্ড করতে হবে, তারপর কোনো পাঠ দেখানো যাবে।",
    },
  },
  {
    Icon: Workflow,
    en: {
      t: "Shorter-horizon feeds",
      b: "Sub-daily rainfall and river-gauge feeds could sharpen the observation window, but each needs a validation and backtest story before it is published.",
    },
    bn: {
      t: "আরও কাছের সময়ের তথ্যপ্রবাহ",
      b: "দৈনিকের চেয়ে সূক্ষ্ম বৃষ্টি ও নদী-গেজ তথ্যপ্রবাহ পর্যবেক্ষণের জানালা বাড়াতে পারে, তবে প্রকাশের আগে প্রতিটির যাচাই ও ব্যাকটেস্ট দরকার।",
    },
  },
  {
    Icon: Mail,
    en: {
      t: "Notification delivery",
      b: "Server-side alerts would require accounts, delivery infrastructure and a clear consent model. Nothing of this is built; preferences remain in the viewer's browser only.",
    },
    bn: {
      t: "নোটিফিকেশন সরবরাহ",
      b: "সার্ভার-ভিত্তিক সতর্কবার্তার জন্য অ্যাকাউন্ট, সরবরাহ زیرকাঠামো ও স্পষ্ট সম্মতি-মডেল দরকার। এর কিছুই তৈরি নয়; পছন্দ কেবল দর্শকের ব্রাউজারে থাকে।",
    },
  },
];
