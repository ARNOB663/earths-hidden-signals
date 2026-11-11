import { ArrowRight, ChartLineUp, MapPin, MapTrifold, Warning } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { Reveal } from "@/components/home/Reveal";
import { WarmingStripes } from "@/components/home/WarmingStripes";
import { WorldTrendMap } from "@/components/home/WorldTrendMap";
import { StartTourButton } from "@/components/site/Tour";
import { bnNum } from "@/lib/bn";
import { readData, readManifest, readTrendZones } from "@/lib/data";
import { T } from "@/lib/i18n";
import { formatSigned, type Zone } from "@/lib/trends";

// The front page tells a global story in five short chapters (one idea, one number each), opened
// by warming stripes for Earth's land, then zooms into South Asia. Every number is read from the
// committed data, never typed in.

interface GlobalFuture {
  models: string[];
  future: [number, number];
  scenarios: Record<"ssp245" | "ssp585", { landWarming: { median: number; min: number; max: number }; hotEveryYearShare: number }>;
}

interface GlobalSummary {
  years: [number, number];
  landMean: { series: number[]; perDecade: number; total: number };
  temperature: { cells: number; increase: number; decrease: number };
  wetSeason: { cells: number; increase: number; decrease: number };
  events: { all: Record<string, number>; years: [number, number] };
}

const TOOLS: { href: string; Icon: Icon; title: [string, string]; text: [string, string] }[] = [
  { href: "/explore", Icon: MapTrifold, title: ["Satellite map", "স্যাটেলাইট মানচিত্র"], text: ["See it from space, month by month", "মহাকাশ থেকে দেখুন, মাসে মাসে"] },
  { href: "/trends", Icon: ChartLineUp, title: ["Climate trends", "জলবায়ুর প্রবণতা"], text: ["Is it really changing here?", "এখানে কি সত্যিই বদলাচ্ছে?"] },
  { href: "/hazards", Icon: Warning, title: ["Disaster risk", "দুর্যোগের ঝুঁকি"], text: ["Floods, landslides, fires, cyclones", "বন্যা, ভূমিধস, আগুন, ঘূর্ণিঝড়"] },
  { href: "/your-place", Icon: MapPin, title: ["Your place", "আপনার জায়গা"], text: ["Any town on Earth, past and future", "পৃথিবীর যেকোনো শহর, অতীত ও ভবিষ্যৎ"] },
];

export default async function Home() {
  const [manifest, trendZones, world, globalFuture] = await Promise.all([
    readManifest(),
    readTrendZones(),
    readData<GlobalSummary>("global", "summary.json"),
    readData<GlobalFuture>("global", "future.json"),
  ]);
  const years = manifest.years;
  const [first, last] = [years[0], years[years.length - 1]];
  const zone = (id: string) => trendZones.find((z) => z.id === id)!;

  // Chapters 1-3: the whole planet
  const landWarmer = formatSigned(world.landMean.total, 1);
  const tw = world.temperature;
  const ws = world.wetSeason;
  const ev = world.events.all;
  const fmt = (n: number) => n.toLocaleString("en-US");

  // Chapter 4: South Asia zoom-in
  const study = zone("study-area");
  const tTrend = study.results["temperature_annual"].trend!;
  const warmer = formatSigned((tTrend.slopePerDecade * (last - first)) / 10, 1);

  // Chapter 2: rain moving
  const rainPct = (z: Zone) => {
    const r = z.results["rainfall_monsoon"];
    return (r.trend!.slopePerDecade / r.mean) * 100;
  };
  const indus = rainPct(zone("indus-plain"));
  const delta = rainPct(zone("bengal-delta"));

  // Chapter 5: NASA projections for Earth's land, middle-road pathway
  const gf = globalFuture.scenarios.ssp245;
  const moreWarming = formatSigned(gf.landWarming.median, 1);
  const hotShare = Math.round(gf.hotEveryYearShare * 100);
  const span = globalFuture.future;

  return (
    <div className="pb-24">
      {/* Hero: one line, one action */}
      <section className="mx-auto w-full max-w-[1200px] px-4 pb-12 pt-14 sm:px-6 lg:pt-20">
        <p className="text-sm font-medium text-accent">NASA Space Apps Challenge 2026</p>
        <h1 className="mt-3 max-w-[16ch] text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
          <T en="Earth's climate is changing. Here is the evidence." bn="পৃথিবীর জলবায়ু বদলাচ্ছে। এই তার প্রমাণ।" />
        </h1>
        <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-ink-2">
          <T
            en={`${years.length} years of NASA data for every land area on Earth, told as one short story.`}
            bn={`পৃথিবীর প্রতিটি স্থলভাগের জন্য নাসার ${bnNum(years.length)} বছরের তথ্য, একটি ছোট গল্পে।`}
          />
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <a
            href="#story"
            className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-6 py-3 font-medium text-accent-ink transition hover:bg-accent-hover active:scale-[0.98]"
          >
            <T en="Start the story" bn="গল্প শুরু করুন" /> <ArrowRight size={18} />
          </a>
          <StartTourButton />
        </div>
      </section>

      {/* Warming stripes */}
      <section aria-labelledby="stripes" className="w-full">
        <div className="h-36 w-full sm:h-48">
          <WarmingStripes
            values={world.landMean.series}
            label={`Temperature of Earth's land, one stripe per year from ${first} to ${last}: blue years were cooler, red years warmer.`}
          />
        </div>
        <div className="mx-auto flex w-full max-w-[1200px] items-baseline justify-between gap-4 px-4 pt-3 text-sm text-ink-2 sm:px-6">
          <span className="tabular-nums">{first}</span>
          <h2 id="stripes" className="text-center">
            <T en="Each stripe is one year of Earth's land temperature." bn="প্রতিটি দাগ পৃথিবীর স্থলভাগের এক বছরের তাপমাত্রা।" />
          </h2>
          <span className="tabular-nums">{last}</span>
        </div>
      </section>

      {/* The story: four chapters, one idea each */}
      <div id="story" className="mx-auto mt-20 w-full max-w-[1000px] scroll-mt-20 space-y-24 px-4 sm:mt-28 sm:space-y-32 sm:px-6">
        <Chapter
          n={1}
          title={<T en="Hotter almost everywhere" bn="প্রায় সবখানে গরম বাড়ছে" />}
          big={<T en={`${landWarmer} °C`} bn={`${bnNum(landWarmer)} °সে`} />}
          line={
            <T
              en={`on Earth's land since ${first}. ${fmt(tw.increase)} of ${fmt(tw.cells)} land areas clearly warmed; only ${tw.decrease} cooled.`}
              bn={`${bnNum(first)} থেকে পৃথিবীর স্থলভাগে। ${bnNum(fmt(tw.cells))}টি স্থল-এলাকার ${bnNum(fmt(tw.increase))}টি স্পষ্টভাবে উষ্ণ হয়েছে; মাত্র ${bnNum(tw.decrease)}টি শীতল।`}
            />
          }
          href="/trends"
          visual={<WorldTrendMap file="temperature" limit={0.6} increaseIsRed label="World map of temperature trends since 1981: almost all land is red (warming)." />}
        />

        <Chapter
          n={2}
          title={<T en="The rain is moving" bn="বৃষ্টি জায়গা বদলাচ্ছে" />}
          big={<T en="Wetter here, drier there" bn="কোথাও ভেজা, কোথাও শুষ্ক" />}
          line={
            <T
              en={`The same warming pushes rain both ways: ${ws.increase} land areas got a clearly wetter rainy season, ${ws.decrease} a clearly drier one.`}
              bn={`একই উষ্ণতা বৃষ্টিকে দুই দিকে ঠেলে: ${bnNum(ws.increase)}টি স্থল-এলাকার বর্ষা স্পষ্টভাবে ভেজা হয়েছে, ${bnNum(ws.decrease)}টির স্পষ্টভাবে শুষ্ক।`}
            />
          }
          href="/trends"
          visual={
            <div>
              <WorldTrendMap file="wet-season" limit={10} increaseIsRed={false} label="World map of rainy-season rain trends: blue got wetter, red got drier." />
              <p className="mt-2 text-xs text-ink-3">
                <T en="Blue: wetter · Red: drier · Faded: no clear change" bn="নীল: ভেজা · লাল: শুষ্ক · হালকা: স্পষ্ট পরিবর্তন নেই" />
              </p>
            </div>
          }
        />

        <Chapter
          n={3}
          title={<T en="Disasters everywhere" bn="সবখানে দুর্যোগ" />}
          big={<T en={`${fmt(ev.flood + ev.cyclone + ev.drought)} alerts`} bn={`${bnNum(fmt(ev.flood + ev.cyclone + ev.drought))}টি সতর্কতা`} />}
          line={
            <T
              en={`for floods, cyclones and droughts worldwide since ${world.events.years[0]}, plus ${fmt(ev.landslide)} catalogued landslides. We map them against the climate.`}
              bn={`${bnNum(world.events.years[0])} থেকে সারা বিশ্বে বন্যা, ঘূর্ণিঝড় ও খরার, সাথে ${bnNum(fmt(ev.landslide))}টি নথিভুক্ত ভূমিধস। আমরা এগুলো জলবায়ুর সাথে মানচিত্রে মেলাই।`}
            />
          }
          href="/hazards"
          visual={
            <dl className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
              <Count value={ev.flood} label={<T en="flood alerts" bn="বন্যা সতর্কতা" />} />
              <Count value={ev.cyclone} label={<T en="cyclones" bn="ঘূর্ণিঝড়" />} />
              <Count value={ev.drought} label={<T en="droughts" bn="খরা" />} />
              <Count value={ev.landslide} label={<T en="landslides" bn="ভূমিধস" />} />
            </dl>
          }
        />

        <Chapter
          n={4}
          title={<T en="Zoom in: South Asia" bn="কাছ থেকে: দক্ষিণ এশিয়া" />}
          big={<T en={`${warmer} °C`} bn={`${bnNum(warmer)} °সে`} />}
          line={
            <T
              en="warmer since 1981, where nearly two billion people live with the monsoon. Here the rain splits: the dry Indus plain gets more, the Bengal delta gets less."
              bn="বেশি গরম ১৯৮১ থেকে, যেখানে প্রায় দুইশো কোটি মানুষ বর্ষার ওপর নির্ভর করে। এখানে বৃষ্টি ভাগ হচ্ছে: শুকনো সিন্ধু সমভূমি বেশি পায়, বাংলার ব-দ্বীপ কম।"
            />
          }
          href="/trends?var=rainfall&season=monsoon"
          visual={
            <div className="space-y-4">
              <RainBar label={<T en="Indus plain" bn="সিন্ধু সমভূমি" />} pct={indus} />
              <RainBar label={<T en="Bengal delta" bn="বাংলার ব-দ্বীপ" />} pct={delta} />
              <p className="text-xs text-ink-3">
                <T en="Monsoon rain, change every 10 years" bn="বর্ষার বৃষ্টি, প্রতি ১০ বছরে পরিবর্তন" />
              </p>
            </div>
          }
        />

        <Chapter
          n={5}
          title={<T en="What comes next" bn="এরপর কী" />}
          big={<T en={`${moreWarming} °C more`} bn={`আরও ${bnNum(moreWarming)} °সে`} />}
          line={
            <T
              en={`on Earth's land by ${span[0]}–${span[1]} on a middle-road path, say NASA's climate projections. On ${hotShare}% of land, today's 1-in-10 hottest year would come almost every year.`}
              bn={`${bnNum(span[0])}–${bnNum(span[1])} সালের মধ্যে পৃথিবীর স্থলভাগে, মাঝামাঝি পথে, বলছে নাসার জলবায়ু অনুমান। ${bnNum(hotShare)}% স্থলভাগে আজকের ১০ বছরে ১ বারের সবচেয়ে গরম বছর আসবে প্রায় প্রতি বছর।`}
            />
          }
          href="/hazards"
          visual={
            <div>
              <WorldTrendMap file="future" limit={20} increaseIsRed={false} label="World map of projected rainy-season change by 2041-2060: blue wetter, red drier, faded where the models disagree." />
              <p className="mt-2 text-xs text-ink-3">
                <T
                  en={`Rainy season by ${span[0]}–${span[1]}: blue wetter, red drier, faded where the ${globalFuture.models.length} models disagree.`}
                  bn={`${bnNum(span[0])}–${bnNum(span[1])} সালের বর্ষা: নীল ভেজা, লাল শুষ্ক, হালকা যেখানে ${bnNum(globalFuture.models.length)}টি মডেল একমত নয়।`}
                />
              </p>
            </div>
          }
        />
      </div>

      {/* Explore it yourself */}
      <section aria-labelledby="explore-hdg" className="mx-auto mt-28 w-full max-w-[1200px] px-4 sm:px-6">
        <h2 id="explore-hdg" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="Explore it yourself" bn="নিজে দেখুন" />
        </h2>
        <form action="/your-place" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
          <label htmlFor="home-place" className="sr-only">
            <T en="Town or city" bn="শহর বা এলাকা" />
          </label>
          <input
            id="home-place"
            name="q"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Any town on Earth, e.g. Nairobi…"
            className="min-h-12 flex-1 rounded-full border border-line bg-card px-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <button type="submit" className="min-h-12 rounded-full bg-accent-strong px-6 font-medium text-accent-ink transition-colors hover:bg-accent-hover">
            <T en="Find your place" bn="আপনার জায়গা খুঁজুন" />
          </button>
        </form>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map(({ href, Icon, title, text }) => (
            <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft transition-transform hover:-translate-y-0.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon size={20} weight="duotone" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">
                  <T en={title[0]} bn={title[1]} />
                </span>
                <span className="block text-sm text-ink-2">
                  <T en={text[0]} bn={text[1]} />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Chapter({
  n,
  title,
  big,
  line,
  href,
  visual,
}: {
  n: number;
  title: React.ReactNode;
  big: React.ReactNode;
  line: React.ReactNode;
  href: string;
  visual: React.ReactNode;
}) {
  return (
    <Reveal>
      <section className={`grid items-center gap-8 md:grid-cols-2 md:gap-14 ${n % 2 === 0 ? "md:[&>*:first-child]:order-2" : ""}`}>
        <div>
          <p className="text-sm font-medium text-accent tabular-nums">
            <T en={`Chapter ${n}`} bn={`অধ্যায় ${bnNum(n)}`} />
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h2>
          <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums text-ink sm:text-5xl">{big}</p>
          <p className="mt-3 max-w-[42ch] text-lg leading-relaxed text-ink-2">{line}</p>
          <Link href={href} className="mt-4 inline-flex min-h-10 items-center gap-1.5 font-medium text-accent hover:underline">
            <T en="See it" bn="দেখুন" /> <ArrowRight size={16} />
          </Link>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-soft">{visual}</div>
      </section>
    </Reveal>
  );
}

function RainBar({ label, pct }: { label: React.ReactNode; pct: number }) {
  const width = Math.min(50, (Math.abs(pct) / 6) * 50);
  const wetter = pct > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="font-semibold tabular-nums text-ink">
          <T en={`${formatSigned(pct, 1)}%`} bn={`${bnNum(formatSigned(pct, 1))}%`} />
        </span>
      </div>
      <div className="relative mt-1.5 h-3 rounded-full bg-sunken">
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-ink-3" />
        <span
          aria-hidden
          className="absolute inset-y-0 rounded-full"
          style={{
            background: wetter ? "var(--cool-3)" : "var(--warm-3)",
            left: wetter ? "50%" : `${50 - width}%`,
            width: `${width}%`,
          }}
        />
      </div>
    </div>
  );
}

function Count({ value, label }: { value: number; label: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums text-ink">
        <T en={value.toLocaleString("en-US")} bn={bnNum(value.toLocaleString("en-US"))} />
      </dd>
    </div>
  );
}
