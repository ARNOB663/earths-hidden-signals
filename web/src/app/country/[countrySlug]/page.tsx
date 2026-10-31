import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  Drop,
  Fire,
  Hurricane,
  Mountains,
  Plant,
  Sun,
  Thermometer,
  Waves,
} from "@phosphor-icons/react/ssr";
import { CountryMapClient } from "@/components/country/CountryMapClient";
import { CountryTrends } from "@/components/country/CountryTrends";
import { ShareButton } from "@/components/ui/ShareButton";
import { Sureness } from "@/components/ui";
import { bnNum } from "@/lib/bn";
import {
  countriesFrom,
  countryBySlug,
  type Country,
  type CountrySignal,
} from "@/lib/countries";
import { buildCountryReport, type CountryHazard } from "@/lib/countryReport";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readManifest, readTrendGrid } from "@/lib/data";
import { getGibsCatalog } from "@/lib/gibs";
import { T } from "@/lib/i18n";
import { HAZARD_META } from "@/lib/hazards";
import type { FireGrid, FloodEvent, HazardZone, LandslideEvent } from "@/lib/hazards";
import { HAZARD_BN, ZONE_BN } from "@/lib/names";
import { colorLimit, formatSigned } from "@/lib/trends";

export const dynamicParams = false;
// Re-check NASA's catalog daily, like the satellite explorer.
export const revalidate = 86400;

async function allCountries() {
  const data = JSON.parse(
    await readFile(path.join(process.cwd(), "public/data/maps/place-signals.json"), "utf-8"),
  );
  return countriesFrom(data);
}

export async function generateStaticParams() {
  return (await allCountries()).map((c) => ({ countrySlug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/country/[countrySlug]">): Promise<Metadata> {
  const country = countryBySlug(await allCountries(), (await params).countrySlug);
  if (!country) return {};
  return {
    title: `${country.name} · Country dashboard · Earth's Hidden Signals`,
    description: `Observed climate trends, hazard exposure and satellite layers for ${country.name}, from NASA GISTEMP, GPCP, FIRMS and the project's hazard records.`,
  };
}

/** The four trend layers drawn from this project's own results. */
const TREND_LAYER_KEYS = [
  { key: "temperature_annual", variable: "temperature", label: "Warming trend", labelBn: "উষ্ণায়নের প্রবণতা" },
  { key: "rainfall_annual", variable: "rainfall", label: "Rainfall trend", labelBn: "বৃষ্টির প্রবণতা" },
  { key: "hot-months_annual", variable: "hot-months", label: "Very hot months", labelBn: "অতি গরম মাস" },
  { key: "dry-spell_annual", variable: "dry-spell", label: "Monsoon dry spells", labelBn: "বর্ষার খরা" },
] as const;

const HAZARD_ICON = { flood: Waves, cyclone: Hurricane, landslide: Mountains, wildfire: Fire } as const;

export default async function CountryPage({ params }: PageProps<"/country/[countrySlug]">) {
  const country = countryBySlug(await allCountries(), (await params).countrySlug);
  if (!country) notFound();

  const [report, manifest, catalog, hazardZones, slides, floods, fires] = await Promise.all([
    buildCountryReport(country),
    readManifest(),
    getGibsCatalog(),
    readFile(path.join(process.cwd(), "public/data/hazards/zones.json"), "utf-8").then((t) => (JSON.parse(t) as { zones: HazardZone[] }).zones),
    readFile(path.join(process.cwd(), "public/data/hazards/landslides.json"), "utf-8").then((t) => JSON.parse(t) as LandslideEvent[]),
    readFile(path.join(process.cwd(), "public/data/hazards/floods.json"), "utf-8").then((t) => JSON.parse(t) as FloodEvent[]),
    readFile(path.join(process.cwd(), "public/data/hazards/fires_grid.json"), "utf-8").then((t) => JSON.parse(t) as FireGrid),
  ]);

  const trendLayers = await Promise.all(
    TREND_LAYER_KEYS.map(async (l) => {
      const stats = await readTrendGrid(l.key);
      return {
        id: l.key,
        key: l.key,
        variable: l.variable,
        label: l.label,
        labelBn: l.labelBn,
        meta: manifest.variables[l.variable],
        grid: manifest.grids[l.variable],
        stats,
        limit: colorLimit(stats.slopePerDecade),
      };
    }),
  );

  // Only the hazard regions touched by this country, so the map tells the same story as section F.
  const regionIds = new Set(report.regions.map((r) => r.zone.id));
  const mapZones = hazardZones.filter((z) => z.id === "study-area" || regionIds.has(z.id));

  const countries = await allCountries();
  const neighbours = countries.filter((c) => c.slug !== country.slug);

  const [first, last] = report.years;
  const coastal = report.regions.filter((r) => r.zone.id === "bay-of-bengal" || r.zone.id === "arabian-sea");

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-10 sm:px-6">
      <Breadcrumb country={country} />

      {/* A. Country overview */}
      <header className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {country.flag && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://flagcdn.com/w80/${country.flag}.png`}
                alt=""
                width={48}
                height={36}
                className="h-9 w-12 rounded border border-line object-cover"
              />
            )}
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              <T en={country.name} bn={country.nameBn} />
            </h1>
            <ShareButton />
          </div>
          <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-ink-2">
            <T
              en={`What ${first}–${last} of observations show for ${country.name}: how fast it is warming, how rainfall is changing, where hazards concentrate, and which NASA layers you can inspect yourself.`}
              bn={`${bnNum(first)}–${bnNum(last)} সালের পর্যবেক্ষণ ${country.name} সম্পর্কে যা দেখায়: কত দ্রুত উষ্ণ হচ্ছে, বৃষ্টি কীভাবে বদলাচ্ছে, দুর্যোগ কোথায় বেশি, আর কোন নাসা স্তর নিজে দেখতে পারবেন।`}
            />
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            <Tag>{`${first}–${last}`}</Tag>
            <Tag>{country.signals["temperature_annual"] ? "GISTEMP v4 · 2° grid" : "Temperature: not available"}</Tag>
            <Tag>{country.signals["rainfall_annual"] ? "GPCP v2.3 · 2.5° grid" : "Rainfall: not available"}</Tag>
            <Tag>{`Data updated ${report.generated}`}</Tag>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <IndicatorCard
            signal={report.temperature}
            icon="temperature"
            title={<T en="Temperature anomaly" bn="তাপমাত্রার অস্বাভাবিকতা" />}
            unit="°C"
            anomaly
          />
          <IndicatorCard
            signal={report.rainfall}
            icon="rain"
            title={<T en="Rainfall trend" bn="বৃষ্টির প্রবণতা" />}
            unit="mm"
          />
        </div>
      </header>

      {/* B. Interactive map */}
      <Section id="map" label={<T en="Explore the map" bn="মানচিত্র ঘুরে দেখুন" />} title={<T en="Country map and satellite layers" bn="দেশের মানচিত্র ও স্যাটেলাইট স্তর" />}>
        <CountryMapClient
          country={country}
          data={{ trendLayers, zones: mapZones, landslides: slides, floods, fires }}
          dates={catalog["lst-day"]?.dates ?? []}
        />
        <p className="mt-3 text-sm text-ink-3">
          <T
            en="Trend layers are this project's own gridded results, shown for grid cells whose centre lies inside the border. Satellite layers are live NASA GIBS imagery; their month slider lists only months NASA has published."
            bn="প্রবণতা স্তর এই প্রকল্পের নিজস্ব গ্রিড ফলাফল, সীমান্তের ভিতরের বর্গে দেখানো। স্যাটেলাইট স্তর নাসা GIBS-এর সরাসরি চিত্র।"
          />
        </p>
      </Section>

      {/* C. Climate trends */}
      <Section id="trends" label={<T en="Climate trends" bn="জলবায়ুর প্রবণতা" />} title={<T en="How the climate has changed" bn="জলবায়ু কীভাবে বদলেছে" />}>
        <CountryTrends country={country} />
      </Section>

      {/* D. Risks */}
      <Section id="risks" label={<T en="Environmental and disaster risks" bn="পরিবেশ ও দুর্যোগের ঝুঁকি" />} title={<T en="What the records show" bn="তথ্য কী দেখায়" />}>
        <p className="mb-5 max-w-[70ch] text-ink-2">
          <T
            en="Each card separates what was observed from what the data cannot say. A region is an approximate ecological box, not an administrative boundary; an event count is a record, not a forecast."
            bn="প্রতিটি কার্ডে আলাদা করা আছে কোনটি পর্যবেক্ষণ আর কোনটি তথ্যে বলা সম্ভব নয়। অঞ্চল হলো আনুমানিক পরিবেশগত এলাকা, প্রশাসনিক সীমা নয়।"
          />
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {report.hazards.map((h) => (
            <HazardCard key={h.id} hazard={h} />
          ))}
          <UnsupportedRisk
            icon={<Sun size={18} />}
            title={<T en="Heatwaves" bn="তাপপ্রবাহ" />}
            detail={
              <T
                en="No heatwave dataset is included in this project, so no heatwave count or exposure class is shown. The related measure that is available is very hot months (section C)."
                bn="এই প্রকল্পে তাপপ্রবাহের কোনো তথ্যসেট নেই, তাই তাপপ্রবাহের সংখ্যা বা ঝুঁকি দেখানো হয় না। সম্পর্কিত যে পরিমাপ আছে তা হলো অতি গরম মাস (অংশ গ)।"
              />
            }
          />
          <UnsupportedRisk
            icon={<Plant size={18} />}
            title={<T en="Droughts" bn="খরা" />}
            detail={
              <T
                en="There is no soil-moisture or drought index in the country datasets. The longest monsoon dry spell is shown instead (section C), measured from daily rain."
                bn="দেশভিত্তিক তথ্যে মাটির আর্দ্রতা বা খরার সূচক নেই। এর বদলে বর্ষার দীর্ঘতম খরা দেখানো হয়েছে (অংশ গ)।"
              />
            }
          />
        </div>
      </Section>

      {/* E. Environmental change */}
      <Section id="change" label={<T en="Environmental change" bn="পরিবেশগত পরিবর্তন" />} title={<T en="Land, vegetation and coasts" bn="ভূমি, উদ্ভিদ ও উপকূল" />}>
        <div className="grid gap-4 md:grid-cols-2">
          <ChangeCard
            title={<T en="Vegetation and land cover" bn="উদ্ভিদ ও ভূমির ধরন" />}
            available={<T en="NASA MODIS NDVI monthly imagery" bn="নাসা মোডিস NDVI মাসিক চিত্র" />}
            note={
              <T
                en="Greenness is available as a satellite layer on the map above (choose “Greenness”). It is an image product, so this page does not turn it into a trend number."
                bn="সবুজত্ব উপরের মানচিত্রে স্যাটেলাইট স্তর হিসেবে আছে (“সবুজত্ব”)। এটি চিত্র, তাই এখানে সংখ্যায় প্রবণতা দেখানো হয় না।"
              />
            }
          />
          <ChangeCard
            title={<T en="Forest loss" bn="বনভূমি হারানো" />}
            available={<T en="Hansen/UMD Global Forest Change via Global Forest Watch" bn="হ্যানসেন/ইউএমডি গ্লোবাল ফরেস্ট চেঞ্জ" />}
            note={
              <T
                en="Tree-cover loss since 2001 is shown as a map layer. The project does not publish per-country loss totals, so none are stated here."
                bn="২০০১ সালের পরের বনভূমি হারানো মানচিত্র স্তরে দেখা যায়। প্রতি দেশের মোট সংখ্যা প্রকাশ করা হয় না।"
              />
            }
          />
          <ChangeCard
            title={<T en="Water bodies" bn="জলাশয়" />}
            available={null}
            note={
              <T
                en="No water-body dataset is included. Rainfall and dry-spell changes (section C) are the closest available evidence."
                bn="জলাশয়ের কোনো তথ্য নেই। বৃষ্টি ও খরার পরিবর্তন (অংশ গ) সবচেয়ে কাছের প্রমাণ।"
              />
            }
          />
          <ChangeCard
            title={<T en="Coastal change" bn="উপকূলের পরিবর্তন" />}
            available={
              coastal.length > 0 ? (
                <T en={`Sea regions touching this country: ${coastal.map((r) => r.zone.name).join(", ")}`} bn="দেশের সংলগ্ন সমুদ্র অঞ্চল" />
              ) : null
            }
            note={
              coastal.length > 0 ? (
                <T
                  en="The project has no coastline or sea-level dataset. What it does record for the adjacent sea is cyclone exposure (section D); nothing here measures coastal erosion or flooding of the coast."
                  bn="এই প্রকল্পে উপকূল বা সমুদ্রপৃষ্ঠের তথ্য নেই। সংলগ্ন সমুদ্রের জন্য আছে ঘূর্ণিঝড়ের ঝুঁকি (অংশ ঘ)।"
                />
              ) : (
                <T
                  en="This country has no marine region in the project's hazard boxes, and no coastline or sea-level dataset is included."
                  bn="এই দেশের জন্য কোনো সমুদ্র অঞ্চল নেই, আর উপকূল বা সমুদ্রপৃষ্ঠের তথ্যও নেই।"
                />
              )
            }
          />
        </div>
      </Section>

      {/* F. Regional breakdown */}
      <Section id="regions" label={<T en="Regional breakdown" bn="অঞ্চলভিত্তিক বিবরণ" />} title={<T en="Regions and cities" bn="অঞ্চল ও শহর" />}>
        <Regions report={report} />
      </Section>

      {/* G. Key findings */}
      <Section id="findings" label={<T en="Key findings" bn="মূল ফলাফল" />} title={<T en="What this means for the country" bn="এটি দেশের জন্য কী বোঝায়" />}>
        <ol className="space-y-3">
          {report.findings.map((f, i) => (
            <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 text-ink-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-ink">{i + 1}</span>
              <span className="leading-relaxed">{f}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg border border-line bg-card p-4 text-sm text-ink-3">
          <T
            en="These statements repeat values computed above; they are not model output or predictions. Confidence for each trend is the Mann–Kendall p-value with the false-discovery-rate correction."
            bn="এই বাক্যগুলো উপরের গণনা করা মান পুনরাবৃত্তি করে; এগুলো কোনো মডেলের ভবিষ্যদ্বাণী নয়।"
          />
        </p>
      </Section>

      <section aria-labelledby="other-countries" className="mt-16 border-t border-line pt-8">
        <h2 id="other-countries" className="text-lg font-semibold text-ink">
          <T en="Other countries in the study" bn="অন্যান্য দেশ" />
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {neighbours.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/country/${c.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-sm text-ink-2 hover:border-ink-3 hover:text-ink"
              >
                {c.flag && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://flagcdn.com/w40/${c.flag}.png`} alt="" width={20} height={15} className="rounded-sm" />
                )}
                <T en={c.name} bn={c.nameBn} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Breadcrumb({ country }: { country: Country }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
      <Link href="/" className="hover:text-ink"><T en="Home" bn="হোম" /></Link>
      <span aria-hidden> / </span>
      <Link href="/countries" className="hover:text-ink"><T en="Countries" bn="দেশ" /></Link>
      <span aria-hidden> / </span>
      <span className="text-ink-2">{country.name}</span>
    </nav>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-sunken px-3 py-1 text-ink-2">{children}</span>;
}

function Section({ id, label, title, children }: { id: string; label: React.ReactNode; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-14 scroll-mt-20">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{label}</p>
      <h2 id={`${id}-title`} className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function IndicatorCard({
  signal,
  title,
  unit,
  anomaly = false,
  icon,
}: {
  signal: CountrySignal | null;
  title: React.ReactNode;
  unit: string;
  anomaly?: boolean;
  icon: "temperature" | "rain";
}) {
  const Icon = icon === "temperature" ? Thermometer : Drop;
  if (!signal?.trend) {
    return (
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="flex items-center gap-2 text-sm text-ink-3"><Icon size={16} /> {title}</p>
        <p className="mt-2 text-sm text-ink-3"><T en="Not available for this country." bn="এই দেশের জন্য তথ্য নেই।" /></p>
      </div>
    );
  }
  const years = signal.years;
  const total = (signal.trend.slopePerDecade * (years.at(-1)! - years[0])) / 10;
  const mean = signal.series.reduce((a, v) => a + v, 0) / signal.series.length;
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="flex items-center gap-2 text-sm text-ink-3"><Icon size={16} className="text-accent" /> {title}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">
        {formatSigned(total, anomaly ? 1 : 0)}
        <span className="ml-1 text-base font-normal text-ink-3">{unit}</span>
      </p>
      <p className="text-sm text-ink-2">
        <T en="change since" bn="পরিবর্তন" /> {years[0]} · {formatSigned(signal.trend.slopePerDecade, anomaly ? 2 : 0)} {unit}{" "}
        <T en="per decade" bn="প্রতি দশকে" />
      </p>
      {!anomaly && (
        <p className="mt-1 text-xs text-ink-3">
          {mean.toFixed(0)} mm <T en="average per year" bn="গড় বার্ষিক" />
        </p>
      )}
      <div className="mt-3">
        <Sureness p={signal.trend.p} />
      </div>
    </div>
  );
}

function HazardCard({ hazard }: { hazard: CountryHazard }) {
  const Icon = HAZARD_ICON[hazard.id];
  const meta = HAZARD_META[hazard.id];
  const bn = HAZARD_BN[hazard.id];
  const e = hazard.events;
  return (
    <article className="rounded-2xl border border-line bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold text-ink">
        <Icon size={18} className="text-accent" />
        <T en={meta.label} bn={bn?.label ?? meta.label} />
      </h3>
      <p className="mt-2 text-sm text-ink-2"><T en={meta.intro} bn={bn?.intro ?? meta.intro} /></p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-3">{e.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
            {e.count === null ? <T en="No data" bn="তথ্য নেই" /> : e.count.toLocaleString("en-GB")}
          </dd>
          <dd className="text-xs text-ink-3">{e.period}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-3">
            <T en="Covered regions" bn="অঞ্চল" />
          </dt>
          <dd className="mt-0.5 text-ink-2">
            {hazard.zones.length === 0 ? (
              <T en="None in this country" bn="এই দেশে নেই" />
            ) : (
              hazard.zones.map((r) => (
                <span key={r.zone.id} className="block">
                  <T en={r.zone.name} bn={ZONE_BN[r.zone.id]?.name ?? r.zone.name} />{" "}
                  <span className="text-ink-3">({Math.round(r.countryShare * 100)}%)</span>
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>

      {e.deaths !== undefined && e.deaths > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          <T en="Deaths reported in the catalog:" bn="ক্যাটালগে মৃত্যু:" /> <span className="font-medium tabular-nums text-ink">{e.deaths.toLocaleString("en-GB")}</span>
        </p>
      )}
      {e.severe !== undefined && e.severe > 0 && (
        <p className="mt-1 text-sm text-ink-2">
          <T en="Severe (severe tropical storm or stronger):" bn="তীব্র:" /> <span className="font-medium tabular-nums text-ink">{e.severe}</span>
        </p>
      )}
      <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">
        <T en="Source:" bn="সূত্র:" /> {e.source}
        {e.latest && <> · <T en="latest record" bn="সর্বশেষ" /> {e.latest}</>}
      </p>
      <p className="mt-1 text-xs font-medium text-ink-3">
        <T en="Historical observations — not a forecast." bn="ঐতিহাসিক পর্যবেক্ষণ — পূর্বাভাস নয়।" />
      </p>
    </article>
  );
}

function UnsupportedRisk({ icon, title, detail }: { icon: React.ReactNode; title: React.ReactNode; detail: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-dashed border-line bg-sunken p-5">
      <h3 className="flex items-center gap-2 font-semibold text-ink-2">{icon}{title}</h3>
      <p className="mt-2 text-sm text-ink-3">{detail}</p>
      <p className="mt-3 text-xs font-medium text-ink-3">
        <T en="Not available in this dataset." bn="এই তথ্যসেটে নেই।" />
      </p>
    </article>
  );
}

function ChangeCard({ title, available, note }: { title: React.ReactNode; available: React.ReactNode; note: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-line bg-card p-5">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-xs uppercase tracking-wide text-ink-3">
        {available ?? <T en="Not included" bn="অন্তর্ভুক্ত নয়" />}
      </p>
      <p className="mt-2 text-sm text-ink-2">{note}</p>
    </article>
  );
}

function Regions({ report }: { report: Awaited<ReturnType<typeof buildCountryReport>> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {report.regions.map((r) => {
        const t = r.trends["temperature_annual"];
        const rain = r.trends["rainfall_annual"];
        return (
          <article key={r.zone.id} className="rounded-2xl border border-line bg-card p-5">
            <h3 className="font-semibold text-ink"><T en={r.zone.name} bn={ZONE_BN[r.zone.id]?.name ?? r.zone.name} /></h3>
            <p className="mt-1 text-sm text-ink-3">
              <T en={`overlaps about ${Math.round(r.countryShare * 100)}% of the country`} bn={`দেশের প্রায় ${bnNum(Math.round(r.countryShare * 100))}% জুড়ে`} />
            </p>
            <p className="mt-2 text-sm text-ink-2">
              <T en={r.zone.description} bn={ZONE_BN[r.zone.id]?.description ?? r.zone.description} />
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-3"><T en="Warming" bn="উষ্ণায়ন" /></dt>
                <dd className="tabular-nums text-ink">
                  {t ? `${formatSigned(t.slopePerDecade, 2)} °C/dec` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-3"><T en="Rainfall" bn="বৃষ্টি" /></dt>
                <dd className="tabular-nums text-ink">
                  {rain ? `${formatSigned(rain.slopePerDecade, 0)} mm/dec` : "—"}
                </dd>
              </div>
            </dl>
            {r.cities.length > 0 && (
              <p className="mt-3 text-xs text-ink-3">
                <T en="Cities inside:" bn="শহর:" /> {r.cities.map((c) => c.name).join(", ")}
              </p>
            )}
            <p className="mt-2 text-xs text-ink-3">
              <T en={`${r.zone.eventSource} · ${r.zone.years[0]}–${r.zone.years.at(-1)}`} bn={`${r.zone.eventSource} · ${bnNum(r.zone.years[0])}–${bnNum(r.zone.years.at(-1)!)}`} />
            </p>
            <Link href={`/hazards?hazard=${r.zone.hazard}&zone=${r.zone.id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              <T en="Full region record" bn="পুরো অঞ্চলের তথ্য" /> <ArrowUpRight size={14} />
            </Link>
          </article>
        );
      })}
      {report.regions.length === 0 && (
        <p className="text-sm text-ink-3">
          <T en="No hazard region from this project overlaps the country." bn="এই প্রকল্পের কোনো দুর্যোগ অঞ্চল দেশটির সঙ্গে মেলে না।" />
        </p>
      )}
    </div>
  );
}
