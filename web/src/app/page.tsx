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
import { readHazardZones, readManifest, readTrendZones } from "@/lib/data";
import { preparednessSignal } from "@/lib/hazards";
import { formatSigned, type Zone } from "@/lib/trends";

const EXPLORE = [
  { href: "/findings", title: "Read the story", text: "Five findings, explained in simple words with charts and maps.", Icon: BookOpen },
  { href: "/explore", title: "Satellite map", text: "Watch heat, rain, greenness and forest loss change month by month.", Icon: MapTrifold },
  { href: "/trends", title: "Climate trends", text: "Click any place to see if it is getting hotter, wetter or drier.", Icon: ChartLineUp },
  { href: "/hazards", title: "Disaster risk", text: "See which regions look like past flood, landslide or fire years.", Icon: Warning },
];

export default async function Home() {
  const [manifest, trendZones, hazardZones] = await Promise.all([readManifest(), readTrendZones(), readHazardZones()]);
  const years = manifest.years;
  const [first, last] = [years[0], years[years.length - 1]];
  const zone = (id: string) => trendZones.find((z) => z.id === id)!;

  const study = zone("study-area");
  const tTrend = study.results["temperature_annual"].trend!;
  const tSeries = study.results["temperature_annual"].series as number[];
  const warmer = (tTrend.slopePerDecade * (last - first)) / 10;
  const temp = manifest.summaries["temperature_annual"];

  const rainPct = (z: Zone) => {
    const r = z.results["rainfall_monsoon"];
    return (r.trend!.slopePerDecade / r.mean) * 100;
  };
  const watch = hazardZones.filter((h) => preparednessSignal(h).kind === "resembles");

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 pb-16 pt-14 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
        <div>
          <p className="text-sm font-medium text-accent">NASA Space Apps Challenge 2026</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
            See how South Asia&apos;s climate is changing.
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ink-2">
            {years.length} years of NASA data, explained simply: where it is getting hotter, where the rain is moving, and
            which places should get ready for floods, landslides and fires.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/findings"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
            >
              Read the story <ArrowRight size={18} />
            </Link>
            <Link href="/explore" className="font-medium text-accent hover:underline">
              Open the satellite map
            </Link>
          </div>
        </div>

        <Link
          href="/trends?var=temperature&season=annual&zone=study-area"
          className="group rounded-3xl bg-card p-7 shadow-soft transition-transform hover:-translate-y-0.5"
        >
          <p className="text-sm text-ink-2">South Asia today, compared with {first}</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-6xl font-semibold tracking-tight tabular-nums text-ink">{formatSigned(warmer, 1)} °C</span>
            <span className="text-ink-2">warmer</span>
          </div>
          <div className="mt-6">
            <Sparkline values={tSeries} color="var(--warm-3)" />
            <div className="mt-1 flex justify-between text-xs text-ink-3">
              <span>{first}</span>
              <span>{last}</span>
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-ink-2">
            All {temp.cells} squares of our map got warmer; not one got cooler.{" "}
            <span className="font-medium text-accent group-hover:underline">See the trend →</span>
          </p>
        </Link>
      </section>

      {/* In one minute */}
      <section aria-labelledby="minute">
        <h2 id="minute" className="text-2xl font-semibold tracking-tight text-ink">
          In one minute
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Fact
            href="/findings#spring"
            label="Spring heats fastest"
            value={`${formatSigned(manifest.summaries["temperature_pre-monsoon"].medianSlopePerDecade, 2)} °C`}
            note="every 10 years in March–May, the hot weeks before the monsoon, and faster still in the mountains."
          />
          <Fact
            href="/findings#rain"
            label="The rain is moving"
            value={`${formatSigned(rainPct(zone("indus-plain")), 0)}% · ${formatSigned(rainPct(zone("central-himalaya")), 0)}%`}
            note="monsoon rain every 10 years: the dry northwest gets more, the mountains and the east get less."
            icon={<CloudRain size={20} className="text-accent" />}
          />
          <Fact
            href="/hazards"
            label={`Places to watch in ${last}`}
            value={`${watch.length} regions`}
            note={`${watch.map((w) => w.name).join(" and ")} had weather like past disaster years.`}
            icon={<WarningCircle size={20} className="text-watch" />}
          />
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mt-24">
        <h2 id="how" className="text-2xl font-semibold tracking-tight text-ink">
          How it works
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            {
              Icon: Planet,
              title: "Satellites measure",
              text: `NASA satellites and records track temperature, rain, forests and fires across South Asia since ${first}.`,
            },
            {
              Icon: ChartLineUp,
              title: "We check what is real",
              text: "Statistics separate a real long-term change from the normal ups and downs of the weather.",
            },
            {
              Icon: Warning,
              title: "We link it to disasters",
              text: "We compare the weather with past floods, landslides and fires, to show where to prepare.",
            },
          ].map(({ Icon, title, text }, i) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Icon size={22} weight="duotone" />
              </span>
              <div>
                <div className="text-sm text-ink-3">Step {i + 1}</div>
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
          Explore
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {EXPLORE.map(({ href, title, text, Icon }) => (
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
                  {title}
                  <ArrowRight size={16} className="opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-1 leading-relaxed text-ink-2">{text}</p>
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
  label: string;
  value: string;
  note: string;
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
      <span className="mt-4 text-sm font-medium text-accent group-hover:underline">Learn more →</span>
    </Link>
  );
}
