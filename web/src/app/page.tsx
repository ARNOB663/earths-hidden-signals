import {
  ArrowRight,
  BookOpen,
  ChartLineUp,
  CloudRain,
  MapTrifold,
  Planet,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Sparkline } from "@/components/findings/parts";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { bnMonth, bnNum } from "@/lib/bn";
import { readHazardZones, readLatest, readManifest, readTrendZones } from "@/lib/data";
import { preparednessSignal } from "@/lib/hazards";
import { T } from "@/lib/i18n";
import { zoneNameBn } from "@/lib/names";
import { formatSigned, type Zone } from "@/lib/trends";

const EXPLORE = [
  {
    href: "/findings",
    title: "Read the story",
    bn: "মূল গল্প পড়ুন",
    text: "Five findings, explained in simple words with charts and maps.",
    textBn: "পাঁচটি ফলাফল, সহজ ভাষায়, চার্ট ও মানচিত্রসহ।",
    Icon: BookOpen,
  },
  {
    href: "/explore",
    title: "Satellite map",
    bn: "স্যাটেলাইট মানচিত্র",
    text: "Watch heat, rain, greenness and forest loss change month by month.",
    textBn: "মাসে মাসে তাপ, বৃষ্টি, সবুজের পরিমাণ ও বন উজাড় কীভাবে বদলায় দেখুন।",
    Icon: MapTrifold,
  },
  {
    href: "/trends",
    title: "Climate trends",
    bn: "জলবায়ুর প্রবণতা",
    text: "Click any place to see if it is getting hotter, wetter or drier.",
    textBn: "যেকোনো জায়গায় ক্লিক করে দেখুন সেখানে গরম, বৃষ্টি বা শুষ্কতা বাড়ছে কি না।",
    Icon: ChartLineUp,
  },
  {
    href: "/hazards",
    title: "Disaster risk",
    bn: "দুর্যোগের ঝুঁকি",
    text: "See which regions look like past flood, landslide, fire or cyclone years.",
    textBn: "কোন অঞ্চলের আবহাওয়া আগের বন্যা, ভূমিধস, আগুন বা ঘূর্ণিঝড়ের বছরের মতো, দেখুন।",
    Icon: Warning,
  },
];

export default async function Home() {
  const [manifest, trendZones, hazardZones, latest] = await Promise.all([
    readManifest(),
    readTrendZones(),
    readHazardZones(),
    readLatest(),
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
  const rainValue = `${formatSigned(rainPct(zone("indus-plain")), 0)}% · ${formatSigned(rainPct(zone("bengal-delta")), 0)}%`;
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
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
            >
              <T en="Read the story" bn="মূল গল্প পড়ুন" /> <ArrowRight size={18} />
            </Link>
            <Link href="/explore" className="font-medium text-accent hover:underline">
              <T en="Open the satellite map" bn="স্যাটেলাইট মানচিত্র খুলুন" />
            </Link>
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

      {/* The latest month */}
      <section aria-labelledby="latest" className="mb-16">
        <h2 id="latest" className="text-2xl font-semibold tracking-tight text-ink">
          <T en="The latest month" bn="সর্বশেষ মাস" />
        </h2>
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
            value={<T en={rainValue} bn={bnNum(rainValue)} />}
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

      {/* Explore */}
      <section aria-labelledby="explore" className="mt-24">
        <h2 id="explore" className="text-2xl font-semibold tracking-tight text-ink">
          <T en="Explore" bn="ঘুরে দেখুন" />
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {EXPLORE.map(({ href, title, bn, text, textBn, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-3xl bg-card p-6 shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sunken text-ink transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                <Icon size={24} />
              </span>
              <div>
                <div className="flex items-center gap-1.5 text-lg font-semibold text-ink">
                  <T en={title} bn={bn} />
                  <ArrowRight size={16} className="opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-1 leading-relaxed text-ink-2">
                  <T en={text} bn={textBn} />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
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
