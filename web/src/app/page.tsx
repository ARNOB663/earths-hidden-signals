import {
  ArrowRight,
  BookOpen,
  ChartLineUp,
  CloudRain,
  Flask,
  MapPin,
  MapTrifold,
  Planet,
  Thermometer,
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
import {
  readHazardZones,
  readLatest,
  readManifest,
  readTrendZones,
} from "@/lib/data";
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
  shot?: { name: string; alt: string };
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
    shot: {
      name: "explore",
      alt: "Satellite map of ground heat over South Asia in May 2024",
    },
    tries: [
      {
        href: "/explore?layer=lst-day&date=2024-05-01&compare=2001&view=diff",
        label: ["May heat: 2024 vs 2001", "মে মাসের তাপ: ২০২৪ বনাম ২০০১"],
      },
      {
        href: "/explore?layer=forest-loss",
        label: ["Forest loss since 2001", "২০০১ থেকে বন উজাড়"],
      },
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
    tries: [
      {
        href: "/trends?var=rainfall&season=monsoon",
        label: ["Where monsoon rain is moving", "বর্ষার বৃষ্টি কোথায় সরছে"],
      },
      {
        href: "/trends?var=hot-months&season=annual",
        label: ["Very hot months", "খুব গরম মাস"],
      },
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
    shot: {
      name: "hazards",
      alt: "Cyclone tracks crossing the Bay of Bengal since 1981",
    },
    tries: [
      {
        href: "/hazards?hazard=cyclone&zone=bay-of-bengal",
        label: ["Bay of Bengal cyclones", "বঙ্গোপসাগরের ঘূর্ণিঝড়"],
      },
      {
        href: "/hazards?hazard=flood&zone=indus-plain",
        label: ["This year's flood signal", "এ বছরের বন্যা সংকেত"],
      },
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

export default async function Home() {
  const dhaka = placeById("dhaka")!;
  const [manifest, trendZones, hazardZones, latest, dhakaReport] =
    await Promise.all([
      readManifest(),
      readTrendZones(),
      readHazardZones(),
      readLatest(),
      buildPlaceReport(dhaka),
    ]);
  const monthName = (ym: string) =>
    new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  const ordinalRank = (r: number) =>
    r === 1 ? "" : `${r}${r === 2 ? "nd" : r === 3 ? "rd" : "th"} `;
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
  const spring = formatSigned(
    manifest.summaries["temperature_pre-monsoon"].medianSlopePerDecade,
    2,
  );

  const rainPct = (z: Zone) => {
    const r = z.results["rainfall_monsoon"];
    return (r.trend!.slopePerDecade / r.mean) * 100;
  };
  const rainIndus = `${formatSigned(rainPct(zone("indus-plain")), 0)}%`;
  const rainDelta = `${formatSigned(rainPct(zone("bengal-delta")), 0)}%`;
  const watch = hazardZones.filter(
    (h) => preparednessSignal(h).kind === "resembles",
  );
  const rainWord =
    lr.percentOfNormal < 90 ? 0 : lr.percentOfNormal > 110 ? 2 : 1;

  return (
    <>
      {/* ===== HERO =====
       * -mt-16 pulls the section 64 px upward so its atmospheric gradient covers the
       * navbar area. pt-16 compensates inside the section so the grid content stays
       * at the same absolute position it occupied before. The navbar itself becomes
       * transparent on the homepage (see SiteNav), completing the seamless look.
       */}
      <section
        className="home-hero relative overflow-hidden -mt-16 pt-16"
        aria-labelledby="hero-hdg"
      >
        {/* Decorative atmospheric blob */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          <div
            className="absolute right-0 top-0 h-200 w-200 opacity-50"
            style={{
              background:
                "radial-gradient(circle at center, color-mix(in srgb, var(--accent) 11%, transparent), transparent 65%)",
              transform: "translate(35%, -25%)",
            }}
          />
        </div>

        <style jsx>{`
          .scan-line {
            animation: scan 12s linear infinite;
          }
          @keyframes scan {
            0% { y: -2; }
            100% { y: 302; }
          }
          @media (prefers-reduced-motion: reduce) {
            .scan-line { animation: none; }
          }
        `}</style>
        <div className="relative mx-auto max-w-384 px-6 pb-20 pt-14 sm:px-8 lg:min-h-[86vh] lg:px-12 lg:pb-28 lg:pr-96 lg:pt-20 xl:pr-12">
          {/* ── Left: text ── */}
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft px-4 py-1.5 text-sm font-medium text-accent">
              <Planet size={14} weight="fill" aria-hidden />
              NASA Space Apps Challenge 2026
            </div>

            <h1
              id="hero-hdg"
              className="mt-5 text-[2.6rem] font-semibold leading-[1.07] tracking-tight text-white sm:text-6xl lg:text-[3.25rem] xl:text-[3.75rem]"
            >
              <T
                en="See how South Asia's climate is changing."
                bn="দেখুন দক্ষিণ এশিয়ার জলবায়ু কীভাবে বদলাচ্ছে।"
              />
            </h1>

            <p className="mt-5 max-w-[50ch] text-lg leading-relaxed text-white/80">
              <T
                en={`${years.length} years of NASA data, explained simply: where it is getting hotter, where the rain is moving, and which places should get ready for floods, landslides and fires.`}
                bn={`নাসার ${bnNum(years.length)} বছরের তথ্য, সহজ ভাষায়: কোথায় গরম বাড়ছে, বৃষ্টি কোন দিকে সরছে, আর কোন জায়গাগুলোকে বন্যা, ভূমিধস ও আগুনের জন্য প্রস্তুত থাকতে হবে।`}
              />
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-6 py-3.5 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
                style={{
                  boxShadow:
                    "0 4px 18px color-mix(in srgb, var(--accent) 38%, transparent)",
                }}
              >
                <MapTrifold size={18} weight="duotone" aria-hidden />
                <T en="Explore the map" bn="মানচিত্র দেখুন" />
              </Link>
              <Link
                href="/findings"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-6 py-3.5 font-medium text-white backdrop-blur-sm transition-all hover:bg-white/22 active:scale-[0.98]"
              >
                <BookOpen size={18} weight="duotone" aria-hidden />
                <T en="Discover the story" bn="মূল গল্প পড়ুন" />
              </Link>
            </div>

            <div className="mt-3">
              <StartTourButton />
            </div>

            <div className="mt-8">
              <p className="mb-2 text-sm text-white/70">
                <T en="Or search your city" bn="অথবা আপনার শহর খুঁজুন" />
              </p>
              <PlaceSearch />
            </div>
          </div>

        </div>


        {/* Photo credit — required by CC BY-SA 2.0 */}
        <p className="absolute bottom-2 right-3 z-10 text-[10px] text-white/35 select-none">
          Photo: Faisal Akram / CC BY-SA 2.0
        </p>
      </section>

      {/* ===== CONTENT ===== */}
      <div className="mx-auto w-full max-w-300 px-4 pb-24 sm:px-6">
        {/* ── The Signal: concept flow ── */}
        <section className="py-20 md:py-28" aria-labelledby="signal-hdg">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="signal-hdg"
              className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
            >
              <T
                en={`${years.length} years of Earth data reveal signals we normally cannot see.`}
                bn={`পৃথিবীর ${bnNum(years.length)} বছরের তথ্য এমন সংকেত প্রকাশ করে যা আমরা সাধারণত দেখতে পাই না।`}
              />
            </h2>
            <p className="mt-4 text-lg text-ink-2">
              <T
                en="Preparedness, not prediction."
                bn="প্রস্তুতি, পূর্বাভাস নয়।"
              />
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
            {(
              [
                {
                  Icon: Planet,
                  en: "NASA Data",
                  bn: "নাসা ডেটা",
                  sub: [
                    `Satellites and records since ${first}`,
                    `${bnNum(first)} থেকে স্যাটেলাইট ও রেকর্ড`,
                  ],
                },
                {
                  Icon: ChartLineUp,
                  en: "Long-term Trends",
                  bn: "দীর্ঘমেয়াদি প্রবণতা",
                  sub: [
                    `Statistical analysis of ${temp.cells} cells`,
                    `${bnNum(temp.cells)}টি কোষের পরিসংখ্যান`,
                  ],
                },
                {
                  Icon: Warning,
                  en: "Hazard Signals",
                  bn: "বিপদ সংকেত",
                  sub: [
                    "Linked to past floods, fires, cyclones",
                    "অতীত দুর্যোগের সাথে যুক্ত",
                  ],
                },
                {
                  Icon: BookOpen,
                  en: "Preparedness",
                  bn: "প্রস্তুতি",
                  sub: [
                    "So communities can act early",
                    "যাতে জনগোষ্ঠী আগে থেকে পদক্ষেপ নিতে পারে",
                  ],
                },
              ] as const
            ).map(({ Icon, en, bn, sub }, i, arr) => (
              <div
                key={en}
                className="relative flex flex-col items-center text-center"
              >
                {/* Arrow connector (desktop only) */}
                {i < arr.length - 1 && (
                  <ArrowRight
                    size={16}
                    className="absolute -right-4 top-3.5 hidden text-line md:block"
                    aria-hidden
                  />
                )}
                <div className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent ring-4 ring-page">
                  <Icon size={22} weight="duotone" aria-hidden />
                </div>
                <div className="mt-3 font-semibold text-ink">
                  <T en={en} bn={bn} />
                </div>
                <p className="mt-1 text-sm leading-snug text-ink-3">
                  <T en={sub[0]} bn={sub[1]} />
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── South Asia Today: big-number stat ── */}
        <section aria-labelledby="south-asia-today" className="mb-24">
          <Link
            href="/trends?var=temperature&season=annual&zone=study-area"
            className="group block overflow-hidden rounded-3xl bg-card shadow-soft transition-all hover:-translate-y-0.5"
          >
            <div className="grid md:grid-cols-2">
              {/* Left: massive number */}
              <div className="p-10 sm:p-12">
                <p
                  id="south-asia-today"
                  className="text-sm font-medium text-ink-3"
                >
                  <T
                    en={`South Asia today, compared with ${first}`}
                    bn={`আজকের দক্ষিণ এশিয়া, ${bnNum(first)} সালের তুলনায়`}
                  />
                </p>
                <div className="mt-4 flex items-start gap-3">
                  <span className="text-[5.5rem] font-semibold leading-none tracking-tight tabular-nums text-ink sm:text-[7rem]">
                    <T
                      en={formatSigned(warmer, 1)}
                      bn={bnNum(formatSigned(warmer, 1))}
                    />
                  </span>
                  <div className="mt-5 flex flex-col">
                    <span className="text-2xl font-semibold text-ink-2">
                      <T en="°C" bn="°সে" />
                    </span>
                    <span className="mt-1 text-base text-ink-3">
                      <T en="warmer" bn="বেশি গরম" />
                    </span>
                  </div>
                </div>
                <p className="mt-6 max-w-[38ch] leading-relaxed text-ink-2">
                  <T
                    en={`All ${temp.cells} analyzed land cells warmed. Not one got cooler.`}
                    bn={`বিশ্লেষণ করা ${bnNum(temp.cells)}টি ভূমির কোষ সবগুলোই উষ্ণ হয়েছে। একটিও ঠান্ডা হয়নি।`}
                  />
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent group-hover:underline">
                  <T en="See the trend map" bn="প্রবণতার মানচিত্র দেখুন" />
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </div>

              {/* Right: sparkline + metric */}
              <div className="flex flex-col justify-center gap-7 border-t border-line px-10 py-10 sm:px-12 md:border-l md:border-t-0">
                <div>
                  <p className="text-sm text-ink-3">
                    <T
                      en={`Annual temperature trend, ${first}–${last}`}
                      bn={`বার্ষিক তাপমাত্রার প্রবণতা, ${bnNum(first)}–${bnNum(last)}`}
                    />
                  </p>
                  <div className="mt-3">
                    <Sparkline values={tSeries} color="var(--warm-3)" />
                    <div className="mt-1 flex justify-between text-xs text-ink-3">
                      <span>{first}</span>
                      <span>{last}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-accent-soft px-6 py-5">
                  <span className="text-3xl font-semibold tabular-nums text-ink">
                    <T
                      en={`${temp.cells} / ${temp.cells}`}
                      bn={`${bnNum(temp.cells)} / ${bnNum(temp.cells)}`}
                    />
                  </span>
                  <p className="mt-1 text-sm text-ink-2">
                    <T
                      en="land cells warmed across South Asia"
                      bn="দক্ষিণ এশিয়া জুড়ে ভূমির কোষ উষ্ণ হয়েছে"
                    />
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </section>

        {/* ── The latest month ── */}
        <section aria-labelledby="latest" className="mb-24">
          <h2
            id="latest"
            className="text-2xl font-semibold tracking-tight text-ink"
          >
            <T en="The latest month" bn="সর্বশেষ মাস" />
          </h2>
          <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-ink-3">
            <T
              en={`"Normal" means the long-term average for that month: ${latest.temperature.baseline} for temperature and ${latest.rainfall.baseline} for rain.`}
              bn={`"স্বাভাবিক" মানে ওই মাসের দীর্ঘমেয়াদি গড়: তাপমাত্রার জন্য ${bnNum(latest.temperature.baseline)}, বৃষ্টির জন্য ${bnNum(latest.rainfall.baseline)}।`}
            />
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {/* Temperature */}
            <div className="rounded-3xl bg-card p-8 shadow-soft sm:p-10">
              <div className="flex items-center gap-2 text-sm text-ink-3">
                <Thermometer
                  size={15}
                  weight="fill"
                  style={{ color: "var(--warm-3)" }}
                  aria-hidden
                />
                <span>
                  <T
                    en={monthName(latest.temperature.month)}
                    bn={bnMonth(latest.temperature.month)}
                  />
                </span>
                <span aria-hidden>·</span>
                <T en="Temperature" bn="তাপমাত্রা" />
              </div>
              <div className="mt-5">
                <span className="text-5xl font-semibold tracking-tight tabular-nums text-ink sm:text-6xl">
                  <T
                    en={`${formatSigned(lt.anomaly, 1)} °C`}
                    bn={`${bnNum(formatSigned(lt.anomaly, 1))} °সে`}
                  />
                </span>
                <p className="mt-2 text-base text-ink-2">
                  <T en="warmer than normal" bn="স্বাভাবিকের চেয়ে বেশি গরম" />
                </p>
              </div>
              <p className="mt-5 leading-relaxed text-ink-2">
                <T
                  en={`The ${ordinalRank(lt.rank)}hottest ${monthName(latest.temperature.month).split(" ")[0]} across South Asia since ${years[0]} (${lt.of} years on record).`}
                  bn={`${bnNum(years[0])} সাল থেকে (${bnNum(lt.of)} বছরের রেকর্ডে) দক্ষিণ এশিয়ায় ${lt.rank === 1 ? "সবচেয়ে গরম" : `${bnNum(lt.rank)}তম গরম`} ${bnMonth(latest.temperature.month).split(" ")[0]} মাস।`}
                />
              </p>
            </div>

            {/* Rainfall */}
            <div className="rounded-3xl bg-card p-8 shadow-soft sm:p-10">
              <div className="flex items-center gap-2 text-sm text-ink-3">
                <CloudRain
                  size={15}
                  weight="fill"
                  style={{ color: "var(--cool-3)" }}
                  aria-hidden
                />
                <span>
                  <T
                    en={monthName(latest.rainfall.month)}
                    bn={bnMonth(latest.rainfall.month)}
                  />
                </span>
                <span aria-hidden>·</span>
                <T en="Rainfall" bn="বৃষ্টিপাত" />
              </div>
              <div className="mt-5">
                <span className="text-5xl font-semibold tracking-tight tabular-nums text-ink sm:text-6xl">
                  <T
                    en={`${lr.percentOfNormal}%`}
                    bn={`${bnNum(lr.percentOfNormal)}%`}
                  />
                </span>
                <p className="mt-2 text-base text-ink-2">
                  <T en="of usual rainfall" bn="স্বাভাবিক বৃষ্টিপাতের" />
                </p>
              </div>
              <p className="mt-5 leading-relaxed text-ink-2">
                <T
                  en={`${["Clearly drier than usual", "Close to usual", "Clearly wetter than usual"][rainWord]} for ${monthName(latest.rainfall.month).split(" ")[0]}, compared with the ${latest.rainfall.baseline} average. Rain data is published a few months after temperature.`}
                  bn={`${bnNum(latest.rainfall.baseline)} গড়ের তুলনায় ${bnMonth(latest.rainfall.month).split(" ")[0]} মাসের জন্য ${["স্পষ্টভাবে কম বৃষ্টি", "প্রায় স্বাভাবিক", "স্পষ্টভাবে বেশি বৃষ্টি"][rainWord]}। বৃষ্টির তথ্য তাপমাত্রার কয়েক মাস পরে প্রকাশিত হয়।`}
                />
              </p>
            </div>
          </div>
        </section>

        {/* ── In one minute: three key findings ── */}
        <section aria-labelledby="minute" className="mb-24">
          <h2
            id="minute"
            className="text-2xl font-semibold tracking-tight text-ink"
          >
            <T en="In one minute" bn="এক মিনিটে" />
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <Fact
              href="/findings#spring"
              label={
                <T
                  en="Spring heats fastest"
                  bn="বসন্তে গরম বাড়ছে সবচেয়ে দ্রুত"
                />
              }
              value={<T en={`${spring} °C`} bn={`${bnNum(spring)} °সে`} />}
              icon={
                <Thermometer size={18} className="text-accent" aria-hidden />
              }
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
                <span className="flex flex-wrap gap-x-5 gap-y-2">
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
              icon={<CloudRain size={18} className="text-accent" aria-hidden />}
            />
            <Fact
              href="/hazards"
              label={
                <T
                  en={`Places to watch in ${last}`}
                  bn={`${bnNum(last)} সালে যেসব জায়গায় নজর দরকার`}
                />
              }
              value={
                <T
                  en={`${watch.length} regions`}
                  bn={`${bnNum(watch.length)}টি অঞ্চল`}
                />
              }
              note={
                <T
                  en={`${watch.map((w) => w.name).join(" and ")} had weather like past disaster years.`}
                  bn={`${watch.map((w) => zoneNameBn(w.id, w.name)).join(" ও ")}-এর আবহাওয়া আগের দুর্যোগের বছরগুলোর মতো ছিল।`}
                />
              }
              icon={
                <WarningCircle size={18} className="text-watch" aria-hidden />
              }
            />
          </div>
        </section>

        {/* ── How it works ── */}
        <section aria-labelledby="how" className="mb-24">
          <h2
            id="how"
            className="text-2xl font-semibold tracking-tight text-ink"
          >
            <T en="How it works" bn="কীভাবে কাজ করে" />
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
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
                title: (
                  <T
                    en="We check what is real"
                    bn="আমরা যাচাই করি কোনটা সত্যি"
                  />
                ),
                text: (
                  <T
                    en="Statistics separate a real long-term change from the normal ups and downs of the weather."
                    bn="পরিসংখ্যান আবহাওয়ার স্বাভাবিক ওঠানামা থেকে সত্যিকারের দীর্ঘমেয়াদি পরিবর্তনকে আলাদা করে।"
                  />
                ),
              },
              {
                Icon: Warning,
                title: (
                  <T
                    en="We link it to disasters"
                    bn="আমরা দুর্যোগের সাথে মেলাই"
                  />
                ),
                text: (
                  <T
                    en="We compare the weather with past floods, landslides, fires and cyclones, to show where to prepare."
                    bn="আগের বন্যা, ভূমিধস, আগুন ও ঘূর্ণিঝড়ের সাথে আবহাওয়া মিলিয়ে দেখাই কোথায় প্রস্তুতি দরকার।"
                  />
                ),
              },
            ].map(({ Icon, title, text }, i) => (
              <li key={i} className="flex gap-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <Icon size={22} weight="duotone" aria-hidden />
                </span>
                <div>
                  <div className="text-xs font-medium text-ink-3">
                    <T en={`Step ${i + 1}`} bn={`ধাপ ${bnNum(i + 1)}`} />
                  </div>
                  <div className="mt-0.5 font-semibold text-ink">{title}</div>
                  <p className="mt-2 leading-relaxed text-ink-2">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex justify-end">
            <Link
              href="/methods"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              <Flask size={15} weight="duotone" aria-hidden />
              <T en="Read the full methodology" bn="পুরো পদ্ধতি পড়ুন" />
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </section>

        {/* ── Explore: destination cards ── */}
        <section aria-labelledby="explore-hdg" className="mb-24">
          <h2
            id="explore-hdg"
            className="text-2xl font-semibold tracking-tight text-ink"
          >
            <T en="Explore the data" bn="তথ্য অনুসন্ধান করুন" />
          </h2>
          <p className="mt-2 text-lg text-ink-2">
            <T
              en="Four tools, each answering one question. Pick the one that matches yours."
              bn="চারটি টুল, প্রতিটি একটি প্রশ্নের উত্তর দেয়। আপনার প্রশ্নের সাথে মেলে এমনটি বেছে নিন।"
            />
          </p>

          {/* Asymmetric grid: 3 columns on desktop */}
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* Satellite Map — large (2/3) */}
            <ToolCard tool={TOOLS[0]} className="md:col-span-2" />
            {/* Climate Trends — small (1/3) */}
            <ToolCard
              tool={TOOLS[1]}
              className="md:col-span-1"
              preview={
                <TrendPreview
                  series={tSeries}
                  warmed={warmer}
                  rainPct={rainPct(zone("bengal-delta"))}
                  first={first}
                  last={last}
                />
              }
            />
            {/* Disaster Risk — small (1/3) */}
            <ToolCard tool={TOOLS[2]} className="md:col-span-1" />
            {/* Place Reports — large (2/3) with live preview */}
            <ToolCard
              tool={TOOLS[3]}
              className="md:col-span-2"
              preview={
                <PlacePreview
                  name={<T en={dhaka.name} bn="ঢাকা" />}
                  warmed={
                    dhakaReport.temperature.annual
                      ? (dhakaReport.temperature.annual.trend.slopePerDecade *
                          (last - first)) /
                        10
                      : null
                  }
                  series={(dhakaReport.temperature.annual?.series ?? []).filter(
                    (v): v is number => v !== null,
                  )}
                  rainPct={
                    dhakaReport.rain.monsoon?.mean
                      ? (dhakaReport.rain.monsoon.trend.slopePerDecade /
                          dhakaReport.rain.monsoon.mean) *
                        100
                      : null
                  }
                  floods={dhakaReport.floods.count}
                  radiusKm={dhakaReport.floods.radiusKm}
                  first={first}
                />
              }
            />
          </div>

          {/* Secondary links */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Link
              href="/findings"
              className="group flex items-center gap-4 rounded-3xl bg-card p-5 shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                <BookOpen size={22} weight="duotone" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">
                  <T en="The story" bn="মূল গল্প" />
                </span>
                <span className="block text-sm leading-relaxed text-ink-2">
                  <T
                    en="Our five main findings, in plain words with charts."
                    bn="আমাদের পাঁচটি মূল ফলাফল, সহজ ভাষায়, চার্টসহ।"
                  />
                </span>
              </span>
              <ArrowRight
                size={18}
                className="shrink-0 text-accent transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href="/methods"
              className="group flex items-center gap-4 rounded-3xl bg-card p-5 shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Flask size={22} weight="duotone" aria-hidden />
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
              <ArrowRight
                size={18}
                className="shrink-0 text-accent transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

/* ─── Tool card ─────────────────────────────────────────────────────── */

function ToolCard({
  tool,
  preview,
  className = "",
}: {
  tool: Tool;
  preview?: React.ReactNode;
  className?: string;
}) {
  const { href, Icon, question, title, text, shot, tries } = tool;
  return (
    <article
      className={`group/card flex flex-col rounded-3xl bg-card p-2 shadow-soft transition-all hover:-translate-y-1 ${className}`}
    >
      <Link
        href={href}
        className="relative block aspect-16/10 overflow-hidden rounded-2xl bg-sunken"
        aria-label={title[0]}
        tabIndex={-1}
      >
        {shot ? (
          <>
            <Image
              src={`/features/${shot.name}-light.webp`}
              alt={shot.alt}
              fill
              sizes="(min-width: 1200px) 780px, (min-width: 768px) 66vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover/card:scale-[1.03] dark:hidden"
            />
            <Image
              src={`/features/${shot.name}-dark.webp`}
              alt={shot.alt}
              fill
              sizes="(min-width: 1200px) 780px, (min-width: 768px) 66vw, 100vw"
              className="hidden object-cover transition-transform duration-500 group-hover/card:scale-[1.03] dark:block"
            />
          </>
        ) : (
          preview
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-accent">
          <Icon size={18} weight="duotone" aria-hidden />
          <T en={question[0]} bn={question[1]} />
        </div>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">
          <Link
            href={href}
            className="inline-flex min-h-10 items-center gap-1.5 hover:text-accent"
          >
            <T en={title[0]} bn={title[1]} />
            <ArrowRight
              size={17}
              className="transition-transform group-hover/card:translate-x-0.5"
              aria-hidden
            />
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

/* ─── Homepage trend preview ───────────────────────────────────────── */

function TrendPreview({
  series,
  warmed,
  rainPct,
  first,
  last,
}: {
  series: number[];
  warmed: number;
  rainPct: number;
  first: number;
  last: number;
}) {
  const warmedText = formatSigned(warmed, 1);
  const rainText = formatSigned(rainPct, 0);

  return (
    <div className="flex h-full flex-col justify-between p-5 sm:p-6">
      <div>
        <div className="flex items-center justify-between gap-3 text-sm text-ink-3">
          <span>
            <T en="South Asia trend" bn="দক্ষিণ এশিয়ার প্রবণতা" />
          </span>
          <span className="tabular-nums">
            <T en={`${first}–${last}`} bn={`${bnNum(first)}–${bnNum(last)}`} />
          </span>
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          <T en={`${warmedText} °C`} bn={`${bnNum(warmedText)} °সে`} />
        </div>
        <div className="mt-1 text-sm text-ink-3">
          <T en={`warmer since ${first}`} bn={`${bnNum(first)} থেকে বেশি গরম`} />
        </div>
      </div>

      {series.length > 1 && (
        <div className="py-2">
          <Sparkline values={series} color="var(--warm-3)" />
          <div className="mt-1 flex justify-between text-xs tabular-nums text-ink-3">
            <span>{first}</span>
            <span>{last}</span>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-card/70 p-3">
          <dt className="text-ink-3">
            <T en="Heat trend" bn="তাপের প্রবণতা" />
          </dt>
          <dd
            className="mt-1 font-semibold tabular-nums"
            style={{ color: "var(--warm-4)" }}
          >
            <T en="Rising" bn="বাড়ছে" />
          </dd>
        </div>
        <div className="rounded-2xl bg-card/70 p-3">
          <dt className="text-ink-3">
            <T en="Delta rain" bn="ডেল্টার বৃষ্টি" />
          </dt>
          <dd className="mt-1 font-semibold tabular-nums text-[var(--cool-4)]">
            <T en={`${rainText}%/decade`} bn={`${bnNum(rainText)}%/দশক`} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ─── Dhaka live preview (place reports card) ─────────────────────── */

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
          <MapPin size={16} weight="fill" className="text-accent" aria-hidden />
          <T en="Place report" bn="শহরের রিপোর্ট" />
        </div>
        <div className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {name}
        </div>
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
            <T
              en={`Floods, ${radiusKm} km`}
              bn={`বন্যা, ${bnNum(radiusKm)} কিমি`}
            />
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">
            <T en={String(floods)} bn={bnNum(floods)} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ─── Key finding card ───────────────────────────────────────────────── */

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
    <Link
      href={href}
      className="group flex flex-col rounded-3xl bg-card p-8 shadow-soft transition-all hover:-translate-y-1"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-ink-2">
        {icon}
        {label}
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-ink">
        {value}
      </div>
      <p className="mt-3 flex-1 leading-relaxed text-ink-2">{note}</p>
      <span className="mt-5 text-sm font-medium text-accent group-hover:underline">
        <T en="Learn more →" bn="আরও জানুন →" />
      </span>
    </Link>
  );
}
