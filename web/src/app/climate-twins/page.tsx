import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TwinExplorer from "@/components/twins/TwinExplorer";
import { Eyebrow } from "@/components/ui/primitive";
import { bnNum } from "@/lib/bn";
import { readData } from "@/lib/data";
import { T } from "@/lib/i18n";
import type { Block, TwinSeries, TwinsData } from "@/lib/twins";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Climate twins · Earth's Hidden Signals",
  description:
    "Places elsewhere on Earth whose 1981–2025 temperature and rainfall trends match South Asia's flood, landslide and wildfire regions, and the disasters they have recorded.",
};

export default async function ClimateTwinsPage() {
  const [data, series] = await Promise.all([
    readData<TwinsData>("twins", "twins.json"),
    readData<TwinSeries>("twins", "series.json"),
  ]);
  // The map needs only outlines; full details travel only for the blocks that are someone's twin.
  const mapBlocks = data.blocks.map(({ id, bbox, name }) => ({ id, bbox, name }));
  const wanted = new Set(data.regions.flatMap((r) => r.twins.map((t) => t.id)));
  const twinBlocks: Record<string, Block> = Object.fromEntries(data.blocks.filter((b) => wanted.has(b.id)).map((b) => [b.id, b]));
  const countries = new Set(Object.values(twinBlocks).flatMap((b) => b.countries));

  return (
    <div className="mx-auto w-full max-w-384 px-6 pb-24 pt-12 sm:px-8 lg:px-12">
      <header className="max-w-4xl">
        <Eyebrow en="Climate twins" bn="জলবায়ু যমজ" />
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          <T en="Who else on Earth is changing the same way?" bn="পৃথিবীতে আর কোথায় একইভাবে বদলাচ্ছে?" />
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          <T
            en={`Every South Asian hazard region has a climate trend fingerprint: how fast it warms, and how its rain is shifting. We searched ${data.blocks.length} blocks of land across the planet for the same fingerprint, then looked at the floods, landslides, cyclones and droughts those places have already recorded.`}
            bn={`দক্ষিণ এশিয়ার প্রতিটি দুর্যোগ-অঞ্চলের একটি জলবায়ু-প্রবণতার ছাপ আছে: কত দ্রুত উষ্ণ হচ্ছে, আর বৃষ্টি কীভাবে বদলাচ্ছে। আমরা পৃথিবীর ${bnNum(data.blocks.length)}টি স্থলখণ্ডে একই ছাপ খুঁজেছি, তারপর দেখেছি সেসব জায়গায় কী বন্যা, ভূমিধস, ঘূর্ণিঝড় ও খরা নথিভুক্ত হয়েছে।`}
          />
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-2 sm:max-w-xl">
          <Stat value={data.blocks.length} en="land blocks compared" bn="স্থলখণ্ড তুলনা" />
          <Stat value={countries.size} en="countries among the twins" bn="দেশ যমজদের মধ্যে" />
          <Stat value={`${data.years[1] - data.years[0] + 1}`} en="years of NASA records" bn="বছরের নাসা রেকর্ড" />
        </dl>
      </header>

      <section aria-label="Explorer" className="mt-10">
        <TwinExplorer
          regions={data.regions}
          twinBlocks={twinBlocks}
          mapBlocks={mapBlocks}
          series={series}
          years={data.years}
          eventYears={data.eventYears}
        />
      </section>

      <section className="mt-14 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg font-semibold text-ink">
            <T en="How a twin is found" bn="যমজ কীভাবে খোঁজা হয়" />
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
            <li>
              <T
                en={`The world's land is cut into ${data.block}° × ${data.block}° blocks (about 550 km), close to the size of our regions.`}
                bn={`পৃথিবীর স্থলভাগকে ${bnNum(data.block)}° × ${bnNum(data.block)}° খণ্ডে (প্রায় ৫৫০ কিমি) ভাগ করা হয়, আমাদের অঞ্চলগুলোর আকারের কাছাকাছি।`}
              />
            </li>
            <li>
              <T
                en="Each block and region gets the same tests as the rest of the site: NASA GISTEMP temperature and GPCP rainfall, Mann–Kendall significance and Sen's slope."
                bn="প্রতিটি খণ্ড ও অঞ্চলে সাইটের বাকি অংশের মতো একই পরীক্ষা: নাসার GISTEMP তাপমাত্রা ও GPCP বৃষ্টি, ম্যান–কেন্ডাল তাৎপর্য ও সেন-এর ঢাল।"
              />
            </li>
            <li>
              <T
                en="The fingerprint has five parts: warming rate, yearly and rainy-season rain trends (in % per decade), how wet the place is, and how much of its rain falls in one season. The last two stop a desert matching a delta just because both are flat."
                bn="ছাপের পাঁচটি অংশ: উষ্ণতার হার, বার্ষিক ও বর্ষা মৌসুমের বৃষ্টির প্রবণতা (প্রতি দশকে %), জায়গাটি কতটা ভেজা, আর বৃষ্টির কতটা এক মৌসুমে পড়ে। শেষ দুটি নিশ্চিত করে যে দুটোর প্রবণতা সমতল বলেই মরুভূমি ব-দ্বীপের সাথে মিলে যায় না।"
              />
            </li>
            <li>
              <T
                en="A nearest-neighbour search ranks every block by distance to the region's fingerprint. Twins must lie outside South Asia and at least 10° apart, so they are different places."
                bn="নিকটতম-প্রতিবেশী অনুসন্ধান প্রতিটি খণ্ডকে অঞ্চলের ছাপ থেকে দূরত্ব অনুযায়ী সাজায়। যমজকে দক্ষিণ এশিয়ার বাইরে এবং একে অপরের থেকে অন্তত ১০° দূরে হতে হয়।"
              />
            </li>
          </ol>
        </div>
        <div className="rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg font-semibold text-ink">
            <T en="What a twin does not mean" bn="যমজ মানে কী নয়" />
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
            <li>
              <T
                en="A shared trend, not a shared fate. Terrain, rivers, coasts, how many people live in harm's way and how well they are protected all change what a trend does."
                bn="প্রবণতা এক, ভাগ্য এক নয়। ভূপ্রকৃতি, নদী, উপকূল, কত মানুষ ঝুঁকিতে থাকে ও কতটা সুরক্ষিত, সবকিছুই প্রবণতার প্রভাব বদলায়।"
              />
            </li>
            <li>
              <T
                en="Disaster catalogues are uneven. GDACS alerts start in 2000; the NASA Global Landslide Catalog mostly covers 2007–2017 and depends on news reports, so poorer or remote places are under-counted."
                bn="দুর্যোগের তালিকা অসম। GDACS সতর্কতা ২০০০ থেকে; নাসার গ্লোবাল ল্যান্ডস্লাইড ক্যাটালগ মূলত ২০০৭–২০১৭ এবং সংবাদের ওপর নির্ভরশীল, তাই দরিদ্র বা প্রত্যন্ত জায়গা কম গোনা হয়।"
              />
            </li>
            <li>
              <T
                en="Not a forecast, and not proof that the trend caused those disasters. It is a way to find places whose experience is worth learning from."
                bn="পূর্বাভাস নয়, এবং প্রবণতাই ওই দুর্যোগ ঘটিয়েছে তার প্রমাণও নয়। এটি এমন জায়গা খোঁজার উপায় যাদের অভিজ্ঞতা থেকে শেখা যায়।"
              />
            </li>
            <li>
              <T
                en="We removed GDACS events whose map point lies far from the countries the record itself names (about 2.6% of them)."
                bn="যেসব GDACS ঘটনার মানচিত্র-বিন্দু রেকর্ডে উল্লিখিত দেশ থেকে অনেক দূরে, সেগুলো বাদ দেওয়া হয়েছে (প্রায় ২.৬%)।"
              />
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/climate-trends" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <T en="South Asia's trends in detail" bn="দক্ষিণ এশিয়ার প্রবণতা বিস্তারিত" />
              <ArrowRight size={14} aria-hidden />
            </Link>
            <Link href="/methods" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <T en="Full methods" bn="পুরো পদ্ধতি" />
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, en, bn }: { value: number | string; en: string; bn: string }) {
  return (
    <div className="flex flex-col-reverse rounded-2xl border border-line bg-card p-3">
      <dt className="text-xs text-ink-3">
        <T en={en} bn={bn} />
      </dt>
      <dd className="text-2xl font-semibold tabular-nums text-ink">
        <T en={String(value)} bn={bnNum(String(value))} />
      </dd>
    </div>
  );
}
