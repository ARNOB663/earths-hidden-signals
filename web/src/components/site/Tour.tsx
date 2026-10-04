"use client";

import { ArrowLeft, ArrowRight, Compass, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { bnNum } from "@/lib/bn";
import { T, useT } from "@/lib/i18n";

/** The guided tour: each stop opens a page on a ready-made view and says what to notice. */
const STOPS: { href: string; title: [string, string]; text: [string, string] }[] = [
  {
    href: "/explore?layer=lst-day&date=2024-05-01&compare=2001&view=diff",
    title: ["Satellite map: then and now", "স্যাটেলাইট মানচিত্র: আগে আর এখন"],
    text: [
      "NASA's Terra satellite measured the ground's heat in May 2001 and May 2024. Red means 2024 was hotter. Look at northwest India and Pakistan.",
      "নাসার টেরা স্যাটেলাইট ২০০১ ও ২০২৪ সালের মে মাসে মাটির তাপ মেপেছে। লাল মানে ২০২৪ বেশি গরম ছিল। উত্তর-পশ্চিম ভারত ও পাকিস্তানের দিকে তাকান।",
    ],
  },
  {
    href: "/trends?var=temperature&season=annual",
    title: ["Climate trends: warming everywhere", "জলবায়ুর প্রবণতা: সবখানে উষ্ণতা"],
    text: [
      "Every square of South Asia has warmed since 1981, by about 0.3 °C every 10 years. Tap any square to read its own story.",
      "১৯৮১ সাল থেকে দক্ষিণ এশিয়ার প্রতিটি বর্গ গরম হয়েছে, প্রতি ১০ বছরে প্রায় ০.৩ °সে। যেকোনো বর্গে ট্যাপ করে তার নিজের গল্প পড়ুন।",
    ],
  },
  {
    href: "/trends?var=rainfall&season=monsoon",
    title: ["The monsoon rain is moving", "বর্ষার বৃষ্টি জায়গা বদলাচ্ছে"],
    text: [
      "Blue squares get more monsoon rain than before, red ones less. The dry northwest is getting wetter while the Bengal delta gets drier.",
      "নীল বর্গে আগের চেয়ে বেশি বর্ষার বৃষ্টি হচ্ছে, লালে কম। শুষ্ক উত্তর-পশ্চিমে বৃষ্টি বাড়ছে, আর বাংলার ব-দ্বীপে কমছে।",
    ],
  },
  {
    href: "/hazards?hazard=flood&zone=indus-plain",
    title: ["Disaster risk: a signal to prepare", "দুর্যোগের ঝুঁকি: প্রস্তুতির সংকেত"],
    text: [
      "In 2025 the Indus plain's monsoon was wetter than most past years, like its big flood years. That is a reason to prepare early, not a forecast.",
      "২০২৫ সালে সিন্ধু সমভূমির বর্ষা আগের বেশিরভাগ বছরের চেয়ে ভেজা ছিল, বড় বন্যার বছরগুলোর মতো। এটি আগেভাগে প্রস্তুতির কারণ, পূর্বাভাস নয়।",
    ],
  },
  {
    href: "/places/dhaka",
    title: ["A report for your city", "আপনার শহরের রিপোর্ট"],
    text: [
      "Each of 54 cities has a one-page climate report: how much warmer it got, how its rain changed, and which disasters happen nearby. Here is Dhaka.",
      "৫৪টি শহরের প্রতিটির এক পাতার জলবায়ু রিপোর্ট আছে: কতটা গরম বেড়েছে, বৃষ্টি কীভাবে বদলেছে, আর আশপাশে কোন দুর্যোগ ঘটে। এই যে ঢাকা।",
    ],
  },
  {
    href: "/findings",
    title: ["The whole story", "পুরো গল্প"],
    text: [
      "Our five main findings in plain words, with charts and how sure we are. That's the tour. Explore anything you like from the menu.",
      "আমাদের পাঁচটি মূল ফলাফল সহজ ভাষায়, চার্টসহ, আর আমরা কতটা নিশ্চিত তা-ও। ট্যুর শেষ। মেনু থেকে যা খুশি ঘুরে দেখুন।",
    ],
  },
];

// The current stop lives in session storage: map pages rewrite their own links, so the URL can't hold it.
const KEY = "tour-stop";
const listeners = new Set<() => void>();
function readStop(): number | null {
  // Guard against accessing sessionStorage during server-side rendering
  if (typeof window === 'undefined') return null;

  try {
    const v = sessionStorage.getItem(KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function writeStop(stop: number | null) {
  // Guard against accessing sessionStorage during server-side rendering
  if (typeof window === 'undefined') return;

  try {
    if (stop === null) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, String(stop));
  } catch {
    // Storage blocked: the tour still moves between pages, it just won't survive a reload.
  }
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** "Take the tour" button: starts at the first stop. */
export function StartTourButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        writeStop(0);
        router.push(STOPS[0].href);
      }}
      className={`inline-flex min-h-10 items-center gap-2 font-medium text-accent hover:underline ${className}`}
    >
      <Compass size={18} />
      <T en="Take the 2-minute tour" bn="২ মিনিটের ট্যুর দিন" />
    </button>
  );
}

/** The tour card, shown on every page while a tour is running. */
export function TourBar() {
  const stop = useSyncExternalStore(subscribe, readStop, () => null);
  const router = useRouter();
  const t = useT();
  if (stop === null || !STOPS[stop]) return null;
  const s = STOPS[stop];
  const last = stop === STOPS.length - 1;
  const go = (n: number) => {
    writeStop(n);
    router.push(STOPS[n].href);
  };

  return (
    <div
      role="dialog"
      aria-label={t("Guided tour", "গাইডেড ট্যুর")}
      className="fixed inset-x-3 top-[4.5rem] z-[1500] mx-auto max-w-xl rounded-2xl border border-line bg-card p-4 shadow-[0_12px_40px_rgb(0_0_0/0.18)] lg:bottom-6 lg:top-auto"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
          <Compass size={14} />
          <T en={`Tour · ${stop + 1} of ${STOPS.length}`} bn={`ট্যুর · ${bnNum(STOPS.length)}টির মধ্যে ${bnNum(stop + 1)}`} />
        </span>
        <button
          type="button"
          onClick={() => writeStop(null)}
          aria-label={t("End the tour", "ট্যুর শেষ করুন")}
          className="-m-2 grid h-10 w-10 place-items-center rounded-full text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-0.5 font-semibold text-ink">
        <T en={s.title[0]} bn={s.title[1]} />
      </div>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        <T en={s.text[0]} bn={s.text[1]} />
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex gap-1.5" aria-hidden>
          {STOPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === stop ? "w-5 bg-accent" : "w-1.5 bg-line"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {stop > 0 && (
            <button
              type="button"
              onClick={() => go(stop - 1)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            >
              <ArrowLeft size={15} />
              <T en="Back" bn="আগে" />
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? writeStop(null) : go(stop + 1))}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent-strong px-4 text-sm font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
          >
            {last ? <T en="Finish" bn="শেষ" /> : <T en="Next" bn="পরের" />}
            {!last && <ArrowRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
