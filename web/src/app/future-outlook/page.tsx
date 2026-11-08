import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import FutureExplorer, { type ObservedTrends } from "@/components/future/FutureExplorer";
import { RiskScorecard, type RiskModel } from "@/components/future/RiskScorecard";
import { Eyebrow } from "@/components/ui/primitive";
import { bnNum } from "@/lib/bn";
import { readData, readTrendZones } from "@/lib/data";
import type { Outlook } from "@/lib/future";
import { T } from "@/lib/i18n";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Future outlook · Earth's Hidden Signals",
  description:
    "What NASA's downscaled climate projections (NEX-GDDP-CMIP6) say about South Asia's flood, landslide and wildfire regions in 2041–2060: how often today's rare wet, dry and hot years would happen, with model agreement.",
};

export default async function FutureOutlookPage() {
  const [outlook, zones, risk] = await Promise.all([
    readData<Outlook>("future", "outlook.json"),
    readTrendZones(),
    readData<RiskModel>("risk", "model.json"),
  ]);
  const observed: Record<string, ObservedTrends> = Object.fromEntries(
    zones.map((z) => [
      z.id,
      {
        temperature: z.results["temperature_annual"]?.trend ?? null,
        monsoon: z.results["rainfall_monsoon"]?.trend ?? null,
        monsoonMean: z.results["rainfall_monsoon"]?.mean ?? null,
      },
    ]),
  );
  const n = outlook.models.length;
  const iitm = outlook.models.includes("IITM-ESM");

  return (
    <div className="mx-auto w-full max-w-384 px-6 pb-24 pt-12 sm:px-8 lg:px-12">
      <header className="max-w-4xl">
        <Eyebrow en="Future outlook" bn="ভবিষ্যতের চিত্র" />
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          <T
            en={`What NASA's climate projections say about ${outlook.future[0]}–${outlook.future[1]}`}
            bn={`${bnNum(outlook.future[0])}–${bnNum(outlook.future[1])} নিয়ে নাসার জলবায়ু অনুমান কী বলে`}
          />
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          <T
            en={`Trends tell us where South Asia has been heading. For where it could go, we use NASA's own downscaled climate projections, from ${n} independent climate models. We do not invent a forecast: every number is a model compared with itself, and we show where the models disagree.`}
            bn={`প্রবণতা বলে দক্ষিণ এশিয়া কোন দিকে যাচ্ছিল। কোথায় যেতে পারে তা জানতে আমরা নাসার নিজস্ব ডাউনস্কেল করা জলবায়ু অনুমান ব্যবহার করি, ${bnNum(n)}টি স্বাধীন জলবায়ু মডেল থেকে। আমরা কোনো পূর্বাভাস বানাই না: প্রতিটি সংখ্যা মডেলের নিজের সাথে তুলনা, আর মডেলগুলো কোথায় একমত নয় তা-ও দেখাই।`}
          />
        </p>
      </header>

      <section aria-label="Explorer" className="mt-10">
        <FutureExplorer outlook={outlook} observed={observed} />
      </section>

      <RiskScorecard model={risk} />

      <section className="mt-14 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg font-semibold text-ink">
            <T en="Where these numbers come from" bn="এই সংখ্যাগুলো কোথা থেকে" />
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
            <li>
              <T
                en="NASA Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6): daily temperature and rain from CMIP6 climate models, bias-corrected against observations and downscaled to 0.25°. We use it at 1°."
                bn="নাসা আর্থ এক্সচেঞ্জ গ্লোবাল ডেইলি ডাউনস্কেলড প্রজেকশনস (NEX-GDDP-CMIP6): CMIP6 জলবায়ু মডেলের দৈনিক তাপমাত্রা ও বৃষ্টি, পর্যবেক্ষণের সাথে সংশোধিত ও ০.২৫°-এ ডাউনস্কেল করা। আমরা ১°-এ ব্যবহার করি।"
              />
            </li>
            <li>
              <T
                en={`Models: ${outlook.models.join(", ")}. Chosen from different modelling centres${iitm ? " (including India's IITM)" : ""}, so the spread is honest.`}
                bn={`মডেল: ${outlook.models.join(", ")}। বিভিন্ন মডেলিং কেন্দ্র থেকে বাছাই${iitm ? " (ভারতের IITM সহ)" : ""}, যাতে মতভেদ সৎভাবে দেখা যায়।`}
              />
            </li>
            <li>
              <T
                en="Each model is compared only with its own 1995–2014 run, so a model that is too wet or too hot everywhere does not distort the change."
                bn="প্রতিটি মডেলকে কেবল তার নিজের ১৯৯৫–২০১৪ সালের সাথে তুলনা করা হয়, তাই সবখানে বেশি ভেজা বা গরম মডেল পরিবর্তনকে বিকৃত করে না।"
              />
            </li>
            <li>
              <T
                en="Very heavy rain days are counted against each grid square's own 95th percentile of rainy days in 1995–2014; unusually hot days against the 95th percentile of the same calendar month."
                bn="অতি ভারী বৃষ্টির দিন প্রতিটি গ্রিড-বর্গের ১৯৯৫–২০১৪ সালের বৃষ্টির দিনের ৯৫তম শতকাংশের সাথে গোনা হয়; অস্বাভাবিক গরম দিন একই মাসের ৯৫তম শতকাংশের সাথে।"
              />
            </li>
          </ul>
          <a
            href={outlook.datasetUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            NEX-GDDP-CMIP6 · NASA NCCS
            <ArrowRight size={14} aria-hidden />
          </a>
        </div>
        <div className="rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg font-semibold text-ink">
            <T en="How to read it" bn="কীভাবে পড়বেন" />
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
            <li>
              <T
                en="A projection, not a forecast. It says how often kinds of years would happen over two decades, not what any single year will bring."
                bn="অনুমান, পূর্বাভাস নয়। এটি বলে দুই দশকে কোন ধরনের বছর কত ঘন ঘন হবে, কোনো একটি বছরে কী হবে তা নয়।"
              />
            </li>
            <li>
              <T
                en="The pathway matters. The gap between “middle road” and “high emissions” is the part of the future that choices still decide."
                bn="পথ গুরুত্বপূর্ণ। “মাঝামাঝি পথ” ও “উচ্চ নিঃসরণ”-এর পার্থক্যটাই ভবিষ্যতের সেই অংশ যা এখনো সিদ্ধান্তের ওপর নির্ভর করে।"
              />
            </li>
            <li>
              <T
                en="Rain projections are less certain than heat. Count how many models agree before trusting a direction."
                bn="তাপের চেয়ে বৃষ্টির অনুমান কম নিশ্চিত। কোনো দিকে ভরসা করার আগে কতগুলো মডেল একমত তা দেখুন।"
              />
            </li>
            <li>
              <T
                en="Unusually hot days rise steeply because day-to-day temperatures in the tropics vary little: a 2 °C shift turns today's hottest 5% of days into ordinary ones. That is the warning in the number, not an error."
                bn="অস্বাভাবিক গরম দিন খুব দ্রুত বাড়ে, কারণ গ্রীষ্মমণ্ডলে দিন-দিন তাপমাত্রা কম ওঠানামা করে: ২ °সে বাড়লেই আজকের সবচেয়ে গরম ৫% দিন সাধারণ হয়ে যায়। সংখ্যাটির মধ্যেই সতর্কবার্তা, এটি ভুল নয়।"
              />
            </li>
            <li>
              <T
                en="1° squares (about 110 km) average out local storms; real local extremes can be sharper."
                bn="১° বর্গ (প্রায় ১১০ কিমি) স্থানীয় ঝড়কে গড় করে ফেলে; বাস্তবের স্থানীয় চরম ঘটনা আরও তীব্র হতে পারে।"
              />
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/climate-trends" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <T en="Past trends, 1981–2025" bn="অতীতের প্রবণতা, ১৯৮১–২০২৫" />
              <ArrowRight size={14} aria-hidden />
            </Link>
            <Link href="/climate-twins" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <T en="Climate twins" bn="জলবায়ু যমজ" />
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
