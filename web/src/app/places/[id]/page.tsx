import { ArrowRight, CheckCircle, CloudRain, Fire, Hurricane, Mountains, Question, Thermometer, Warning, Waves } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Locator } from "@/components/places/Locator";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { SeriesChart } from "@/components/trends/SeriesChart";
import { Numbers, Stat, Sureness } from "@/components/ui";
import { readManifest, readTrendGrid } from "@/lib/data";
import { HAZARD_META, preparednessSignal, type HazardZone } from "@/lib/hazards";
import { buildPlaceReport, type PlaceTrend } from "@/lib/placeReport";
import { placeById, PLACES } from "@/lib/places";
import { formatP, formatSigned, type Manifest } from "@/lib/trends";

export const dynamicParams = false;

export function generateStaticParams() {
  return PLACES.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/places/[id]">): Promise<Metadata> {
  const place = placeById((await params).id);
  return place
    ? {
        title: `${place.name} · Earth's Hidden Signals`,
        description: `How the climate is changing in ${place.name}, ${place.country}: temperature, rain and nearby disasters since 1981.`,
      }
    : {};
}

const HAZARD_ICON = { flood: Waves, landslide: Mountains, wildfire: Fire, cyclone: Hurricane } as const;

export default async function PlacePage({ params }: PageProps<"/places/[id]">) {
  const place = placeById((await params).id);
  if (!place) notFound();
  const [report, manifest, land] = await Promise.all([buildPlaceReport(place), readManifest(), readTrendGrid("temperature_annual")]);
  const years = manifest.years;
  const [first, last] = [years[0], years[years.length - 1]];
  const { temperature: t, rain: r } = report;

  // One plain-language summary sentence per topic.
  const warmSentence = t.annual
    ? t.annual.trend.p < 0.05
      ? `${place.name} has warmed by about ${formatSigned((t.annual.trend.slopePerDecade * (last - first)) / 10, 1)} °C since ${first}.`
      : `${place.name} shows no clear warming trend since ${first}.`
    : null;
  const rainPct = r.monsoon && r.monsoon.mean ? (r.monsoon.trend.slopePerDecade / r.monsoon.mean) * 100 : null;
  const rainSentence = r.monsoon
    ? r.monsoon.trend.p < 0.05
      ? `Its rainy-season rain is ${r.monsoon.trend.slopePerDecade > 0 ? "rising" : "falling"} by about ${Math.abs(rainPct ?? 0).toFixed(0)}% every 10 years.`
      : "Its rainy-season rain shows no clear change."
    : null;

  return (
    <article className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
        <Link href="/places" className="hover:text-ink">
          Places
        </Link>{" "}
        / <span className="text-ink-2">{place.name}</span>
      </nav>

      <header className="mt-4 grid gap-8 md:grid-cols-[1fr_280px] md:items-center">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{place.name}</h1>
          <p className="mt-1 text-lg text-ink-2">{place.country}</p>
          <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-ink [&>span]:block [&>span]:mt-1">
            {warmSentence && <span>{warmSentence}</span>}
            {rainSentence && <span>{rainSentence}</span>}
            {report.zones.length > 0 && (
              <span>
                It lies in the {report.zones.map((z) => z.name).join(" and ")}{" "}
                {report.zones.length > 1 ? "regions" : `${HAZARD_META[report.zones[0].hazard].label.toLowerCase().replace(/s$/, "")} region`}.
              </span>
            )}
          </p>
        </div>
        <div className="rounded-3xl bg-card p-4 shadow-soft">
          <Locator grid={manifest.grids.temperature} land={land} lat={place.lat} lon={place.lon} label={place.name} />
        </div>
      </header>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <TrendCard
          title="Temperature"
          icon={<Thermometer size={22} weight="duotone" />}
          main={t.annual}
          mainLabel="Whole year"
          second={t.hot}
          secondLabel="Hot season (March–May)"
          unit="°C"
          decimals={2}
          up="Getting warmer"
          down="Getting cooler"
          axisLabel="°C warmer than the 1951–1980 average"
          zeroLine
          manifest={manifest}
          placeName={place.name}
          variable="temperature"
        />
        <TrendCard
          title="Rain"
          icon={<CloudRain size={22} weight="duotone" />}
          main={r.monsoon}
          mainLabel="Rainy season (June–September)"
          second={r.annual}
          secondLabel="Whole year"
          unit="mm"
          decimals={0}
          up="Getting wetter"
          down="Getting drier"
          axisLabel="mm of rain in the rainy season"
          zeroLine={false}
          manifest={manifest}
          placeName={place.name}
          variable="rainfall"
        />
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Disasters around {place.name}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <EventCard
            icon={<Waves size={22} weight="duotone" />}
            title="Floods"
            big={`${report.floods.count}`}
            text={`flood alerts within ${report.floods.radiusKm} km since 2000${report.floods.severe ? `, ${report.floods.severe} of them serious or severe` : ""}.`}
            extra={report.floods.latest ? `Most recent: ${report.floods.latest.date.slice(0, 7)}.` : null}
          />
          <EventCard
            icon={<Mountains size={22} weight="duotone" />}
            title="Landslides"
            big={`${report.landslides.count}`}
            text={`reported landslides within ${report.landslides.radiusKm} km (2007–2017)${report.landslides.deaths ? `, ${report.landslides.deaths} people died` : ""}.`}
            extra={
              report.landslides.deadliest?.fatalities
                ? `Deadliest: ${report.landslides.deadliest.fatalities} people died, ${new Date(`${report.landslides.deadliest.date}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}.`
                : null
            }
          />
          <EventCard
            icon={<Fire size={22} weight="duotone" />}
            title="Fires"
            big={report.firesPerYear !== null ? `${Math.round(report.firesPerYear)}` : "few"}
            text="fires a year seen by satellite nearby in March–May (2003–2024 average)."
            extra={null}
          />
        </div>

        {report.zones.length > 0 && (
          <div className="mt-6 space-y-3">
            {report.zones.map((z) => (
              <ZoneStatus key={z.id} zone={z} lastYear={last} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12 flex flex-wrap items-center gap-4">
        <Link
          href={`/trends?var=temperature&season=annual&lat=${place.lat}&lon=${place.lon}`}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
        >
          See {place.name} on the trends map <ArrowRight size={18} />
        </Link>
        <Link href={`/explore?layer=lst-day&date=2024-05-01&compare=2001`} className="font-medium text-accent hover:underline">
          Compare 2001 and 2024 on the satellite map
        </Link>
      </section>

      <section className="mt-16">
        <h2 className="text-lg font-semibold text-ink">Look up another place</h2>
        <div className="mt-3">
          <PlaceSearch />
        </div>
      </section>
    </article>
  );
}

function TrendCard({
  title,
  icon,
  main,
  mainLabel,
  second,
  secondLabel,
  unit,
  decimals,
  up,
  down,
  axisLabel,
  zeroLine,
  manifest,
  placeName,
  variable,
}: {
  title: string;
  icon: React.ReactNode;
  main: PlaceTrend | null;
  mainLabel: string;
  second: PlaceTrend | null;
  secondLabel: string;
  unit: string;
  decimals: number;
  up: string;
  down: string;
  axisLabel: string;
  zeroLine: boolean;
  manifest: Manifest;
  placeName: string;
  variable: "temperature" | "rainfall";
}) {
  if (!main) {
    return (
      <section className="rounded-3xl bg-card p-6 shadow-soft">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-ink-2">No data for this place.</p>
      </section>
    );
  }
  const real = main.trend.p < 0.05;
  const word = real ? (main.trend.slopePerDecade > 0 ? up : down) : "No clear change";
  const secondReal = second ? second.trend.p < 0.05 : false;
  const pct = !zeroLine && main.mean ? (main.trend.slopePerDecade / main.mean) * 100 : null;
  return (
    <section className="rounded-3xl bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">{icon}</span>
        <div>
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <p className="text-sm text-ink-3">{mainLabel}</p>
        </div>
      </div>
      <div className="mt-5 text-lg font-semibold text-ink">{word}</div>
      <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-ink">
        {formatSigned(main.trend.slopePerDecade, decimals)} {unit}
      </div>
      <div className="text-ink-2">
        every 10 years{pct !== null && ` (${formatSigned(pct, 1)}% of the usual amount)`}
      </div>
      <div className="mt-3">
        <Sureness p={main.trend.p} />
      </div>
      {second && (
        <p className="mt-3 text-sm text-ink-2">
          {secondLabel}: {secondReal ? `${formatSigned(second.trend.slopePerDecade, decimals)} ${unit} every 10 years` : "no clear change"}.
        </p>
      )}
      <div className="mt-5">
        <SeriesChart
          years={manifest.years}
          values={main.series}
          slopePerDecade={main.trend.slopePerDecade}
          lowerPerDecade={main.trend.lowerPerDecade}
          upperPerDecade={main.trend.upperPerDecade}
          unit={unit}
          decimals={decimals}
          axisLabel={axisLabel}
          zeroLine={zeroLine}
          title={`${placeName} ${title.toLowerCase()} ${mainLabel.toLowerCase()}`}
        />
      </div>
      <div className="mt-4">
        <Numbers>
          <dl>
            <Stat label="Rate (Sen's slope)" value={`${formatSigned(main.trend.slopePerDecade, decimals + 1)} ${unit}/decade`} />
            <Stat label="95% range" value={`${formatSigned(main.trend.lowerPerDecade, decimals + 1)} to ${formatSigned(main.trend.upperPerDecade, decimals + 1)}`} />
            <Stat label="p-value (modified Mann–Kendall)" value={formatP(main.trend.p)} />
            <Stat label="Passes the map-wide check (FDR)" value={main.clear ? "Yes" : "No"} />
            <Stat label="Map square used" value={`${main.cellLat.toFixed(2)}°N, ${main.cellLon.toFixed(2)}°E (${main.km} km from the city)`} />
            <Stat label="Data" value={manifest.variables[variable].dataset} />
          </dl>
        </Numbers>
      </div>
    </section>
  );
}

function EventCard({ icon, title, big, text, extra }: { icon: React.ReactNode; title: string; big: string; text: string; extra: string | null }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 font-semibold text-ink">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <div className="mt-3 text-4xl font-semibold tabular-nums text-ink">{big}</div>
      <p className="mt-1 leading-relaxed text-ink-2">{text}</p>
      {extra && <p className="mt-2 text-sm text-ink-3">{extra}</p>}
    </div>
  );
}

function ZoneStatus({ zone, lastYear }: { zone: HazardZone; lastYear: number }) {
  const s = preparednessSignal(zone).kind;
  const Icon = HAZARD_ICON[zone.hazard];
  const status =
    s === "resembles"
      ? { text: `Watch: ${lastYear} weather looked like past big ${HAZARD_META[zone.hazard].label.toLowerCase()} years.`, StatusIcon: Warning, cls: "bg-watch-soft", iconCls: "text-watch" }
      : s === "not-resembling"
        ? { text: `Normal in ${lastYear}: the weather wasn't like past big ${HAZARD_META[zone.hazard].label.toLowerCase()} years.`, StatusIcon: CheckCircle, cls: "bg-card", iconCls: "text-good" }
        : { text: `No clear weather link for ${HAZARD_META[zone.hazard].label.toLowerCase()} in this region.`, StatusIcon: Question, cls: "bg-card", iconCls: "text-ink-3" };
  return (
    <Link
      href={`/hazards?hazard=${zone.hazard}&zone=${zone.id}`}
      className={`flex items-start gap-3 rounded-2xl p-4 shadow-soft transition-transform hover:-translate-y-0.5 ${status.cls}`}
    >
      <status.StatusIcon size={22} weight="fill" className={`mt-0.5 shrink-0 ${status.iconCls}`} />
      <div>
        <div className="flex items-center gap-2 font-medium text-ink">
          <Icon size={16} /> {zone.name}
        </div>
        <p className="mt-0.5 text-sm text-ink-2">{status.text}</p>
      </div>
      <ArrowRight size={18} className="ml-auto mt-1 shrink-0 text-accent" />
    </Link>
  );
}
