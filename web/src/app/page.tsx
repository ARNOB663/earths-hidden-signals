import { ArrowRight, ChartLineUp, MapPin, MapTrifold, Warning } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { Sparkline } from "@/components/findings/parts";
import { Reveal } from "@/components/home/Reveal";
import { WarmingStripes } from "@/components/home/WarmingStripes";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { StartTourButton } from "@/components/site/Tour";
import { bnNum } from "@/lib/bn";
import { readHazardZones, readManifest, readOutlook, readTrendZones } from "@/lib/data";
import { T } from "@/lib/i18n";
import { formatSigned, type Zone } from "@/lib/trends";

// The front page tells the story in four short chapters (one idea, one number each), opened by
// warming stripes. Every number is read from the committed data, never typed in.

const TOOLS: { href: string; Icon: Icon; title: [string, string]; text: [string, string] }[] = [
  { href: "/explore", Icon: MapTrifold, title: ["Satellite map", "স্যাটেলাইট মানচিত্র"], text: ["See it from space, month by month", "মহাকাশ থেকে দেখুন, মাসে মাসে"] },
  { href: "/trends", Icon: ChartLineUp, title: ["Climate trends", "জলবায়ুর প্রবণতা"], text: ["Is it really changing here?", "এখানে কি সত্যিই বদলাচ্ছে?"] },
  { href: "/hazards", Icon: Warning, title: ["Disaster risk", "দুর্যোগের ঝুঁকি"], text: ["Floods, landslides, fires, cyclones", "বন্যা, ভূমিধস, আগুন, ঘূর্ণিঝড়"] },
  { href: "/places", Icon: MapPin, title: ["Your city", "আপনার শহর"], text: ["A one-page climate report", "এক পাতার জলবায়ু রিপোর্ট"] },
];

export default async function Home() {
  const [manifest, trendZones, hazardZones, outlook] = await Promise.all([
    readManifest(),
    readTrendZones(),
    readHazardZones(),
    readOutlook(),
  ]);
  const years = manifest.years;
  const [first, last] = [years[0], years[years.length - 1]];
  const zone = (id: string) => trendZones.find((z) => z.id === id)!;

  // Chapter 1: heat
  const study = zone("study-area");
  const tTrend = study.results["temperature_annual"].trend!;
  const tSeries = study.results["temperature_annual"].series as number[];
  const warmer = formatSigned((tTrend.slopePerDecade * (last - first)) / 10, 1);
  const temp = manifest.summaries["temperature_annual"];

  // Chapter 2: rain moving
  const rainPct = (z: Zone) => {
    const r = z.results["rainfall_monsoon"];
    return (r.trend!.slopePerDecade / r.mean) * 100;
  };
  const indus = rainPct(zone("indus-plain"));
  const delta = rainPct(zone("bengal-delta"));

  // Chapter 3: disasters recorded in the hazard regions
  const events = (h: string) => hazardZones.filter((z) => z.hazard === h).reduce((s, z) => s + z.counts.reduce((a, b) => a + b, 0), 0);
  const floods = events("flood");
  const landslides = events("landslide");
  const cyclones = events("cyclone");

  // Chapter 4: NASA projections, middle-road pathway
  const future = outlook.regions.find((r) => r.id === "study-area")!.scenarios.ssp245;
  const moreWarming = formatSigned(future.metrics.tMean.median, 1);
  const hotYears = Math.round(future.exceedance.hotYear.median * 10);

  return (
    <div className="pb-24">
      {/* Hero: one line, one action */}
      <section className="mx-auto w-full max-w-[1200px] px-4 pb-12 pt-14 sm:px-6 lg:pt-20">
        <p className="text-sm font-medium text-accent">NASA Space Apps Challenge 2026</p>
        <h1 className="mt-3 max-w-[16ch] text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
          <T en="South Asia's climate is changing. Here is the evidence." bn="দক্ষিণ এশিয়ার জলবায়ু বদলাচ্ছে। এই তার প্রমাণ।" />
        </h1>
        <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-ink-2">
          <T
            en={`${years.length} years of NASA satellite data, told as one short story.`}
            bn={`নাসার ${bnNum(years.length)} বছরের স্যাটেলাইট তথ্য, একটি ছোট গল্পে।`}
          />
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <a
            href="#story"
            className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-6 py-3 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
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
            values={tSeries}
            label={`South Asia temperature, one stripe per year from ${first} to ${last}: blue years were cooler, red years warmer.`}
          />
        </div>
        <div className="mx-auto flex w-full max-w-[1200px] items-baseline justify-between gap-4 px-4 pt-3 text-sm text-ink-2 sm:px-6">
          <span className="tabular-nums">{first}</span>
          <h2 id="stripes" className="text-center">
            <T en="Each stripe is one year of South Asia's temperature." bn="প্রতিটি দাগ দক্ষিণ এশিয়ার এক বছরের তাপমাত্রা।" />
          </h2>
          <span className="tabular-nums">{last}</span>
        </div>
      </section>

      {/* The story: four chapters, one idea each */}
      <div id="story" className="mx-auto mt-20 w-full max-w-[1000px] scroll-mt-20 space-y-24 px-4 sm:mt-28 sm:space-y-32 sm:px-6">
        <Chapter
          n={1}
          title={<T en="It is getting hotter" bn="গরম বাড়ছে" />}
          big={<T en={`${warmer} °C`} bn={`${bnNum(warmer)} °সে`} />}
          line={
            <T
              en={`since ${first}. All ${temp.cells} squares of our map got warmer. Not one got cooler.`}
              bn={`${bnNum(first)} থেকে। আমাদের মানচিত্রের ${bnNum(temp.cells)}টি বর্গের সবগুলোই উষ্ণ হয়েছে। একটিও ঠান্ডা হয়নি।`}
            />
          }
          href="/trends?var=temperature&season=annual&zone=study-area"
          visual={
            <div>
              <Sparkline values={tSeries} color="var(--warm-3)" />
              <div className="mt-1 flex justify-between text-xs text-ink-3">
                <span>{first}</span>
                <span>{last}</span>
              </div>
            </div>
          }
        />

        <Chapter
          n={2}
          title={<T en="The rain is moving" bn="বৃষ্টি জায়গা বদলাচ্ছে" />}
          big={<T en="Wetter here, drier there" bn="কোথাও ভেজা, কোথাও শুষ্ক" />}
          line={
            <T
              en="The same warming brings more monsoon rain to the dry Indus plain and less to the Bengal delta."
              bn="একই উষ্ণতা শুকনো সিন্ধু সমভূমিতে বর্ষার বৃষ্টি বাড়ায়, আর বাংলার ব-দ্বীপে কমায়।"
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
          n={3}
          title={<T en="Disasters follow" bn="দুর্যোগ পিছু নেয়" />}
          big={<T en={`${(floods + landslides + cyclones).toLocaleString("en-US")} events`} bn={`${bnNum((floods + landslides + cyclones).toLocaleString("en-US"))}টি ঘটনা`} />}
          line={
            <T
              en="recorded in the regions where heat and rain are shifting most. We map each one against the climate."
              bn="নথিভুক্ত হয়েছে সেই অঞ্চলগুলোতে, যেখানে তাপ ও বৃষ্টি সবচেয়ে বেশি বদলাচ্ছে। প্রতিটি আমরা জলবায়ুর সাথে মানচিত্রে মেলাই।"
            />
          }
          href="/hazards"
          visual={
            <dl className="grid grid-cols-3 gap-3 text-center">
              <Count value={floods} label={<T en="flood alerts" bn="বন্যা সতর্কতা" />} />
              <Count value={landslides} label={<T en="landslides" bn="ভূমিধস" />} />
              <Count value={cyclones} label={<T en="cyclones" bn="ঘূর্ণিঝড়" />} />
            </dl>
          }
        />

        <Chapter
          n={4}
          title={<T en="What comes next" bn="এরপর কী" />}
          big={<T en={`${moreWarming} °C more`} bn={`আরও ${bnNum(moreWarming)} °সে`} />}
          line={
            <T
              en={`by ${outlook.future[0]}–${outlook.future[1]} on a middle-road path, say NASA's climate projections. Today's 1-in-10 hottest year would come ${hotYears >= 10 ? "almost every year" : `${hotYears} years in 10`}.`}
              bn={`${bnNum(outlook.future[0])}–${bnNum(outlook.future[1])} সালের মধ্যে, মাঝামাঝি পথে, বলছে নাসার জলবায়ু অনুমান। আজকের ১০ বছরে ১ বারের সবচেয়ে গরম বছর আসবে ${hotYears >= 10 ? "প্রায় প্রতি বছর" : `১০ বছরে ${bnNum(hotYears)} বার`}।`}
            />
          }
          href="/hazards#future"
          visual={
            <div className="space-y-3 text-sm">
              <DotRow label={<T en="Today" bn="আজ" />} filled={1} />
              <DotRow label={<T en={`${outlook.future[0]}–${String(outlook.future[1]).slice(2)}`} bn={`${bnNum(outlook.future[0])}–${bnNum(String(outlook.future[1]).slice(2))}`} />} filled={Math.min(10, hotYears)} strong />
              <p className="text-xs text-ink-3">
                <T en="Very hot years, out of 10" bn="অতি গরম বছর, ১০টির মধ্যে" />
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
        <div className="mt-6 max-w-xl">
          <PlaceSearch />
        </div>
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

function DotRow({ label, filled, strong }: { label: React.ReactNode; filled: number; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-ink-2">{label}</span>
      <span aria-hidden className="flex gap-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < filled ? (strong ? "bg-[var(--warm-3)]" : "bg-ink-2") : "border border-line bg-sunken"}`} />
        ))}
      </span>
      <span className="sr-only">{filled} of 10</span>
    </div>
  );
}
