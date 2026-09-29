import { ArrowRight, CheckCircle, CloudRain, Fire, Hurricane, Mountains, Question, Thermometer, Warning, Waves } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Locator } from "@/components/places/Locator";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { SeriesChart } from "@/components/trends/SeriesChart";
import { Numbers, Stat, Sureness } from "@/components/ui";
import { bnMonth, bnNum } from "@/lib/bn";
import { readManifest, readTrendGrid } from "@/lib/data";
import { HAZARD_META, preparednessSignal, type HazardZone } from "@/lib/hazards";
import { T } from "@/lib/i18n";
import { COUNTRY_BN, HAZARD_BN, PLACE_BN, ZONE_BN } from "@/lib/names";
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
  const nameBn = PLACE_BN[place.id] ?? place.name;

  // One plain-language summary sentence per topic.
  const warmed = t.annual ? formatSigned((t.annual.trend.slopePerDecade * (last - first)) / 10, 1) : "";
  const warmSentence = t.annual ? (
    t.annual.trend.p < 0.05 ? (
      <T
        en={`${place.name} has warmed by about ${warmed} °C since ${first}.`}
        bn={`${bnNum(first)} সালের পর থেকে ${nameBn} প্রায় ${bnNum(warmed)} °সে গরম হয়েছে।`}
      />
    ) : (
      <T
        en={`${place.name} shows no clear warming trend since ${first}.`}
        bn={`${bnNum(first)} সালের পর থেকে ${nameBn}-এ উষ্ণ হওয়ার স্পষ্ট প্রবণতা নেই।`}
      />
    )
  ) : null;
  const rainPct = r.monsoon && r.monsoon.mean ? (r.monsoon.trend.slopePerDecade / r.monsoon.mean) * 100 : null;
  const rising = r.monsoon ? r.monsoon.trend.slopePerDecade > 0 : false;
  const pctText = Math.abs(rainPct ?? 0).toFixed(0);
  const rainSentence = r.monsoon ? (
    r.monsoon.trend.p < 0.05 ? (
      <T
        en={`Its rainy-season rain is ${rising ? "rising" : "falling"} by about ${pctText}% every 10 years.`}
        bn={`এখানে বর্ষার বৃষ্টি প্রতি ১০ বছরে প্রায় ${bnNum(pctText)}% করে ${rising ? "বাড়ছে" : "কমছে"}।`}
      />
    ) : (
      <T en="Its rainy-season rain shows no clear change." bn="এখানে বর্ষার বৃষ্টিতে স্পষ্ট কোনো পরিবর্তন নেই।" />
    )
  ) : null;
  const deadliest = report.landslides.deadliest;

  return (
    <article className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
        <Link href="/places" className="hover:text-ink">
          <T en="Places" bn="জায়গা" />
        </Link>{" "}
        /{" "}
        <span className="text-ink-2">
          <T en={place.name} bn={nameBn} />
        </span>
      </nav>

      <header className="mt-4 grid gap-8 md:grid-cols-[1fr_280px] md:items-center">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            <T en={place.name} bn={nameBn} />
          </h1>
          <p className="mt-1 text-lg text-ink-2">
            <T en={place.country} bn={COUNTRY_BN[place.country] ?? place.country} />
          </p>
          <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-ink [&>span]:block [&>span]:mt-1">
            {warmSentence && <span>{warmSentence}</span>}
            {rainSentence && <span>{rainSentence}</span>}
            {report.zones.length > 0 && (
              <span>
                <T
                  en={`It lies in the ${report.zones.map((z) => z.name).join(" and ")} ${
                    report.zones.length > 1 ? "regions" : `${HAZARD_META[report.zones[0].hazard].label.toLowerCase().replace(/s$/, "")} region`
                  }.`}
                  bn={`এটি ${report.zones.map((z) => `${ZONE_BN[z.id]?.name ?? z.name} (${HAZARD_BN[z.hazard].label})`).join(" ও ")} অঞ্চলে পড়ে।`}
                />
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
          titleBn="তাপমাত্রা"
          icon={<Thermometer size={22} weight="duotone" />}
          main={t.annual}
          mainLabel="Whole year"
          mainLabelBn="সারা বছর"
          second={t.hot}
          secondLabel={<T en="Hot season (March–May)" bn="গরমকাল (মার্চ–মে)" />}
          unit="°C"
          decimals={2}
          up={<T en="Getting warmer" bn="গরম হচ্ছে" />}
          down={<T en="Getting cooler" bn="ঠান্ডা হচ্ছে" />}
          axisLabel="°C warmer than the 1951–1980 average"
          axisLabelBn="১৯৫১–১৯৮০ সালের গড়ের চেয়ে কত °সে বেশি"
          zeroLine
          manifest={manifest}
          placeName={place.name}
          variable="temperature"
        />
        <TrendCard
          title="Rain"
          titleBn="বৃষ্টি"
          icon={<CloudRain size={22} weight="duotone" />}
          main={r.monsoon}
          mainLabel="Rainy season (June–September)"
          mainLabelBn="বর্ষাকাল (জুন–সেপ্টেম্বর)"
          second={r.annual}
          secondLabel={<T en="Whole year" bn="সারা বছর" />}
          unit="mm"
          decimals={0}
          up={<T en="Getting wetter" bn="বৃষ্টি বাড়ছে" />}
          down={<T en="Getting drier" bn="শুষ্ক হচ্ছে" />}
          axisLabel="mm of rain in the rainy season"
          axisLabelBn="বর্ষাকালে কত মিমি বৃষ্টি"
          zeroLine={false}
          manifest={manifest}
          placeName={place.name}
          variable="rainfall"
        />
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          <T en={`Disasters around ${place.name}`} bn={`${nameBn}-এর আশপাশের দুর্যোগ`} />
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <EventCard
            icon={<Waves size={22} weight="duotone" />}
            title={<T en="Floods" bn="বন্যা" />}
            big={report.floods.count}
            text={
              <T
                en={`flood alerts within ${report.floods.radiusKm} km since 2000${report.floods.severe ? `, ${report.floods.severe} of them serious or severe` : ""}.`}
                bn={`টি বন্যা সতর্কতা, ২০০০ সাল থেকে ${bnNum(report.floods.radiusKm)} কিমির মধ্যে${report.floods.severe ? `; এর ${bnNum(report.floods.severe)}টি গুরুতর বা ভয়াবহ` : ""}।`}
              />
            }
            extra={
              report.floods.latest ? (
                <T
                  en={`Most recent: ${report.floods.latest.date.slice(0, 7)}.`}
                  bn={`সর্বশেষ: ${bnMonth(report.floods.latest.date)}।`}
                />
              ) : null
            }
          />
          <EventCard
            icon={<Mountains size={22} weight="duotone" />}
            title={<T en="Landslides" bn="ভূমিধস" />}
            big={report.landslides.count}
            text={
              <T
                en={`reported landslides within ${report.landslides.radiusKm} km (2007–2017)${report.landslides.deaths ? `, ${report.landslides.deaths} people died` : ""}.`}
                bn={`টি ভূমিধসের খবর, ${bnNum(report.landslides.radiusKm)} কিমির মধ্যে (২০০৭–২০১৭)${report.landslides.deaths ? `; ${bnNum(report.landslides.deaths)} জন মারা গেছেন` : ""}।`}
              />
            }
            extra={
              deadliest?.fatalities ? (
                <T
                  en={`Deadliest: ${deadliest.fatalities} people died, ${new Date(`${deadliest.date}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}.`}
                  bn={`সবচেয়ে প্রাণঘাতী: ${bnMonth(deadliest.date)}, ${bnNum(deadliest.fatalities)} জন মারা যান।`}
                />
              ) : null
            }
          />
          <EventCard
            icon={<Fire size={22} weight="duotone" />}
            title={<T en="Fires" bn="আগুন" />}
            big={report.firesPerYear !== null ? Math.round(report.firesPerYear) : null}
            text={
              <T
                en="fires a year seen by satellite nearby in March–May (2003–2024 average)."
                bn="টি আগুন প্রতি বছর মার্চ–মে মাসে কাছাকাছি স্যাটেলাইটে দেখা যায় (২০০৩–২০২৪ সালের গড়)।"
              />
            }
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
          <T en={`See ${place.name} on the trends map`} bn={`প্রবণতার মানচিত্রে ${nameBn} দেখুন`} /> <ArrowRight size={18} />
        </Link>
        <Link href={`/explore?layer=lst-day&date=2024-05-01&compare=2001`} className="font-medium text-accent hover:underline">
          <T en="Compare 2001 and 2024 on the satellite map" bn="স্যাটেলাইট মানচিত্রে ২০০১ ও ২০২৪ তুলনা করুন" />
        </Link>
      </section>

      <section className="mt-16">
        <h2 className="text-lg font-semibold text-ink">
          <T en="Look up another place" bn="অন্য জায়গা খুঁজুন" />
        </h2>
        <div className="mt-3">
          <PlaceSearch />
        </div>
      </section>
    </article>
  );
}

function TrendCard({
  title,
  titleBn,
  icon,
  main,
  mainLabel,
  mainLabelBn,
  second,
  secondLabel,
  unit,
  decimals,
  up,
  down,
  axisLabel,
  axisLabelBn,
  zeroLine,
  manifest,
  placeName,
  variable,
}: {
  title: string;
  titleBn: string;
  icon: React.ReactNode;
  main: PlaceTrend | null;
  mainLabel: string;
  mainLabelBn: string;
  second: PlaceTrend | null;
  secondLabel: React.ReactNode;
  unit: string;
  decimals: number;
  up: React.ReactNode;
  down: React.ReactNode;
  axisLabel: string;
  axisLabelBn: string;
  zeroLine: boolean;
  manifest: Manifest;
  placeName: string;
  variable: "temperature" | "rainfall";
}) {
  if (!main) {
    return (
      <section className="min-w-0 rounded-3xl bg-card p-6 shadow-soft">
        <h2 className="text-xl font-semibold text-ink">
          <T en={title} bn={titleBn} />
        </h2>
        <p className="mt-2 text-ink-2">
          <T en="No data for this place." bn="এই জায়গার কোনো তথ্য নেই।" />
        </p>
      </section>
    );
  }
  const real = main.trend.p < 0.05;
  const word = real ? (main.trend.slopePerDecade > 0 ? up : down) : <T en="No clear change" bn="স্পষ্ট পরিবর্তন নেই" />;
  const unitBn = unit === "°C" ? "°সে" : "মিমি";
  const rate = formatSigned(main.trend.slopePerDecade, decimals);
  const secondReal = second ? second.trend.p < 0.05 : false;
  const pct = !zeroLine && main.mean ? (main.trend.slopePerDecade / main.mean) * 100 : null;
  return (
    <section className="min-w-0 rounded-3xl bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">{icon}</span>
        <div>
          <h2 className="text-xl font-semibold text-ink">
            <T en={title} bn={titleBn} />
          </h2>
          <p className="text-sm text-ink-3">
            <T en={mainLabel} bn={mainLabelBn} />
          </p>
        </div>
      </div>
      <div className="mt-5 text-lg font-semibold text-ink">{word}</div>
      <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-ink">
        <T en={`${rate} ${unit}`} bn={`${bnNum(rate)} ${unitBn}`} />
      </div>
      <div className="text-ink-2">
        <T
          en={`every 10 years${pct !== null ? ` (${formatSigned(pct, 1)}% of the usual amount)` : ""}`}
          bn={`প্রতি ১০ বছরে${pct !== null ? ` (স্বাভাবিক পরিমাণের ${bnNum(formatSigned(pct, 1))}%)` : ""}`}
        />
      </div>
      <div className="mt-3">
        <Sureness p={main.trend.p} />
      </div>
      {second && (
        <p className="mt-3 text-sm text-ink-2">
          {secondLabel}:{" "}
          {secondReal ? (
            <T
              en={`${formatSigned(second.trend.slopePerDecade, decimals)} ${unit} every 10 years.`}
              bn={`প্রতি ১০ বছরে ${bnNum(formatSigned(second.trend.slopePerDecade, decimals))} ${unitBn}।`}
            />
          ) : (
            <T en="no clear change." bn="স্পষ্ট পরিবর্তন নেই।" />
          )}
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
          axisLabelBn={axisLabelBn}
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

function EventCard({
  icon,
  title,
  big,
  text,
  extra,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  big: number | null;
  text: React.ReactNode;
  extra: React.ReactNode | null;
}) {
  return (
    <div className="min-w-0 rounded-3xl bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 font-semibold text-ink">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <div className="mt-3 text-4xl font-semibold tabular-nums text-ink">
        {big === null ? <T en="few" bn="অল্প" /> : <T en={String(big)} bn={bnNum(big)} />}
      </div>
      <p className="mt-1 leading-relaxed text-ink-2">{text}</p>
      {extra && <p className="mt-2 text-sm text-ink-3">{extra}</p>}
    </div>
  );
}

function ZoneStatus({ zone, lastYear }: { zone: HazardZone; lastYear: number }) {
  const s = preparednessSignal(zone).kind;
  const Icon = HAZARD_ICON[zone.hazard];
  const label = HAZARD_META[zone.hazard].label.toLowerCase();
  const bn = HAZARD_BN[zone.hazard];
  const status =
    s === "resembles"
      ? {
          text: (
            <T
              en={`Watch: ${lastYear} weather looked like past big ${label} years.`}
              bn={`নজর দিন: ${bnNum(lastYear)} সালের আবহাওয়া আগের ${bn.bigYears}গুলোর মতো ছিল।`}
            />
          ),
          StatusIcon: Warning,
          cls: "bg-watch-soft",
          iconCls: "text-watch",
        }
      : s === "not-resembling"
        ? {
            text: (
              <T
                en={`Normal in ${lastYear}: the weather wasn't like past big ${label} years.`}
                bn={`${bnNum(lastYear)} সালে স্বাভাবিক: আবহাওয়া আগের ${bn.bigYears}গুলোর মতো ছিল না।`}
              />
            ),
            StatusIcon: CheckCircle,
            cls: "bg-card",
            iconCls: "text-good",
          }
        : {
            text: (
              <T
                en={`No clear weather link for ${label} in this region.`}
                bn={`এই অঞ্চলে ${bn.label}-এর সাথে আবহাওয়ার স্পষ্ট যোগসূত্র নেই।`}
              />
            ),
            StatusIcon: Question,
            cls: "bg-card",
            iconCls: "text-ink-3",
          };
  return (
    <Link
      href={`/hazards?hazard=${zone.hazard}&zone=${zone.id}`}
      className={`flex items-start gap-3 rounded-2xl p-4 shadow-soft transition-transform hover:-translate-y-0.5 ${status.cls}`}
    >
      <status.StatusIcon size={22} weight="fill" className={`mt-0.5 shrink-0 ${status.iconCls}`} />
      <div>
        <div className="flex items-center gap-2 font-medium text-ink">
          <Icon size={16} /> <T en={zone.name} bn={ZONE_BN[zone.id]?.name ?? zone.name} />
        </div>
        <p className="mt-0.5 text-sm text-ink-2">{status.text}</p>
      </div>
      <ArrowRight size={18} className="ml-auto mt-1 shrink-0 text-accent" />
    </Link>
  );
}
