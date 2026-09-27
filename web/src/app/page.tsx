import Link from "next/link";
import { readHazardZones, readManifest, readTrendZones } from "@/lib/data";
import { HAZARD_META, preparednessSignal } from "@/lib/hazards";
import { ALPHA, formatSigned } from "@/lib/trends";

const MODULES = [
  { href: "/explore", title: "Map Explorer", text: "NASA satellite imagery of heat, rain, greenness and forest loss, month by month since 2000." },
  { href: "/trends", title: "Trend Analysis", text: "Where temperature and rainfall are changing, how fast, and whether it is significant." },
  { href: "/hazards", title: "Hazard Signals", text: "How those trends connect to floods, landslides and wildfires, region by region." },
  { href: "/methods", title: "Methods", text: "Data, statistics and limitations: how we know a trend is real." },
];

export default async function Home() {
  const [manifest, trendZones, hazardZones] = await Promise.all([readManifest(), readTrendZones(), readHazardZones()]);
  const [first, last] = [manifest.years[0], manifest.years[manifest.years.length - 1]];

  const temp = manifest.summaries["temperature_annual"];
  const studyTemp = trendZones.find((z) => z.id === "study-area")!.results["temperature_annual"].trend!;
  const rain = manifest.summaries["rainfall_monsoon"];

  const rainZones = trendZones
    .filter((z) => z.hazard)
    .map((z) => ({ name: z.name, t: z.results["rainfall_monsoon"].trend }))
    .filter((z) => z.t && z.t.p < ALPHA);
  const wetter = rainZones.filter((z) => z.t!.slopePerDecade > 0).map((z) => z.name);
  const drier = rainZones.filter((z) => z.t!.slopePerDecade < 0).map((z) => z.name);
  const signals = hazardZones.filter((z) => preparednessSignal(z).kind === "resembles");

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
        NASA data to show what is changing across South Asia, where, how fast, and whether it is real.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/trends" className="rounded-md bg-sky-500 px-4 py-2.5 text-sm font-medium text-[#04121d] hover:bg-sky-400">
          See the trends
        </Link>
        <Link href="/explore" className="rounded-md border border-white/15 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5">
          Open the Map Explorer
        </Link>
      </div>

      <h2 className="mt-16 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        What we found · {first}–{last}
      </h2>
      <div className="mt-3 grid gap-px overflow-hidden rounded-lg bg-white/10 lg:grid-cols-3">
        <Finding
          href="/trends?var=temperature&season=annual&zone=study-area"
          label="Warming everywhere"
          value={`${formatSigned(studyTemp.slopePerDecade, 2)} °C`}
          unit="per decade"
        >
          {temp.significantIncrease} of {temp.cells} land cells warmed significantly and none cooled. Across the region that
          adds up to about {formatSigned((studyTemp.slopePerDecade * (last - first)) / 10, 1)} °C since {first}.
        </Finding>
        <Finding
          href="/trends?var=rainfall&season=monsoon"
          label="Monsoon rain splits"
          value={`${rain.significantIncrease} wetter · ${rain.significantDecrease} drier`}
          unit="grid cells with significant change"
        >
          The same warming, opposite responses. Wetter: {wetter.join(", ") || "none"}. Drier: {drier.join(", ") || "none"}.
          Most cells ({rain.cells - rain.significantIncrease - rain.significantDecrease}) show no detectable trend.
        </Finding>
        <Finding
          href={signals[0] ? `/hazards?hazard=${signals[0].hazard}&zone=${signals[0].id}` : "/hazards"}
          label={`Preparedness signals for ${last}`}
          value={`${signals.length} region${signals.length === 1 ? "" : "s"}`}
          unit="match past high-event years"
        >
          {signals.length
            ? `${signals.map((z) => `${z.name} (${HAZARD_META[z.hazard].label.toLowerCase()})`).join(" and ")}: this year's conditions resemble those in past high-event years. Evidence for readiness, not a forecast.`
            : "No region currently matches past high-event conditions."}
        </Finding>
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

function Finding({
  href,
  label,
  value,
  unit,
  children,
}: {
  href: string;
  label: string;
  value: string;
  unit: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="block bg-[#0e141b] p-5 transition-colors hover:bg-[#121a23]">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</div>
      <div className="text-xs text-slate-500">{unit}</div>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{children}</p>
    </Link>
  );
}
