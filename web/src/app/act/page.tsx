import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, Phone, Radio, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { ActionMessages } from "@/components/signal/ActionMessages";
import { SampleNotice } from "@/components/signal/SampleNotice";
import { ShareCard } from "@/components/signal/ShareCard";
import { CoverageBadge, WatchBadge } from "@/components/signal/levels";
import { T } from "@/lib/i18n";
import { loadModel } from "@/lib/signals/model";
import { Eyebrow } from "@/components/ui/primitive";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Act · Earth's Hidden Signals",
  description:
    "Preparedness guidance in English and Bangla: what to do when a location shows an elevated watch, practical checklists, SMS-style messages and shareable evidence cards. Not an official warning.",
};

/**
 * Act is preparedness, not alerting. Nothing here fires on its own, nothing is sent anywhere, and
 * the page says so. The example card is a real Signal row read from the committed data, never a
 * mock-up, so the shareable evidence carries a real date, level and sample size.
 */
export default async function ActPage() {
  const model = await loadModel();
  const { rows, brief } = model;

  // A concrete row to demonstrate the share card and the message templates: the strongest real
  // reading in the data, so the card carries a genuine date, level and sample size. It is labelled
  // on screen as an example, and it keeps whatever coverage state the row actually has — a stale
  // reading is shown with its age rather than passed off as current.
  const withReading = rows.filter((row) => row.rain.day1 !== null);
  const example = [...withReading].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <header>
        <Eyebrow en="Preparedness" bn="প্রস্তুতি" />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="What to do when a watch is raised" bn="সতর্কতা দেখা দিলে কী করবেন" />
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          <T
            en="A Watch Level here is observational screening. It says the rain is unusual for the date; it does not forecast a flood and it is never an official warning. Use it as a prompt to check the official source and prepare early. Nothing on this page is sent to you automatically."
            bn="এখানে সতর্কতার মাত্রা মানে পর্যবেক্ষণভিত্তিক স্ক্রিনিং। এটি বোঝায় ওই তারিখের জন্য বৃষ্টি অস্বাভাবিক; এটি বন্যার পূর্বাভাস দেয় না এবং কখনো সরকারি সতর্কবার্তা নয়। এটি সরকারি সূত্র দেখে আগেভাগে প্রস্তুতি নেওয়ার ইঙ্গিত হিসেবে ব্যবহার করুন। এই পাতার কিছুই আপনাকে স্বয়ংক্রিয়ভাবে পাঠানো হয় না।"
          />
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
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

      {/* ── What a raised watch means, in the three-step language of the Signal page ── */}
      <section aria-labelledby="reading" className="mt-8">
        <h2 id="reading" className="text-lg font-semibold text-ink">
          <T en="Read the signal before you act" bn="প্রস্তুতির আগে সংকেত পড়ুন" />
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            {
              Icon: Radio,
              en: {
                t: "Check the observation, not the mood",
                b: "Open the location and read the observation date, the source and how old the reading is. An old reading is not current.",
              },
              bn: {
                t: "মেজাজ নয়, পর্যবেক্ষণ দেখুন",
                b: "স্থানটি খুলে পর্যবেক্ষণের তারিখ, সূত্র ও পাঠ কত পুরোনো তা পড়ুন। পুরোনো পাঠ বর্তমান নয়।",
              },
            },
            {
              Icon: ShieldCheck,
              en: {
                t: "Weigh the Data Trust Grade",
                b: "Low trust means at least two data-quality factors are weak. Treat the reading as indicative only, and the official warning as what matters.",
              },
              bn: {
                t: "তথ্য-ভরসার গ্রেড বিচার করুন",
                b: "নিম্ন ভরসা মানে অন্তত দুটি মানের কারণ দুর্বল। পাঠটিকে কেবল ইঙ্গিতমূলক ধরে নিন, আর সরকারি সতর্কবার্তাকে প্রধান্য দিন।",
              },
            },
            {
              Icon: Users,
              en: {
                t: "Act locally, early",
                b: "Know the nearest flood shelter and a raised road out. Share what you read with the people who need it, with the date and the limits attached.",
              },
              bn: {
                t: "স্থানীয়ভাবে, আগেভাগে কাজ করুন",
                b: "নিকটতম বন্যা-আশ্রয়কেন্দ্র ও উঁচু পথ জেনে রাখুন। তারিখ ও সীমাসহ যা পড়েছেন তা প্রয়োজনের মানুষদের সাথে ভাগ করুন।",
              },
            },
          ].map(({ Icon, en, bn }, index) => (
            <article key={index} className="rounded-2xl border border-line bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon size={16} aria-hidden className="text-accent-strong" />
                <T en={en.t} bn={bn.t} />
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                <T en={en.b} bn={bn.b} />
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Preparedness checklist ── */}
      <section aria-labelledby="checklist" className="mt-10">
        <h2 id="checklist" className="text-lg font-semibold text-ink">
          <T en="Before the water arrives" bn="পানি আসার আগে" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="A short list you can act on this week, whether or not any watch is raised today. Every item is general preparedness guidance, not a response to a specific reading."
            bn="এই সপ্তাহেই যা করা যায় এমন একটি ছোট তালিকা, আজ কোনো সতর্কতা থাকুক বা না থাকুক। প্রতিটি বিষয় সাধারণ প্রস্তুতির নির্দেশনা, কোনো নির্দিষ্ট পাঠের প্রতিক্রিয়া নয়।"
          />
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {CHECKLIST.map((item, index) => (
            <div key={index} className="rounded-2xl border border-line bg-card p-4">
              <h3 className="text-sm font-semibold text-ink">
                <T en={item.en.t} bn={item.bn.t} />
              </h3>
              <ul className="mt-2 space-y-1.5">
                {item.en.items.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-2">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <T en={line} bn={item.bn.items[i]} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── A real example card, and the SMS-style messages built from it ── */}
      {example && (
        <section aria-labelledby="messages" className="mt-10">
          <h2 id="messages" className="text-lg font-semibold text-ink">
            <T en="Shareable warnings and messages" bn="শেয়ারযোগ্য সতর্কতা ও বার্তা" />
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            <T
              en="Built from one real covered location, so the date, level and sample size are genuine. The card and the short messages always carry the standing line that this is screening, not an official warning."
              bn="একটি বাস্তব আচ্ছাদিত স্থান থেকে তৈরি, তাই তারিখ, মাত্রা ও নমুনার আকার সত্যিকারের। কার্ড ও ছোট বার্তাগুলো সবসময় বলে দেয় এটি স্ক্রিনিং, সরকারি সতর্কবার্তা নয়।"
            />
          </p>
          <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
            <span className="font-medium text-ink-2">
              <T en="Example location:" bn="উদাহরণ স্থান:" />
            </span>
            {example.name}, {example.countryName}
            <CoverageBadge state={example.coverage} />
            <WatchBadge level={example.watch} compact />
          </p>

          {example.sample && (
            <div className="mt-3">
              <SampleNotice where="in this example card and the messages below" compact />
            </div>
          )}

          <ActionMessages row={example} />
          <ShareCard row={example} />
        </section>
      )}

      {/* ── Community resources ── */}
      <section aria-labelledby="resources" className="mt-10">
        <h2 id="resources" className="text-lg font-semibold text-ink">
          <T en="Community preparedness resources" bn="সম্প্রদায়-প্রস্তুতির সম্পদ" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="Where to get the official word, and how to check what we show. These are external services; the links open in a new tab."
            bn="সরকারি কথা কোথায় পাবেন, আর আমরা যা দেখাই তা কীভাবে যাচাই করবেন। এগুলো বাইরের সেবা; লিংক নতুন ট্যাবে খোলে।"
          />
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {RESOURCES.map((resource) => (
            <li key={resource.href}>
              <a
                href={resource.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <resource.Icon size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <T en={resource.en} bn={resource.bn} />
                    <ExternalLink size={13} aria-hidden className="text-ink-3" />
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-ink-2">
                    <T en={resource.text.en} bn={resource.text.bn} />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="limits" className="mt-10 rounded-2xl border border-line bg-sunken p-5">
        <h2 id="limits" className="text-base font-semibold text-ink">
          <T en="What this page does not do" bn="এই পাতা যা করে না" />
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
          {LIMITS.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />
              <T en={item.en} bn={item.bn} />
            </li>
          ))}
        </ul>
        <Link
          href="/watch"
          className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-accent-strong underline decoration-line underline-offset-2 hover:decoration-current"
        >
          <T en="Save places and set your own preferences" bn="স্থান সংরক্ষণ করুন ও পছন্দ ঠিক করুন" />
          <ArrowRight size={15} aria-hidden />
        </Link>
      </section>

      <p className="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-ink-3">
        <T
          en="Preparedness guidance on this page is general and ours. Official warnings come from national meteorological and disaster agencies — always follow them. Nothing here is sent automatically, and no notification service is running."
          bn="এই পাতার প্রস্তুতির নির্দেশনা সাধারণ ও আমাদের নিজস্ব। সরকারি সতর্কবার্তা আসে জাতীয় আবহাওয়া ও দুর্যোগ সংস্থা থেকে — সবসময় তা মেনে চলুন। এখান থেকে কিছুই স্বয়ংক্রিয়ভাবে পাঠানো হয় না, কোনো নোটিফিকেশন সেবা চালু নেই।"
        />
      </p>
    </main>
  );
}

const CHECKLIST: { en: { t: string; items: string[] }; bn: { t: string; items: string[] } }[] = [
  {
    en: {
      t: "Know your way out",
      items: [
        "Find the nearest flood shelter and note how long it takes to reach on foot.",
        "Identify a raised road or high ground you could use if the usual route floods.",
        "Agree a meeting point with your household in case you are separated.",
      ],
    },
    bn: {
      t: "বেরোনোর পথ জেনে রাখুন",
      items: [
        "নিকটতম বন্যা-আশ্রয়কেন্দ্র খুঁজুন এবং হেঁটে পৌঁছাতে কত সময় লাগে তা জেনে রাখুন।",
        "স্বাভাবিক পথ ডুবে গেলে ব্যবহার করা যায় এমন উঁচু রাস্তা বা উঁচু জমি চিহ্নিত করুন।",
        "আলাদা হয়ে গেলে পরিবারের সাথে কোথায় মিলবেন, তা ঠিক করে রাখুন।",
      ],
    },
  },
  {
    en: {
      t: "Protect what matters",
      items: [
        "Move documents, medicines and phone chargers into a waterproof bag you can carry.",
        "Store drinking water and a few days of dry food above expected flood level.",
        "Charge power banks and keep a torch within reach before the rain arrives.",
      ],
    },
    bn: {
      t: "যা গুরুত্বপূর্ণ তা রক্ষা করুন",
      items: [
        "নথিপত্র, ওষুধ ও ফোন-চার্জার একটি জলরোধী ব্যাগে রাখুন যা বহন করা যায়।",
        "খাবার পানি ও কয়েক দিনের শুকনো খাবার প্রত্যাশিত বন্যার স্তরের উপরে রাখুন।",
        "বৃষ্টি আসার আগে পাওয়ার-ব্যাংক চার্জ করুন ও টর্চ হাতের কাছে রাখুন।",
      ],
    },
  },
  {
    en: {
      t: "Keep the official channel open",
      items: [
        "Save your national meteorological service and local disaster office contacts.",
        "Check the official warning first; this site is only a prompt to look.",
        "Re-check the location's Signal after a few days — the reading ages, and an old one is not current.",
      ],
    },
    bn: {
      t: "সরকারি চ্যানেল খোলা রাখুন",
      items: [
        "জাতীয় আবহাওয়া সেবা ও স্থানীয় দুর্যোগ দপ্তরের যোগাযোগ সংরক্ষণ করুন।",
        "প্রথমে সরকারি সতর্কবার্তা দেখুন; এই সাইট কেবল দেখার তাগাদা দেয়।",
        "কয়েক দিন পরে স্থানটির সংকেত আবার দেখুন — পাঠ পুরোনো হয়, আর পুরোনো পাঠ বর্তমান নয়।",
      ],
    },
  },
  {
    en: {
      t: "Help the message travel",
      items: [
        "Share the card with its date, level, trust grade and limits attached.",
        "Never strip the 'not an official warning' line when you forward it.",
        "Ask neighbours who may not see this site whether they have what they need.",
      ],
    },
    bn: {
      t: "বার্তা ছড়াতে সাহায্য করুন",
      items: [
        "কার্ডটি তারিখ, মাত্রা, ভরসার গ্রেড ও সীমাসহ শেয়ার করুন।",
        "ফরওয়ার্ড করার সময় ‘সরকারি সতর্কবার্তা নয়’ লাইনটি কখনো মুছবেন না।",
        "যাঁরা এই সাইট দেখেন না এমন প্রতিবেশীদের প্রয়োজনীয় সব আছে কি না জিজ্ঞেস করুন।",
      ],
    },
  },
];

const RESOURCES: {
  href: string;
  Icon: typeof ShieldAlert;
  en: string;
  bn: string;
  text: { en: string; bn: string };
}[] = [
  {
    href: "https://severeweather.wmo.int/",
    Icon: ShieldAlert,
    en: "WMO Severe Weather Information Centre",
    bn: "WMO তীব্র আবহাওয়া তথ্যকেন্দ্র",
    text: {
      en: "The official warnings map run by the World Meteorological Organization.",
      bn: "বিশ্ব আবহাওয়া সংস্থার পরিচালিত সরকারি সতর্কবার্তার মানচিত্র।",
    },
  },
  {
    href: "https://www.gdacs.org/",
    Icon: Radio,
    en: "GDACS",
    bn: "GDACS",
    text: {
      en: "The global disaster alert and coordination system whose flood catalogue backs our replay.",
      bn: "বিশ্ব দুর্যোগ সতর্কতা ও সমন্বয় ব্যবস্থা, যার বন্যা-ক্যাটালগ আমাদের পুনরাবৃত্তিকে সমর্থন করে।",
    },
  },
  {
    href: "https://www.ifrc.org/",
    Icon: Users,
    en: "IFRC",
    bn: "IFRC",
    text: {
      en: "Red Cross / Red Crescent preparedness resources and local branches.",
      bn: "রেডক্রস / রেড ক্রিসেন্টের প্রস্তুতির সম্পদ ও স্থানীয় শাখা।",
    },
  },
  {
    href: "/methods#data",
    Icon: Phone,
    en: "Our data sources",
    bn: "আমাদের তথ্যসূত্র",
    text: {
      en: "Every dataset behind a Signal, with its update frequency and resolution.",
      bn: "সংকেতের পেছনের প্রতিটি তথ্যসেট, তার হালনাগাদের হার ও রেজল্যুশনসহ।",
    },
  },
];

const LIMITS: { en: string; bn: string }[] = [
  {
    en: "It does not send SMS, email or push notifications. No notification service is running; the Watch page stores your preferences in your browser only.",
    bn: "এটি এসএমএস, ইমেইল বা পুশ নোটিফিকেশন পাঠায় না। কোনো নোটিফিকেশন সেবা চালু নেই; ‘নজর’ পাতা আপনার পছন্দ কেবল আপনার ব্রাউজারে সংরক্ষণ করে।",
  },
  {
    en: "It does not forecast a flood, and a raised Watch Level is not a prediction that one will happen.",
    bn: "এটি বন্যার পূর্বাভাস দেয় না, আর উঁচু সতর্কতার মাত্রা মানে বন্যা হবে বলে ভবিষ্যদ্বাণী নয়।",
  },
  {
    en: "It cannot reach locations outside the covered South Asia tiles. Use the Gap page to see where, and why.",
    bn: "এটি আচ্ছাদিত দক্ষিণ এশিয়ার টাইলের বাইরের স্থানে পৌঁছাতে পারে না। কোথায় ও কেন, তা ‘ফাঁক’ পাতায় দেখুন।",
  },
];
