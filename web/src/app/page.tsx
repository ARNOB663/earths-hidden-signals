import {
  ArrowRight,
  BookOpen,
  ChartLineUp,
  CloudRain,
  DeviceMobile,
  DownloadSimple,
  Flask,
  LinkSimple,
  MapPin,
  MapTrifold,
  MoonStars,
  Planet,
  Thermometer,
  Translate,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { Sparkline } from "@/components/findings/parts";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { StartTourButton } from "@/components/site/Tour";
import { bnMonth, bnNum } from "@/lib/bn";
import { readHazardZones, readLatest, readManifest, readTrendZones } from "@/lib/data";
import { preparednessSignal } from "@/lib/hazards";
import { T } from "@/lib/i18n";
import { zoneNameBn } from "@/lib/names";
import { buildPlaceReport } from "@/lib/placeReport";
import { placeById, PLACES } from "@/lib/places";
import { formatSigned, type Zone } from "@/lib/trends";

interface Tool {
  href: string;
  Icon: Icon;
  question: [string, string];
  title: [string, string];
  text: [string, string];
  /** Screenshot in public/features, one per theme; omitted when the card draws a live preview. */
  shot?: { name: string; alt: string };
  /** "Try this" links that open the tool on an interesting view. */
  tries: { href: string; label: [string, string] }[];
}

const TOOLS: Tool[] = [
  {
    href: "/explore",
    Icon: MapTrifold,
    question: ["What does space see?", "মহাকাশ থেকে কী দেখা যায়?"],
    title: ["Satellite map", "স্যাটেলাইট মানচিত্র"],
    text: [
      "NASA satellite images of heat, rain, greenness and forest loss, month by month since 2000. Slide between two years to compare them.",
      "২০০০ সাল থেকে মাসে মাসে তাপ, বৃষ্টি, সবুজের পরিমাণ ও বন উজাড়ের নাসার স্যাটেলাইট ছবি। দুই বছর পাশাপাশি রেখে তুলনা করুন।",
    ],
    shot: { name: "explore", alt: "Satellite map of ground heat over South Asia in May 2024" },
    tries: [
      { href: "/explore?layer=lst-day&date=2024-05-01&compare=2001&view=diff", label: ["May heat: 2024 vs 2001", "মে মাসের তাপ: ২০২৪ বনাম ২০০১"] },
      { href: "/explore?layer=forest-loss", label: ["Forest loss since 2001", "২০০১ থেকে বন উজাড়"] },
    ],
  },
  {
    href: "/trends",
    Icon: ChartLineUp,
    question: ["Is it really changing here?", "এখানে কি সত্যিই বদলাচ্ছে?"],
    title: ["Climate trends", "জলবায়ুর প্রবণতা"],
    text: [
      "Click any square of South Asia to see whether heat, rain, very hot months or dry spells are rising, by how much, and how sure we are.",
      "দক্ষিণ এশিয়ার যেকোনো বর্গে ক্লিক করে দেখুন তাপ, বৃষ্টি, খুব গরম মাস বা টানা শুকনো দিন বাড়ছে কি না, কতটা, আর আমরা কতটা নিশ্চিত।",
    ],
    shot: { name: "trends", alt: "Map of squares showing where monsoon rain is rising (blue) and falling (red)" },
    tries: [
      { href: "/trends?var=rainfall&season=monsoon", label: ["Where monsoon rain is moving", "বর্ষার বৃষ্টি কোথায় সরছে"] },
      { href: "/trends?var=hot-months&season=annual", label: ["Very hot months", "খুব গরম মাস"] },
    ],
  },
  {
    href: "/hazards",
    Icon: Warning,
    question: ["Should we get ready?", "প্রস্তুতি কি দরকার?"],
    title: ["Disaster risk", "দুর্যোগের ঝুঁকি"],
    text: [
      "Past floods, landslides, fires and cyclones on the map, whether the weather explains them, and which regions look like past disaster years.",
      "মানচিত্রে আগের বন্যা, ভূমিধস, আগুন ও ঘূর্ণিঝড়; আবহাওয়া এগুলো ব্যাখ্যা করে কি না; আর কোন অঞ্চল আগের দুর্যোগের বছরের মতো দেখাচ্ছে।",
    ],
    shot: { name: "hazards", alt: "Cyclone tracks crossing the Bay of Bengal since 1981" },
    tries: [
      { href: "/hazards?hazard=cyclone&zone=bay-of-bengal", label: ["Bay of Bengal cyclones", "বঙ্গোপসাগরের ঘূর্ণিঝড়"] },
      { href: "/hazards?hazard=flood&zone=indus-plain", label: ["This year's flood signal", "এ বছরের বন্যা সংকেত"] },
    ],
  },
  {
    href: "/places",
    Icon: MapPin,
    question: ["What about my city?", "আমার শহরের কী অবস্থা?"],
    title: ["Place reports", "শহরের রিপোর্ট"],
    text: [
      `A one-page climate report for each of ${PLACES.length} cities: how much warmer it got, how the rain changed, and which disasters happen nearby.`,
      `${bnNum(PLACES.length)}টি শহরের প্রতিটির জন্য এক পাতার জলবায়ু রিপোর্ট: কতটা গরম বেড়েছে, বৃষ্টি কীভাবে বদলেছে, আর আশপাশে কোন দুর্যোগ ঘটে।`,
    ],
    tries: [
      { href: "/places/dhaka", label: ["Dhaka", "ঢাকা"] },
      { href: "/places/kathmandu", label: ["Kathmandu", "কাঠমান্ডু"] },
      { href: "/places", label: ["All cities", "সব শহর"] },
    ],
  },
];

const EXTRAS: { Icon: Icon; label: [string, string] }[] = [
  { Icon: Translate, label: ["বাংলা or English", "বাংলা বা English"] },
  { Icon: MoonStars, label: ["Light and dark mode", "আলো ও অন্ধকার মোড"] },
  { Icon: DownloadSimple, label: ["Download the data behind any chart", "যেকোনো চার্টের তথ্য ডাউনলোড"] },
  { Icon: LinkSimple, label: ["Share a view: the link keeps your place", "লিংক শেয়ার করলে একই দৃশ্য খোলে"] },
  { Icon: DeviceMobile, label: ["Works on phones", "ফোনেও চলে"] },
];

export default async function Home() {
  const dhaka = placeById("dhaka")!;
  const [manifest, trendZones, hazardZones, latest, dhakaReport] = await Promise.all([
    readManifest(),
    readTrendZones(),
    readHazardZones(),
    readLatest(),
    buildPlaceReport(dhaka),
  ]);
  const monthName = (ym: string) =>
    new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const ordinalRank = (r: number) => (r === 1 ? "" : `${r}${r === 2 ? "nd" : r === 3 ? "rd" : "th"} `);
  const lt = latest.temperature.zones["study-area"];
  const lr = latest.rainfall.zones["study-area"];
  const years = manifest.years;
  const [first, last] = [years[0], years[years.length - 1]];
  const zone = (id: string) => trendZones.find((z) => z.id === id)!;

  const study = zone("study-area");
  const tTrend = study.results["temperature_annual"].trend!;
  const tSeries = study.results["temperature_annual"].series as number[];
  const warmer = (tTrend.slopePerDecade * (last - first)) / 10;
  const temp = manifest.summaries["temperature_annual"];
  const spring = formatSigned(manifest.summaries["temperature_pre-monsoon"].medianSlopePerDecade, 2);

  const rainPct = (z: Zone) => {
    const r = z.results["rainfall_monsoon"];
    return (r.trend!.slopePerDecade / r.mean) * 100;
  };
  const rainIndus = `${formatSigned(rainPct(zone("indus-plain")), 0)}%`;
  const rainDelta = `${formatSigned(rainPct(zone("bengal-delta")), 0)}%`;
  const watch = hazardZones.filter((h) => preparednessSignal(h).kind === "resembles");
  const rainWord = lr.percentOfNormal < 90 ? 0 : lr.percentOfNormal > 110 ? 2 : 1;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 pb-16 pt-14 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
        <div>
          <p className="text-sm font-medium text-accent">NASA Space Apps Challenge 2026</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            <T en="See how South Asia's climate is changing." bn="দেখুন দক্ষিণ এশিয়ার জলবায়ু কীভাবে বদলাচ্ছে।" />
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ink-2">
            <T
              en={`${years.length} years of NASA data, explained simply: where it is getting hotter, where the rain is moving, and which places should get ready for floods, landslides and fires.`}
              bn={`নাসার ${bnNum(years.length)} বছরের তথ্য, সহজ ভাষায়: কোথায় গরম বাড়ছে, বৃষ্টি কোন দিকে সরছে, আর কোন জায়গাগুলোকে বন্যা, ভূমিধস ও আগুনের জন্য প্রস্তুত থাকতে হবে।`}
            />
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/findings"
              className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-6 py-3 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
            >
              <T en="Read the story" bn="মূল গল্প পড়ুন" /> <ArrowRight size={18} />
            </Link>
            <StartTourButton />
          </div>
          <div className="mt-8">
            <p className="mb-2 text-sm font-medium text-ink-2">
              <T en="Or look up your city" bn="অথবা আপনার শহর খুঁজুন" />
            </p>
            <PlaceSearch />
          </div>
        </div>

        <Link
          href="/trends?var=temperature&season=annual&zone=study-area"
          className="group rounded-3xl bg-card p-7 shadow-soft transition-transform hover:-translate-y-0.5"
        >
          <p className="text-sm text-ink-2">
            <T en={`South Asia today, compared with ${first}`} bn={`আজকের দক্ষিণ এশিয়া, ${bnNum(first)} সালের তুলনায়`} />
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-6xl font-semibold tracking-tight tabular-nums text-ink">
              <T en={`${formatSigned(warmer, 1)} °C`} bn={`${bnNum(formatSigned(warmer, 1))} °সে`} />
            </span>
            <span className="text-ink-2">
              <T en="warmer" bn="বেশি গরম" />
            </span>
          </div>
          <div className="mt-6">
            <Sparkline values={tSeries} color="var(--warm-3)" />
            <div className="mt-1 flex justify-between text-xs text-ink-3">
              <span>{first}</span>
              <span>{last}</span>
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-ink-2">
            <T
              en={`All ${temp.cells} squares of our map got warmer; not one got cooler.`}
              bn={`আমাদের মানচিত্রের ${bnNum(temp.cells)}টি বর্গের সবগুলোই উষ্ণ হয়েছে; একটিও ঠান্ডা হয়নি।`}
            />{" "}
            <span className="font-medium text-accent group-hover:underline">
              <T en="See the trend →" bn="প্রবণতা দেখুন →" />
            </span>
          </p>
        </Link>
      </section>

      {/* What you can do here */}
      <section aria-labelledby="tools" className="mb-20">
        <h2 id="tools" className="text-3xl font-semibold tracking-tight text-ink">
          <T en="What you can do here" bn="এই সাইটে যা করতে পারবেন" />
        </h2>
        <p className="mt-2 max-w-[60ch] text-lg leading-relaxed text-ink-2">
          <T
            en="Four tools, each answering one question. Pick the one that matches yours, or try one of the ready-made views."
            bn="চারটি টুল, প্রতিটি একটি প্রশ্নের উত্তর দেয়। আপনার প্রশ্নের সাথে মেলে এমনটি বেছে নিন, অথবা তৈরি করে রাখা দৃশ্যগুলোর একটি খুলে দেখুন।"
          />
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {TOOLS.map((tool) => (
            <ToolCard
              key={tool.href}
              tool={tool}
              preview={
                tool.shot ? undefined : (
                  <PlacePreview
                    name={<T en={dhaka.name} bn="ঢাকা" />}
                    warmed={dhakaReport.temperature.annual ? (dhakaReport.temperature.annual.trend.slopePerDecade * (last - first)) / 10 : null}
                    series={(dhakaReport.temperature.annual?.series ?? []).filter((v): v is number => v !== null)}
                    rainPct={
                      dhakaReport.rain.monsoon?.mean
                        ? (dhakaReport.rain.monsoon.trend.slopePerDecade / dhakaReport.rain.monsoon.mean) * 100
                        : null
                    }
                    floods={dhakaReport.floods.count}
                    radiusKm={dhakaReport.floods.radiusKm}
                    first={first}
                  />
                )
              }
            />
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/findings"
            className="group flex items-center gap-4 rounded-3xl bg-card p-5 shadow-soft transition-transform hover:-translate-y-0.5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <BookOpen size={22} weight="duotone" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">
                <T en="The story" bn="মূল গল্প" />
              </span>
              <span className="block text-sm leading-relaxed text-ink-2">
                <T en="Our five main findings, in plain words with charts." bn="আমাদের পাঁচটি মূল ফলাফল, সহজ ভাষায়, চার্টসহ।" />
              </span>
            </span>
            <ArrowRight size={18} className="shrink-0 text-accent transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/methods"
            className="group flex items-center gap-4 rounded-3xl bg-card p-5 shadow-soft transition-transform hover:-translate-y-0.5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Flask size={22} weight="duotone" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">
                <T en="How it works" bn="কীভাবে কাজ করে" />
              </span>
              <span className="block text-sm leading-relaxed text-ink-2">
                <T
                  en="The NASA data we use and how we test that a change is real."
                  bn="আমরা নাসার কোন তথ্য ব্যবহার করি, আর পরিবর্তন সত্যি কি না কীভাবে যাচাই করি।"
                />
              </span>
            </span>
            <ArrowRight size={18} className="shrink-0 text-accent transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Also on this site">
          {EXTRAS.map(({ Icon, label }) => (
            <li key={label[0]} className="flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-2">
              <Icon size={16} className="text-accent" />
              <T en={label[0]} bn={label[1]} />
            </li>
          ))}
        </ul>
      </section>

      {/* The latest month */}
      <section aria-labelledby="latest" className="mb-16">
        <h2 id="latest" className="text-2xl font-semibold tracking-tight text-ink">
          <T en="The latest month" bn="সর্বশেষ মাস" />
        </h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-ink-3">
          <T
            en={`"Normal" means the long-term average for that month: ${latest.temperature.baseline} for temperature (NASA's usual starting point) and ${latest.rainfall.baseline} for rain (the standard for rainfall records).`}
            bn={`"স্বাভাবিক" মানে ওই মাসের দীর্ঘমেয়াদি গড়: তাপমাত্রার জন্য ${bnNum(latest.temperature.baseline)} (নাসার প্রচলিত ভিত্তি) আর বৃষ্টির জন্য ${bnNum(latest.rainfall.baseline)} (বৃষ্টির রেকর্ডের প্রচলিত ভিত্তি)।`}
          />
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-card p-6 shadow-soft">
            <div className="text-sm font-medium text-ink-2">
              <T
                en={`${monthName(latest.temperature.month)} · temperature`}
                bn={`${bnMonth(latest.temperature.month)} · তাপমাত্রা`}
              />
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-ink">
              <T
                en={`${formatSigned(lt.anomaly, 1)} °C warmer than normal`}
                bn={`স্বাভাবিকের চেয়ে ${bnNum(formatSigned(lt.anomaly, 1))} °সে বেশি গরম`}
              />
            </div>
            <p className="mt-2 leading-relaxed text-ink-2">
              <T
                en={`The ${ordinalRank(lt.rank)}hottest ${monthName(latest.temperature.month).split(" ")[0]} across South Asia since ${years[0]} (${lt.of} years), compared with the ${latest.temperature.baseline} average.`}
                bn={`${bnNum(years[0])} সালের পর থেকে (${bnNum(lt.of)} বছর) দক্ষিণ এশিয়ায় ${lt.rank === 1 ? "সবচেয়ে গরম" : `${bnNum(lt.rank)}তম গরম`} ${bnMonth(latest.temperature.month).split(" ")[0]} মাস, ${bnNum(latest.temperature.baseline)} সালের গড়ের তুলনায়।`}
              />
            </p>
          </div>
          <div className="rounded-3xl bg-card p-6 shadow-soft">
            <div className="text-sm font-medium text-ink-2">
              <T en={`${monthName(latest.rainfall.month)} · rain`} bn={`${bnMonth(latest.rainfall.month)} · বৃষ্টি`} />
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-ink">
              <T en={`${lr.percentOfNormal}% of the usual rain`} bn={`স্বাভাবিক বৃষ্টির ${bnNum(lr.percentOfNormal)}%`} />
            </div>
            <p className="mt-2 leading-relaxed text-ink-2">
              <T
                en={`${["Clearly drier than usual", "Close to usual", "Clearly wetter than usual"][rainWord]} for ${monthName(latest.rainfall.month).split(" ")[0]}, compared with the ${latest.rainfall.baseline} average. Rain data is published a few months after temperature.`}
                bn={`${bnNum(latest.rainfall.baseline)} সালের গড়ের তুলনায় ${bnMonth(latest.rainfall.month).split(" ")[0]} মাসের জন্য ${["স্পষ্টভাবে কম বৃষ্টি", "প্রায় স্বাভাবিক", "স্পষ্টভাবে বেশি বৃষ্টি"][rainWord]}। বৃষ্টির তথ্য তাপমাত্রার কয়েক মাস পরে প্রকাশিত হয়।`}
              />
            </p>
          </div>
        </div>
      </section>

      {/* In one minute */}
      <section aria-labelledby="minute">
        <h2 id="minute" className="text-2xl font-semibold tracking-tight text-ink">
          <T en="In one minute" bn="এক মিনিটে" />
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Fact
            href="/findings#spring"
            label={<T en="Spring heats fastest" bn="বসন্তে গরম বাড়ছে সবচেয়ে দ্রুত" />}
            value={<T en={`${spring} °C`} bn={`${bnNum(spring)} °সে`} />}
            icon={<Thermometer size={20} className="text-accent" />}
            note={
              <T
                en="every 10 years in March–May, the hot weeks before the monsoon, and faster still in the mountains."
                bn="প্রতি ১০ বছরে, মার্চ–মে মাসে, অর্থাৎ বর্ষার আগের গরম সপ্তাহগুলোতে; পাহাড়ে আরও দ্রুত।"
              />
            }
          />
          <Fact
            href="/findings#rain"
            label={<T en="The rain is moving" bn="বৃষ্টি জায়গা বদলাচ্ছে" />}
            value={
              <span className="flex flex-wrap gap-x-6 gap-y-2">
                <span>
                  <T en={rainIndus} bn={bnNum(rainIndus)} />
                  <span className="block text-sm font-normal tracking-normal text-ink-3">
                    <T en="Indus plain" bn="সিন্ধু সমভূমি" />
                  </span>
                </span>
                <span>
                  <T en={rainDelta} bn={bnNum(rainDelta)} />
                  <span className="block text-sm font-normal tracking-normal text-ink-3">
                    <T en="Bengal delta" bn="বাংলার ব-দ্বীপ" />
                  </span>
                </span>
              </span>
            }
            note={
              <T
                en="monsoon rain every 10 years: the dry Indus plain gets more, the Bengal delta gets less. Two independent records agree."
                bn="প্রতি ১০ বছরে বর্ষার বৃষ্টি: শুষ্ক সিন্ধু সমভূমিতে বাড়ছে, বাংলার ব-দ্বীপে কমছে। দুটি আলাদা তথ্যসূত্র একমত।"
              />
            }
            icon={<CloudRain size={20} className="text-accent" />}
          />
          <Fact
            href="/hazards"
            label={<T en={`Places to watch in ${last}`} bn={`${bnNum(last)} সালে যেসব জায়গায় নজর দরকার`} />}
            value={<T en={`${watch.length} regions`} bn={`${bnNum(watch.length)}টি অঞ্চল`} />}
            note={
              <T
                en={`${watch.map((w) => w.name).join(" and ")} had weather like past disaster years.`}
                bn={`${watch.map((w) => zoneNameBn(w.id, w.name)).join(" ও ")}-এর আবহাওয়া আগের দুর্যোগের বছরগুলোর মতো ছিল।`}
              />
            }
            icon={<WarningCircle size={20} className="text-watch" />}
          />
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mt-24">
        <h2 id="how" className="text-2xl font-semibold tracking-tight text-ink">
          <T en="How it works" bn="কীভাবে কাজ করে" />
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            {
              Icon: Planet,
              title: <T en="Satellites measure" bn="স্যাটেলাইট মাপে" />,
              text: (
                <T
                  en={`NASA satellites and records track temperature, rain, forests and fires across South Asia since ${first}.`}
                  bn={`নাসার স্যাটেলাইট ও রেকর্ড ${bnNum(first)} সাল থেকে দক্ষিণ এশিয়ার তাপমাত্রা, বৃষ্টি, বন ও আগুন পর্যবেক্ষণ করছে।`}
                />
              ),
            },
            {
              Icon: ChartLineUp,
              title: <T en="We check what is real" bn="আমরা যাচাই করি কোনটা সত্যি" />,
              text: (
                <T
                  en="Statistics separate a real long-term change from the normal ups and downs of the weather."
                  bn="পরিসংখ্যান আবহাওয়ার স্বাভাবিক ওঠানামা থেকে সত্যিকারের দীর্ঘমেয়াদি পরিবর্তনকে আলাদা করে।"
                />
              ),
            },
            {
              Icon: Warning,
              title: <T en="We link it to disasters" bn="আমরা দুর্যোগের সাথে মেলাই" />,
              text: (
                <T
                  en="We compare the weather with past floods, landslides, fires and cyclones, to show where to prepare."
                  bn="আগের বন্যা, ভূমিধস, আগুন ও ঘূর্ণিঝড়ের সাথে আবহাওয়া মিলিয়ে দেখাই কোথায় প্রস্তুতি দরকার।"
                />
              ),
            },
          ].map(({ Icon, title, text }, i) => (
            <li key={i} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Icon size={22} weight="duotone" />
              </span>
              <div>
                <div className="text-sm text-ink-3">
                  <T en={`Step ${i + 1}`} bn={`ধাপ ${bnNum(i + 1)}`} />
                </div>
                <div className="font-semibold text-ink">{title}</div>
                <p className="mt-1 leading-relaxed text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

    </div>
  );
}

function ToolCard({ tool, preview }: { tool: Tool; preview?: React.ReactNode }) {
  const { href, Icon, question, title, text, shot, tries } = tool;
  return (
    <article className="group/card flex flex-col rounded-3xl bg-card p-2 shadow-soft">
      <Link
        href={href}
        className="relative block aspect-[16/10] overflow-hidden rounded-2xl bg-sunken"
        aria-label={title[0]}
        tabIndex={-1}
      >
        {shot ? (
          <>
            <Image
              src={`/features/${shot.name}-light.webp`}
              alt={shot.alt}
              fill
              sizes="(min-width: 1200px) 580px, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover/card:scale-[1.03] dark:hidden"
            />
            <Image
              src={`/features/${shot.name}-dark.webp`}
              alt={shot.alt}
              fill
              sizes="(min-width: 1200px) 580px, (min-width: 768px) 50vw, 100vw"
              className="hidden object-cover transition-transform duration-500 group-hover/card:scale-[1.03] dark:block"
            />
          </>
        ) : (
          preview
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-accent">
          <Icon size={18} weight="duotone" />
          <T en={question[0]} bn={question[1]} />
        </div>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">
          <Link href={href} className="inline-flex min-h-10 items-center gap-1.5 hover:text-accent">
            <T en={title[0]} bn={title[1]} />
            <ArrowRight size={17} className="transition-transform group-hover/card:translate-x-0.5" />
          </Link>
        </h3>
        <p className="mt-1.5 flex-1 leading-relaxed text-ink-2">
          <T en={text[0]} bn={text[1]} />
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-3">
            <T en="Try:" bn="দেখুন:" />
          </span>
          {tries.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-full bg-sunken px-3 py-1.5 text-sm text-ink transition-colors hover:bg-accent-soft hover:text-accent"
            >
              <T en={t.label[0]} bn={t.label[1]} />
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

/** A live miniature of a place report, drawn from the same data as the real page. */
function PlacePreview({
  name,
  warmed,
  series,
  rainPct,
  floods,
  radiusKm,
  first,
}: {
  name: React.ReactNode;
  warmed: number | null;
  series: number[];
  rainPct: number | null;
  floods: number;
  radiusKm: number;
  first: number;
}) {
  const w = warmed !== null ? formatSigned(warmed, 1) : null;
  const r = rainPct !== null ? formatSigned(rainPct, 0) : null;
  return (
    <div className="flex h-full flex-col justify-between p-5 sm:p-7">
      <div>
        <div className="flex items-center gap-2 text-sm text-ink-3">
          <MapPin size={16} weight="fill" className="text-accent" />
          <T en="Place report" bn="শহরের রিপোর্ট" />
        </div>
        <div className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{name}</div>
      </div>
      {series.length > 1 && <Sparkline values={series} color="var(--warm-3)" />}
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {w && (
          <div>
            <dt className="text-ink-3">
              <T en={`Since ${first}`} bn={`${bnNum(first)} থেকে`} />
            </dt>
            <dd className="text-lg font-semibold tabular-nums text-ink">
              <T en={`${w} °C`} bn={`${bnNum(w)} °সে`} />
            </dd>
          </div>
        )}
        {r && (
          <div>
            <dt className="text-ink-3">
              <T en="Monsoon rain" bn="বর্ষার বৃষ্টি" />
            </dt>
            <dd className="text-lg font-semibold tabular-nums text-ink">
              <T en={`${r}%/decade`} bn={`${bnNum(r)}%/দশক`} />
            </dd>
          </div>
        )}
        <div>
          <dt className="text-ink-3">
            <T en={`Floods, ${radiusKm} km`} bn={`বন্যা, ${bnNum(radiusKm)} কিমি`} />
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">
            <T en={String(floods)} bn={bnNum(floods)} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Fact({
  href,
  label,
  value,
  note,
  icon,
}: {
  href: string;
  label: React.ReactNode;
  value: React.ReactNode;
  note: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Link href={href} className="group flex flex-col rounded-3xl bg-card p-6 shadow-soft transition-transform hover:-translate-y-0.5">
      <div className="flex items-center gap-2 text-sm font-medium text-ink-2">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-ink">{value}</div>
      <p className="mt-2 flex-1 leading-relaxed text-ink-2">{note}</p>
      <span className="mt-4 text-sm font-medium text-accent group-hover:underline">
        <T en="Learn more →" bn="আরও জানুন →" />
      </span>
    </Link>
  );
}
