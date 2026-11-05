import {
  ArrowRight,
  CloudRain,
  ExternalLink,
  Gauge,
  Microscope,
  Radio,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import HeroImageSlideshow from "@/components/hero/HeroImageSlideshow";
import { SignalSearch } from "@/components/signal/SignalSearch";
import { CoverageBadge, Stat, WatchBadge } from "@/components/signal/levels";
import { T } from "@/lib/i18n";
import { bnNum } from "@/lib/bn";
import { loadModel } from "@/lib/signals/model";

export const revalidate = 86400;

export const metadata = {
  title: "Earth's Hidden Signals",
  description:
    "What the rain is doing in each covered district of South Asia, whether it is unusual for the date, what historical evidence exists, and where the data cannot answer. Observational screening, never a forecast or an official warning.",
};

export default async function Home() {
  const model = await loadModel();
  const { rows, counts, brief, sample } = model;

  // One worked example for the "what a signal says" strip, chosen from the data rather than typed
  // in: the row with a real reading whose rain is furthest above its own date normal. A row is
  // eligible when it has a measured reading and an anomaly, whether or not that reading is still
  // current — a stale reading is shown with its age, not hidden, so the strip is never a stand-in.
  const measured = rows.filter((row) => row.rain.day1 !== null && row.ratio !== null);
  const example = [...measured].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0] ?? null;

  return (
    <>
      <section className="home-hero relative -mt-16 overflow-hidden pt-16" aria-labelledby="hero-hdg">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div
            className="absolute right-0 top-0 h-200 w-200 opacity-50"
            style={{
              background:
                "radial-gradient(circle at center, color-mix(in srgb, var(--accent) 11%, transparent), transparent 65%)",
              transform: "translate(35%, -25%)",
            }}
          />
        </div>

        <HeroImageSlideshow />

        <div className="relative mx-auto max-w-384 px-6 pb-20 pt-14 sm:px-8 lg:min-h-[86vh] lg:px-12 lg:pb-28 lg:pt-20">
          <div className="relative z-10 max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft px-4 py-1.5 text-sm font-medium text-accent">
              <Radio size={14} aria-hidden />
              <T en="Observational screening · not a forecast" bn="পর্যবেক্ষণভিত্তিক স্ক্রিনিং · পূর্বাভাস নয়" />
            </p>

            <h1
              id="hero-hdg"
              className="mt-5 text-[2.6rem] font-semibold leading-[1.07] tracking-tight text-white sm:text-6xl lg:text-[3.25rem] xl:text-[3.75rem]"
            >
              <T
                en="Is today normal where you live — and where can nobody say?"
                bn="আপনার এলাকায় আজ কি স্বাভাবিক — আর কোথায় কেউ বলতে পারে না?"
              />
            </h1>

            <p className="mt-5 max-w-[52ch] text-lg leading-[1.6] text-white/85">
              <T
                en={`We compare today's satellite rain with the same date in ${counts.places.toLocaleString("en")} districts and states of South Asia. Every location states what was observed, whether it is unusual, what history says, how far its data can be trusted — and where it cannot answer at all.`}
                bn={`আমরা আজকের স্যাটেলাইট-বৃষ্টিকে দক্ষিণ এশিয়ার ${bnNum(counts.places.toLocaleString("en"))}টি জেলা ও রাজ্যের একই তারিখের সাথে মিলিয়ে দেখি। প্রতিটি স্থান বলে কী পর্যবেক্ষণ করা হয়েছে, তা অস্বাভাবিক কি না, ইতিহাস কী বলে, তথ্য কতটা ভরসাযোগ্য — আর কোথায় তা আদৌ উত্তর দিতে পারে না।`}
              />
            </p>

            <div className="mt-7 max-w-md">
              <SignalSearch rows={rows} />
              <p className="mt-2 text-sm text-white/75">
                <T en="Search a country, state or district." bn="দেশ, রাজ্য বা জেলা খুঁজুন।" />
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/signal"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent-strong px-6 font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
                style={{ boxShadow: "0 4px 18px color-mix(in srgb, var(--accent) 38%, transparent)" }}
              >
                <Gauge size={18} aria-hidden />
                <T en="Open the Signal" bn="সংকেত খুলুন" />
              </Link>
              <Link
                href="/gap"
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/25 bg-white/15 px-6 font-medium text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/22"
              >
                <ScanEye size={18} aria-hidden />
                <T en="See where the data stops" bn="দেখুন তথ্য কোথায় শেষ" />
              </Link>
            </div>

            <a
              href={brief.official.wmo}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
            >
              <ShieldAlert size={15} aria-hidden />
              <T en="Official warnings (WMO SWIC)" bn="সরকারি সতর্কবার্তা (WMO SWIC)" />
              <ExternalLink size={13} aria-hidden />
            </a>
          </div>
        </div>

        <p className="absolute bottom-2 right-3 z-10 select-none text-[10px] text-white/55">
          Photos: Wikimedia Commons / Bangladesh flood series
        </p>
      </section>

      <div className="mx-auto w-full max-w-384 px-6 pb-24 sm:px-8 lg:px-12">
        {sample && (
          <p role="status" className="mt-8 rounded-xl border border-watch bg-watch-soft px-4 py-3 text-sm text-watch">
            <T
              en="SAMPLE DATA — the rain readings behind this site are fixed samples, not real observations. Coverage counts and the backtest on /accuracy come from real datasets."
              bn="নমুনা তথ্য — এই সাইটের পেছনের বৃষ্টির পাঠ স্থির নমুনা, বাস্তব পর্যবেক্ষণ নয়। আচ্ছাদনের সংখ্যা এবং /accuracy-এর ব্যাকটেস্ট বাস্তব তথ্যসেট থেকে।"
            />
          </p>
        )}

        {/* ── What the platform answers today, in counts ── */}
        <section aria-labelledby="coverage-hdg" className="mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <T en="Coverage at a glance" bn="এক নজরে আচ্ছাদন" />
          </p>
          <h2 id="coverage-hdg" className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            <T en="What we can answer, and what we cannot" bn="আমরা কী উত্তর দিতে পারি, আর কী পারি না" />
          </h2>
          <p className="mt-3 max-w-[68ch] text-base leading-relaxed text-ink-2">
            <T
              en="Every covered location falls into one of three states. The number of locations in each state is computed from the data on every build, never typed in."
              bn="প্রতিটি আচ্ছাদিত স্থান তিনটি অবস্থার একটিতে পড়ে। প্রতিটি অবস্থায় কতটি স্থান আছে, তা প্রতিবার গড়ার সময় তথ্য থেকে গণনা করা হয়, হাতে লেখা নয়।"
            />
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Covered locations"
              labelBn="আচ্ছাদিত স্থান"
              value={counts.places.toLocaleString("en")}
              hint={`${counts.countries} countries`}
              hintBn={`${bnNum(counts.countries)} দেশ`}
            />
            <Stat
              label="Live Signal"
              labelBn="সরাসরি সংকেত"
              value={counts.live.toLocaleString("en")}
              hint="current rain observation"
              hintBn="সাম্প্রতিক বৃষ্টি-পর্যবেক্ষণ"
            />
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
        </section>

        {/* ── A worked example, read from the data ── */}
        {example && (
          <section aria-labelledby="example-hdg" className="mt-14">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              <T en="What one signal says" bn="একটি সংকেত কী বলে" />
            </p>
            <h2 id="example-hdg" className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {example.name}, {example.countryName}
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <CoverageBadge state={example.coverage} />
              <WatchBadge level={example.watch} />
            </div>
            <p className="mt-3 max-w-[72ch] text-sm leading-relaxed text-ink-2">
              <T
                en={`The nearest satellite cell recorded ${example.rain.day1?.toFixed(1) ?? "–"} mm of rain, ${example.ratio?.toFixed(1) ?? "–"}× the usual amount for this date in its own record${example.percentile !== null ? `, at the ${example.percentile.toFixed(0)}th percentile` : ""}. Observed ${example.observed?.slice(0, 10) ?? "–"}. ${
                  example.frequency.state === "ok" && example.frequency.level
                    ? `At or above this rainfall level, floods were catalogued in ${example.frequency.level.floods} of ${example.frequency.level.cases} historical cases (95% interval ${(example.frequency.level.low * 100).toFixed(0)}–${(example.frequency.level.high * 100).toFixed(0)}%).`
                    : "Not enough historical evidence to calculate a reliable frequency here."
                }`}
                bn={`নিকটতম স্যাটেলাইট-কোষে বৃষ্টি হয়েছে ${bnNum(example.rain.day1?.toFixed(1) ?? "–")} মিমি, যা এই তারিখের নিজস্ব রেকর্ডে স্বাভাবিকের ${bnNum(example.ratio?.toFixed(1) ?? "–")} গুণ${example.percentile !== null ? `, ${bnNum(example.percentile.toFixed(0))}তম শতকাংশে` : ""}। পর্যবেক্ষণ ${example.observed?.slice(0, 10) ?? "–"}। ${
                  example.frequency.state === "ok" && example.frequency.level
                    ? `এই মাত্রার বৃষ্টিতে ${bnNum(example.frequency.level.cases)}টি ঐতিহাসিক ক্ষেত্রে ${bnNum(example.frequency.level.floods)}টিতে বন্যা নথিভুক্ত (৯৫% ব্যবধান ${bnNum((example.frequency.level.low * 100).toFixed(0))}–${bnNum((example.frequency.level.high * 100).toFixed(0))}%)।`
                    : "নির্ভরযোগ্য ফ্রিকোয়েন্সি গণনার জন্য যথেষ্ট ঐতিহাসিক প্রমাণ নেই।"
                }`}
              />
            </p>
            <Link
              href={`/signal/${example.id}`}
              className="mt-3 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-accent-strong underline decoration-line underline-offset-2 hover:decoration-current"
            >
              <T en="Open this Signal" bn="এই সংকেত খুলুন" />
              <ArrowRight size={15} aria-hidden />
            </Link>
          </section>
        )}

        {/* ── How it works: the three steps, same words the Signal page uses ── */}
        <section aria-labelledby="how-hdg" className="mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <T en="Method" bn="পদ্ধতি" />
          </p>
          <h2 id="how-hdg" className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            <T en="How a signal is made" bn="সংকেত কীভাবে তৈরি হয়" />
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              {
                Icon: Radio,
                en: { t: "Satellites observe", b: "NASA IMERG measures rain; GISTEMP and GPCP give the long historical record each location is compared against." },
                bn: { t: "স্যাটেলাইট পর্যবেক্ষণ করে", b: "নাসার IMERG বৃষ্টি মাপে; GISTEMP ও GPCP সেই দীর্ঘ ঐতিহাসিক রেকর্ড দেয়, যার সাথে প্রতিটি স্থান মেলানো হয়।" },
              },
              {
                Icon: Microscope,
                en: { t: "We ask if it is unusual", b: "The reading is set against the same date in every past year of that area's own record, and a Watch Level follows." },
                bn: { t: "আমরা দেখি এটি অস্বাভাবিক কি না", b: "পাঠটিকে ওই এলাকার নিজস্ব রেকর্ডের প্রতিটি আগের বছরের একই তারিখের সাথে মেলানো হয়, তারপর সতর্কতার মাত্রা নির্ধারিত হয়।" },
              },
              {
                Icon: CloudRain,
                en: { t: "History is shown with its sample size", b: "Where past years carry this much rain, we report how often floods were catalogued — always with the number of cases." },
                bn: { t: "ইতিহাস নমুনার আকারসহ দেখানো হয়", b: "যেসব আগের বছরে এই পরিমাণ বৃষ্টি ছিল, সেখানে কতবার বন্যা নথিভুক্ত হয়েছে তা জানাই — সবসময় কতটি ক্ষেত্রে, তা সহ।" },
              },
            ].map(({ Icon, en, bn }, index) => (
              <li key={index} className="flex gap-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <Icon size={22} aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-medium text-ink-3">
                    <T en={`Step ${index + 1}`} bn={`ধাপ ${bnNum(index + 1)}`} />
                  </p>
                  <p className="mt-0.5 font-semibold text-ink">
                    <T en={en.t} bn={bn.t} />
                  </p>
                  <p className="mt-2 leading-relaxed text-ink-2">
                    <T en={en.b} bn={bn.b} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex justify-end">
            <Link href="/methods" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <ShieldCheck size={15} aria-hidden />
              <T en="Read the full methodology" bn="পুরো পদ্ধতি পড়ুন" />
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </section>

        {/* ── Destinations ── */}
        <section aria-labelledby="pages-hdg" className="mt-14">
          <h2 id="pages-hdg" className="text-xl font-semibold tracking-tight text-ink">
            <T en="Where to go next" bn="এরপর কোথায় যাবেন" />
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {DESTINATIONS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-start gap-4 rounded-2xl border border-line bg-card p-5 shadow-soft transition-transform hover:-translate-y-0.5"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <item.Icon size={22} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">
                    <T en={item.en} bn={item.bn} />
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-ink-2">
                    <T en={item.text.en} bn={item.text.bn} />
                  </span>
                </span>
                <ArrowRight size={18} className="mt-1 shrink-0 text-accent transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ))}
          </div>
        </section>

        <p className="mt-14 border-t border-line pt-6 text-sm leading-relaxed text-ink-3">
          <T
            en="This site is observational screening: it shows what environmental signals are occurring and what historical evidence exists. It is not a forecast and not an official warning. Official warnings come from national meteorological and disaster agencies."
            bn="এই সাইট পর্যবেক্ষণভিত্তিক স্ক্রিনিং: এটি দেখায় কী পরিবেশগত সংকেত ঘটছে এবং কী ঐতিহাসিক প্রমাণ আছে। এটি পূর্বাভাস নয়, সরকারি সতর্কবার্তাও নয়। সরকারি সতর্কবার্তা আসে জাতীয় আবহাওয়া ও দুর্যোগ সংস্থা থেকে।"
          />
        </p>
      </div>
    </>
  );
}

const DESTINATIONS: {
  href: string;
  Icon: typeof Gauge;
  en: string;
  bn: string;
  text: { en: string; bn: string };
}[] = [
  {
    href: "/signal",
    Icon: Gauge,
    en: "Signal",
    bn: "সংকেত",
    text: {
      en: "The central page: search a country or district, see its observation, Watch Level, Data Trust Grade and the limits of its data.",
      bn: "মূল পাতা: দেশ বা জেলা খুঁজুন, তার পর্যবেক্ষণ, সতর্কতার মাত্রা, তথ্য-ভরসার গ্রেড ও তথ্যের সীমা দেখুন।",
    },
  },
  {
    href: "/gap",
    Icon: ScanEye,
    en: "Gap",
    bn: "ফাঁক",
    text: {
      en: "Where the map is listed but not measured, which datasets are missing, and why a location cannot receive a reliable signal.",
      bn: "কোথায় মানচিত্র আছে কিন্তু মাপা হয়নি, কোন তথ্যসেট অনুপস্থিত, আর কেন একটি স্থান নির্ভরযোগ্য সংকেত পায় না।",
    },
  },
  {
    href: "/replay",
    Icon: Microscope,
    en: "Replay",
    bn: "পুনরাবৃত্তি",
    text: {
      en: "Every year from 2000 replayed against catalogued floods: the rain, the threshold, the hits and the misses.",
      bn: "২০০০ থেকে প্রতিটি বছর নথিভুক্ত বন্যার সাথে পুনরাবৃত্ত: বৃষ্টি, সীমা, হিট ও বাদ পড়া।",
    },
  },
  {
    href: "/accuracy",
    Icon: ShieldCheck,
    en: "Accuracy",
    bn: "নির্ভুলতা",
    text: {
      en: "The backtest behind the Data Trust Grade: how the screen performed, and the tests that failed.",
      bn: "তথ্য-ভরসার গ্রেডের পেছনের ব্যাকটেস্ট: স্ক্রিনিং কেমন করেছে, আর কোন পরীক্ষাগুলো ব্যর্থ হয়েছে।",
    },
  },
  {
    href: "/act",
    Icon: CloudRain,
    en: "Act",
    bn: "প্রস্তুতি",
    text: {
      en: "Preparedness guidance in English and Bangla, checklists and shareable evidence cards.",
      bn: "ইংরেজি ও বাংলায় প্রস্তুতির নির্দেশনা, চেকলিস্ট ও শেয়ারযোগ্য প্রমাণ-কার্ড।",
    },
  },
  {
    href: "/watch",
    Icon: Radio,
    en: "Watch",
    bn: "নজর",
    text: {
      en: "Save the places you care about and choose what you would want to be told. Stored in your browser only.",
      bn: "আপনার প্রিয় স্থান সংরক্ষণ করুন ও কী জানতে চান তা বাছুন। কেবল আপনার ব্রাউজারে সংরক্ষিত।",
    },
  },
];
