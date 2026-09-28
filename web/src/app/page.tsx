import Link from "next/link";
import { Confidence, Sparkline } from "@/components/findings/parts";
import { readHazardZones, readManifest, readTrendZones } from "@/lib/data";
import { HAZARD_META, preparednessSignal } from "@/lib/hazards";
import { formatSigned, type Zone } from "@/lib/trends";

const MODULES = [
  { href: "/findings", title: "Findings", text: "The full story: each result explained in simple words and in scientific detail, with charts." },
  { href: "/explore", title: "Map Explorer", text: "NASA satellite imagery of heat, rain, greenness and forest loss, month by month since 2000." },
  { href: "/trends", title: "Trend Analysis", text: "Click anywhere in South Asia: which way it's changing, how fast, and whether it's significant." },
  { href: "/hazards", title: "Hazard Signals", text: "How those trends connect to floods, landslides and wildfires, region by region." },
];

export default async function Home() {
  const [manifest, trendZones, hazardZones] = await Promise.all([readManifest(), readTrendZones(), readHazardZones()]);
  const years = manifest.years;
  const [first, last] = [years[0], years[years.length - 1]];
  const zone = (id: string) => trendZones.find((z) => z.id === id)!;

  const study = zone("study-area");
  const tTrend = study.results["temperature_annual"].trend!;
  const tSeries = study.results["temperature_annual"].series as number[];
  const hottest = years[tSeries.indexOf(Math.max(...tSeries))];
  const temp = manifest.summaries["temperature_annual"];

  const pre = manifest.summaries["temperature_pre-monsoon"].medianSlopePerDecade;
  const mon = manifest.summaries["temperature_monsoon"].medianSlopePerDecade;

  const rain = manifest.summaries["rainfall_monsoon"];
  const rainPct = (z: Zone) => {
    const r = z.results["rainfall_monsoon"];
    return (r.trend!.slopePerDecade / r.mean) * 100;
  };
  const indus = zone("indus-plain");
  const himalaya = zone("central-himalaya");

  const linked = hazardZones.filter((h) => h.drivers.some((d) => d.linked));
  const signals = hazardZones.filter((h) => preparednessSignal(h).kind === "resembles");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-400">
        NASA Space Apps 2026 · Be An Earth System Trend Detective
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
        Earth&apos;s hidden signals, decoded before disaster.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
        One warming planet, different responses: drying in some places, wetter monsoons in others, heat everywhere. We use
        NASA data to show what is changing across South Asia, where, how fast, and whether it is real, and then what it
        means for floods, landslides and wildfires.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/findings" className="rounded-md bg-sky-500 px-4 py-2.5 text-sm font-medium text-[#04121d] hover:bg-sky-400">
          Read our findings
        </Link>
        <Link href="/trends" className="rounded-md border border-white/15 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5">
          Explore the trends
        </Link>
      </div>

      <div className="mt-16 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            What we found · {first}–{last}
          </h2>
          <p className="mt-1 text-sm text-slate-400">Five findings, each with how sure we are. Click any card for the full explanation.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <FindingCard
          href="/findings#warming"
          n={1}
          title="South Asia is warming, everywhere"
          value={`${formatSigned(tTrend.slopePerDecade, 2)} °C per decade`}
          visual={<Sparkline values={tSeries} color="#e34948" />}
          visualLabel={`Region temperature, ${first}–${last}`}
          meaning={`All ${temp.cells} land squares warmed and none cooled: about ${formatSigned(
            (tTrend.slopePerDecade * (last - first)) / 10,
            1,
          )} °C since ${first}. ${hottest} was the hottest year on record.`}
          confidence={<Confidence level="high" reason="Every square, NASA's official record." />}
        />
        <FindingCard
          href="/findings#seasons"
          n={2}
          title="The heat rises fastest before the monsoon"
          value={`${formatSigned(pre, 2)} vs ${formatSigned(mon, 2)} °C`}
          visual={
            <div className="space-y-1.5 pt-1">
              <MiniBar label="Mar–May" value={pre} max={0.4} color="#e34948" />
              <MiniBar label="Jun–Sep" value={mon} max={0.4} color="#a32d2d" />
            </div>
          }
          visualLabel="Typical warming per decade by season"
          meaning="March–May, already the hottest and driest weeks, is warming fastest, and fastest of all in the mountains. That means longer, fiercer fire seasons and more heat stress on crops."
          confidence={<Confidence level="high" reason="Every region warms in spring." />}
        />
        <FindingCard
          href="/findings#rain"
          n={3}
          title="Same warming, opposite rain"
          value={`${rain.significantIncrease} wetter · ${rain.significantDecrease} drier squares`}
          visual={
            <div className="space-y-1.5 pt-1">
              <MiniBar label="Indus plain" value={rainPct(indus)} max={15} color="#3987e5" suffix="%" />
              <MiniBar label="Central Himalaya" value={rainPct(himalaya)} max={15} color="#e34948" suffix="%" />
            </div>
          }
          visualLabel="Monsoon rain change per decade"
          meaning={`Total monsoon rain barely changed, but it is shifting: the dry northwest gets about ${formatSigned(
            rainPct(indus),
            0,
          )}% more per decade, while the east and the mountains get less. One process, opposite trends.`}
          confidence={<Confidence level="medium" reason="Strong in several regions; rain varies a lot." />}
        />
        <FindingCard
          href="/findings#disasters"
          n={4}
          title="Disasters follow the weather"
          value={`${linked.length} regions with a real link`}
          visual={
            <ul className="space-y-1 pt-1 text-xs text-slate-300">
              {linked.map((h) => (
                <li key={h.id} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: HAZARD_COLOR[h.hazard] }} />
                  {h.name}: {HAZARD_META[h.hazard].label.toLowerCase()} ↔ {h.drivers.find((d) => d.linked)!.label.toLowerCase()}
                </li>
              ))}
            </ul>
          }
          visualLabel="Statistically significant links"
          meaning="Hot springs line up with big fire years; wet monsoons with landslide and flood years. Where the weather doesn't explain disasters, like floods in the drying Bengal delta, that's a finding too."
          confidence={<Confidence level="medium" reason="Real links, but short records." />}
        />
        <FindingCard
          href="/findings#watch"
          n={5}
          title={`${last}: what to watch`}
          value={`${signals.length} region${signals.length === 1 ? "" : "s"} matched past disaster years`}
          visual={
            <ul className="space-y-1 pt-1 text-xs text-slate-300">
              {signals.map((h) => {
                const d = h.drivers.find((x) => x.linked)!;
                return (
                  <li key={h.id} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: HAZARD_COLOR[h.hazard] }} />
                    {h.name}: {d.label.toLowerCase()} at the {d.latest.percentile}th percentile
                  </li>
                );
              })}
            </ul>
          }
          visualLabel={`Preparedness signals, ${last}`}
          meaning="This year's conditions look like the years when these disasters happened before. That's a reason to prepare early (monitoring, supplies, warnings), not a forecast that disaster will strike."
          confidence={<Confidence level="medium" reason="Built on the links in finding 4." />}
        />
        <Link
          href="/findings#limits"
          className="flex flex-col justify-between rounded-lg bg-sky-400/[0.06] p-5 ring-1 ring-sky-400/25 transition-colors hover:bg-sky-400/10"
        >
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">Our take</div>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-200">
              The warming is certain and everywhere. What changes from place to place is how it shows up: drying here,
              heavier rain there, fiercer fire seasons elsewhere. Local, season-by-season trends, checked for significance,
              tell a community what to prepare for.
            </p>
          </div>
          <span className="mt-4 text-sm text-sky-300">What we can&apos;t say yet →</span>
        </Link>
      </div>

      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href} className="group rounded-lg bg-[#0e141b] p-5 ring-1 ring-white/10 hover:ring-sky-400/40">
            <div className="font-medium text-white group-hover:text-sky-300">{m.title} →</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{m.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

const HAZARD_COLOR = { flood: "#3987e5", landslide: "#eda100", wildfire: "#d95926" } as const;

function FindingCard({
  href,
  n,
  title,
  value,
  visual,
  visualLabel,
  meaning,
  confidence,
}: {
  href: string;
  n: number;
  title: string;
  value: string;
  visual: React.ReactNode;
  visualLabel: string;
  meaning: string;
  confidence: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg bg-[#0e141b] p-5 ring-1 ring-white/10 transition-colors hover:bg-[#121a23] hover:ring-sky-400/40"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-400">Finding {n}</div>
      <div className="mt-1 text-lg font-semibold text-white">{title}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</div>
      <div className="mt-3 rounded-md bg-[#0b0f14] p-3 ring-1 ring-white/5">
        {visual}
        <div className="mt-1.5 text-[11px] text-slate-500">{visualLabel}</div>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-300">{meaning}</p>
      <div className="mt-3">{confidence}</div>
      <span className="mt-3 text-sm text-sky-400 group-hover:text-sky-300">Read the full explanation →</span>
    </Link>
  );
}

function MiniBar({ label, value, max, color, suffix = "" }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const w = Math.min(100, (Math.abs(value) / max) * 100);
  return (
    <div className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 text-xs">
      <span className="truncate text-slate-400">{label}</span>
      <div className="h-2.5 rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
      </div>
      <span className="text-right font-mono tabular-nums text-slate-200">
        {formatSigned(value, suffix ? 1 : 2)}
        {suffix}
      </span>
    </div>
  );
}
