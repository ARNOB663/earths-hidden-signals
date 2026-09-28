import { ArrowRight, CloudRain, Lightbulb, Question, Thermometer, UsersThree } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { MiniGridMap } from "@/components/findings/MiniGridMap";
import { EventDriverChart, PercentileBar, RegionBars, type RegionBar } from "@/components/findings/parts";
import { SeriesChart } from "@/components/trends/SeriesChart";
import { Dots, Numbers, Sureness } from "@/components/ui";
import { readHazardZones, readManifest, readTrendGrid, readTrendZones } from "@/lib/data";
import { preparednessSignal, type HazardZone } from "@/lib/hazards";
import { colorLimit, formatP, formatSigned, type Zone } from "@/lib/trends";

export const metadata: Metadata = {
  title: "The story · Earth's Hidden Signals",
  description: "Five things 45 years of NASA data show about heat, rain and disasters in South Asia, explained simply.",
};

const EVENT_COLOR = { flood: "var(--ev-flood)", landslide: "var(--ev-landslide)", wildfire: "var(--ev-fire)" } as const;

export default async function StoryPage() {
  const [manifest, trendZones, hazardZones, tempGrid, rainGrid] = await Promise.all([
    readManifest(),
    readTrendZones(),
    readHazardZones(),
    readTrendGrid("temperature_annual"),
    readTrendGrid("rainfall_monsoon"),
  ]);
  const years = manifest.years;
  const [first, last] = [years[0], years[years.length - 1]];
  const zone = (id: string) => trendZones.find((z) => z.id === id)!;
  const hz = (id: string) => hazardZones.find((z) => z.id === id)!;
  const trendOf = (z: Zone, key: string) => z.results[key].trend!;
  const tMeta = manifest.variables.temperature;
  const rMeta = manifest.variables.rainfall;

  // 1. Warming
  const study = zone("study-area");
  const tStudy = trendOf(study, "temperature_annual");
  const tSeries = study.results["temperature_annual"].series as number[];
  const hottest = years[tSeries.indexOf(Math.max(...tSeries))];
  const tempSum = manifest.summaries["temperature_annual"];
  const sinceStart = (tStudy.slopePerDecade * (last - first)) / 10;

  // 2. Spring heats fastest
  const regionIds = trendZones.filter((z) => z.hazard).map((z) => z.id);
  const preBars: RegionBar[] = regionIds.map((id) => {
    const t = trendOf(zone(id), "temperature_pre-monsoon");
    return { name: zone(id).name, value: t.slopePerDecade, significant: t.p < 0.05 };
  });
  const fastest = [...preBars].sort((a, b) => b.value - a.value)[0];
  const slowest = [...preBars].sort((a, b) => a.value - b.value)[0];
  const tFastest = trendOf(zone(regionIds.find((id) => zone(id).name === fastest.name)!), "temperature_pre-monsoon");
  const seasonMedian = (s: string) => manifest.summaries[`temperature_${s}`].medianSlopePerDecade;

  // 3. Rain is moving
  const rainPct = (z: Zone) => {
    const r = z.results["rainfall_monsoon"];
    return (r.trend!.slopePerDecade / r.mean) * 100;
  };
  const rainBars: RegionBar[] = regionIds.map((id) => ({
    name: zone(id).name,
    value: rainPct(zone(id)),
    significant: trendOf(zone(id), "rainfall_monsoon").p < 0.05,
  }));
  const wettest = [...rainBars].sort((a, b) => b.value - a.value)[0];
  const driest = [...rainBars].filter((b) => b.significant).sort((a, b) => a.value - b.value)[0];
  const tWettest = trendOf(zone(regionIds.find((id) => zone(id).name === wettest.name)!), "rainfall_monsoon");
  const rainSum = manifest.summaries["rainfall_monsoon"];
  const rainPctGrid = rainGrid.slopePerDecade.map((s, k) => (s === null || !rainGrid.mean[k] ? null : (s / rainGrid.mean[k]!) * 100));
  const rainLimit = colorLimit(rainPctGrid);

  // 4. Disasters follow the weather
  const driverSeries = (h: HazardZone, key: string) => {
    const s = zone(h.id).results[key].series as number[];
    return h.years.map((y) => s[years.indexOf(y)]);
  };
  const fires = hz("central-india-forests");
  const slides = hz("western-himalaya");
  const floods = hz("indus-plain");
  const rel = (h: HazardZone) => h.drivers.find((d) => d.linked)!.relationship!;
  const linkedCount = hazardZones.filter((h) => h.drivers.some((d) => d.linked)).length;

  // 5. This year
  const signalDriver = (h: HazardZone) => h.drivers.find((d) => d.linked)!;
  const watchList = hazardZones.filter((h) => preparednessSignal(h).kind === "resembles");

  return (
    <article className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-12 sm:px-6">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-accent">
          The story · {first} to {last}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Five things NASA data tell us about South Asia
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          Each finding is explained in simple words first. The exact numbers are there too, for anyone who wants them.
        </p>
      </header>

      <nav aria-label="Findings" className="mt-8 flex flex-wrap gap-2">
        {[
          ["warming", "1. Getting warmer"],
          ["spring", "2. Spring heats fastest"],
          ["rain", "3. Rain is moving"],
          ["disasters", "4. Disasters follow the weather"],
          ["watch", `5. ${last}: places to watch`],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full bg-card px-4 py-2 text-sm text-ink-2 shadow-soft transition-colors hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      <Finding
        id="warming"
        n={1}
        icon={<Thermometer size={22} weight="duotone" />}
        title="South Asia is getting warmer, everywhere"
        big={`${formatSigned(sinceStart, 1)} °C`}
        bigNote={`warmer than in ${first}`}
        story={
          <>
            <p>
              Since {first}, the whole region has warmed by about {formatSigned(sinceStart, 1)} °C. That is a steady climb of
              about a third of a degree every 10 years.
            </p>
            <p>
              All <strong>{tempSum.cells} squares</strong> on our map got warmer, and not one got cooler. {hottest} was the
              hottest year on record.
            </p>
          </>
        }
        why="Gases from burning coal, oil and gas trap heat, like a blanket around the Earth."
        soWhat="More dangerous heatwaves for workers and farmers, and drier land that catches fire more easily."
        sure={<Sureness p={tStudy.p} />}
        visual={
          <div className="space-y-4">
            <figure className="rounded-2xl bg-card p-5 shadow-soft">
              <figcaption className="mb-2 text-sm font-medium text-ink">How much warmer each year was than normal</figcaption>
              <SeriesChart
                years={years}
                values={tSeries}
                slopePerDecade={tStudy.slopePerDecade}
                unit="°C"
                decimals={2}
                axisLabel="°C warmer than the 1951–1980 average"
                zeroLine
                lowerPerDecade={tStudy.lowerPerDecade}
                upperPerDecade={tStudy.upperPerDecade}
                title="South Asia temperature whole year"
              />
            </figure>
            <MiniGridMap
              grid={manifest.grids.temperature}
              stats={tempGrid}
              variable="temperature"
              meta={tMeta}
              limit={0.5}
              title="Warming in every square of the map"
              decreaseWord="Cooling"
              increaseWord="Warming"
            />
          </div>
        }
        details={
          <>
            NASA GISTEMP v4 surface temperature anomalies (2° grid, base 1951–1980), yearly means {first}–{last}. Land-weighted
            regional trend (Sen&apos;s slope) {formatSigned(tStudy.slopePerDecade, 3)} °C/decade, 95% CI{" "}
            {formatSigned(tStudy.lowerPerDecade, 3)} to {formatSigned(tStudy.upperPerDecade, 3)}; Hamed–Rao modified Mann–Kendall{" "}
            {formatP(tStudy.p)}. {tempSum.significantIncrease}/{tempSum.cells} land cells significant after Benjamini–Hochberg
            FDR (α = 0.10).
          </>
        }
      />

      <Finding
        id="spring"
        n={2}
        icon={<Thermometer size={22} weight="duotone" />}
        title="Spring is heating up fastest, especially in the mountains"
        big={`${formatSigned(fastest.value, 2)} °C`}
        bigNote={`every 10 years in March–May · ${fastest.name}`}
        story={
          <>
            <p>
              March to May is already the hottest, driest time of year, just before the monsoon. That is exactly when the
              warming is fastest.
            </p>
            <p>
              Mountains warm fastest of all: the {fastest.name} about{" "}
              <strong>{Math.round(fastest.value / slowest.value)} times faster</strong> than the {slowest.name}, where the sea
              keeps temperatures steady.
            </p>
          </>
        }
        why="In the mountains, snow melts earlier and the dark ground underneath soaks up more sunlight."
        soWhat="Longer fire seasons, heat damage to wheat just before harvest, and glaciers melting faster."
        sure={<Sureness p={tFastest.p} />}
        visual={
          <RegionBars
            bars={preBars}
            limit={0.5}
            variable="temperature"
            unit="°C every 10 years"
            decimals={2}
            label="Warming in March–May, region by region"
          />
        }
        details={
          <>
            Median cell trend by season: whole year {formatSigned(seasonMedian("annual"), 2)}, pre-monsoon (MAM){" "}
            {formatSigned(seasonMedian("pre-monsoon"), 2)}, monsoon (JJAS) {formatSigned(seasonMedian("monsoon"), 2)} °C/decade.
            Every hazard region has a significant MAM warming trend (p &lt; 0.05); regional 95% intervals overlap, so the exact
            ranking is less certain than the pattern.
          </>
        }
      />

      <Finding
        id="rain"
        n={3}
        icon={<CloudRain size={22} weight="duotone" />}
        title="The monsoon rain is moving, not disappearing"
        big={`${formatSigned(wettest.value, 0)}% vs ${formatSigned(driest.value, 0)}%`}
        bigNote={`rain every 10 years · ${wettest.name} vs ${driest.name}`}
        story={
          <>
            <p>
              Add up all the monsoon rain over South Asia and the total has hardly changed. But <strong>where</strong> it
              falls has changed: the dry northwest gets more, while the wet east and the mountains get less.
            </p>
            <p>This is the big idea of our project: one warming world, but opposite changes in different places.</p>
          </>
        }
        why="Air pollution can weaken the monsoon winds in the east, and warmer seas push more moisture to the northwest. Scientists are still working out the exact mix."
        soWhat="Bigger floods on the crowded plains of Pakistan, and less water for rice farms and rivers in the east."
        sure={<Sureness p={tWettest.p} />}
        visual={
          <div className="space-y-4">
            <MiniGridMap
              grid={manifest.grids.rainfall}
              stats={rainGrid}
              variable="rainfall"
              meta={rMeta}
              limit={rainLimit}
              percent
              title="Change in monsoon rain (June–September)"
              decreaseWord="Drier"
              increaseWord="Wetter"
            />
            <RegionBars
              bars={rainBars}
              limit={15}
              variable="rainfall"
              unit="% change in monsoon rain every 10 years"
              decimals={1}
              label="Monsoon rain, region by region"
            />
          </div>
        }
        details={
          <>
            GPCP v2.3 monthly precipitation (2.5° grid), June–September totals {first}–{last}. Of {rainSum.cells} land cells,{" "}
            {rainSum.significantIncrease} show a significant increase and {rainSum.significantDecrease} a significant decrease after
            FDR control; {rainSum.cells - rainSum.significantIncrease - rainSum.significantDecrease} show no detectable trend. Whole
            study area: {formatSigned(trendOf(study, "rainfall_monsoon").slopePerDecade, 1)} mm/decade (
            {formatP(trendOf(study, "rainfall_monsoon").p)}, not significant).
          </>
        }
      />

      <Finding
        id="disasters"
        n={4}
        icon={<Lightbulb size={22} weight="duotone" />}
        title="Disasters follow the weather"
        big={`${linkedCount} regions`}
        bigNote="where the worst disaster years match the weather"
        story={
          <>
            <p>
              We lined up the worst disaster years with the weather in the same season. <strong>Hot springs</strong> came with
              more forest fires in Central India. <strong>Rainy monsoons</strong> came with more landslides in the Western
              Himalaya and more floods on the Indus plain.
            </p>
            <p>
              Just as useful: in some places the weather does <em>not</em> explain disasters. The Bengal delta keeps flooding
              even though its own rain is falling, because its floods come from rivers upstream.
            </p>
          </>
        }
        why="Heat dries forests into fuel. Heavy rain soaks steep slopes until they slide, and floods flat land."
        soWhat="Where disasters follow the weather, weather records can warn us early. Where they don't, other causes need attention."
        sure={
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm text-ink">
            <Dots level={2} />
            Fairly sure: the disaster records are short (11 to 26 years)
          </span>
        }
        wide
        visual={
          <div className="grid gap-4 lg:grid-cols-3">
            <EventDriverChart
              title="Forest fires in Central India"
              years={fires.years}
              counts={fires.counts}
              highYears={fires.highEventYears}
              driverValues={driverSeries(fires, "temperature_pre-monsoon")}
              eventLabel="Fires spotted each spring"
              driverLabel="How hot that spring was"
              driverUnit="°C above normal"
              eventColor={EVENT_COLOR.wildfire}
              driverDecimals={2}
            />
            <EventDriverChart
              title="Landslides in the Western Himalaya"
              years={slides.years}
              counts={slides.counts}
              highYears={slides.highEventYears}
              driverValues={driverSeries(slides, "rainfall_monsoon")}
              eventLabel="Landslides each monsoon"
              driverLabel="How much monsoon rain fell"
              driverUnit="mm"
              eventColor={EVENT_COLOR.landslide}
              driverDecimals={0}
            />
            <EventDriverChart
              title="Floods on the Indus plain"
              years={floods.years}
              counts={floods.counts}
              highYears={floods.highEventYears}
              driverValues={driverSeries(floods, "rainfall_monsoon")}
              eventLabel="Flood alerts each year"
              driverLabel="How much monsoon rain fell"
              driverUnit="mm"
              eventColor={EVENT_COLOR.flood}
              driverDecimals={0}
            />
          </div>
        }
        visualNote="Strong-coloured bars are the worst years. When the big dots below them sit high, the disasters and the weather moved together."
        details={
          <>
            Links are Spearman correlations between yearly event counts and the seasonal driver, after removing each series&apos;
            long-term trend: fires vs spring temperature ρ = {rel(fires).rho.toFixed(2)} ({formatP(rel(fires).p)}, n ={" "}
            {rel(fires).n}); landslides vs monsoon rain ρ = {rel(slides).rho.toFixed(2)} ({formatP(rel(slides).p)}, n ={" "}
            {rel(slides).n}); floods vs monsoon rain ρ = {rel(floods).rho.toFixed(2)} ({formatP(rel(floods).p)}, n ={" "}
            {rel(floods).n}). Events: NASA FIRMS MODIS fires (2003–2024), NASA Global Landslide Catalog (2007–2017), GDACS
            flood alerts (2000–{last}). A link is a correlation, not proof of cause.
          </>
        }
      />

      <Finding
        id="watch"
        n={5}
        icon={<UsersThree size={22} weight="duotone" />}
        title={`${last}: ${watchList.length} place${watchList.length === 1 ? "" : "s"} to watch`}
        big={`${watchList.length} region${watchList.length === 1 ? "" : "s"}`}
        bigNote={`looked like past disaster years in ${last}`}
        story={
          <>
            <p>
              In {last}, monsoon rain on the Indus plain was higher than in{" "}
              <strong>{signalDriver(floods).latest.percentile}% of years</strong> since {first}, and in the Western Himalaya
              higher than in <strong>{signalDriver(slides).latest.percentile}%</strong>. Both look like past disaster years.
            </p>
            {last === 2025 && <p>And in 2025, both regions did suffer widely reported floods and landslides.</p>}
          </>
        }
        why="We only compare places where the weather and disasters are clearly linked, so the check means something."
        soWhat="Authorities can prepare early: check risky slopes, stock boats and medicine, and warn people. It is not a forecast."
        sure={
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm text-ink">
            <Dots level={2} />
            Fairly sure: built on the links in finding 4
          </span>
        }
        visual={
          <figure className="space-y-6 rounded-2xl bg-card p-5 shadow-soft">
            <figcaption className="text-sm font-medium text-ink">
              {last} compared with every year since {first}
            </figcaption>
            {[floods, slides, fires].map((h) => {
              const d = signalDriver(h);
              return (
                <PercentileBar
                  key={h.id}
                  label={`${h.name}: ${d.label.toLowerCase()}`}
                  latestYear={d.latest.year}
                  latest={d.latest.percentile}
                  highEvent={d.highEventYearsPercentile!}
                  color={EVENT_COLOR[h.hazard]}
                />
              );
            })}
            <p className="text-sm text-ink-3">A dot to the right of the line means this year looks like the worst years.</p>
          </figure>
        }
        details={
          <>
            For each linked driver: percentile of the {last} value within the region&apos;s {first}–{last} record, compared with
            the mean percentile of that driver in the region&apos;s top-quartile event years. A signal is raised when the current
            value reaches that level in the risk direction. Regions without a significant link get no signal.
          </>
        }
      />

      <section className="mt-24 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-accent-soft p-8">
          <h2 className="text-2xl font-semibold text-ink">Our take</h2>
          <p className="mt-3 text-lg leading-relaxed text-ink">
            The warming is certain, and it is everywhere. What changes from place to place is how it shows up: drying here,
            heavier rain there, fiercer fire seasons somewhere else. That is why local, season-by-season trends matter more
            than one big average.
          </p>
        </div>
        <div className="rounded-3xl bg-card p-8 shadow-soft">
          <h2 className="text-2xl font-semibold text-ink">What we can&apos;t say (yet)</h2>
          <ul className="mt-4 space-y-3 text-ink-2">
            <li>• Each map square is 200–280 km wide, so one valley or city can be different.</li>
            <li>• The landslide record covers only 11 years and comes from news reports.</li>
            <li>• Satellites miss fires under clouds and smoke.</li>
            <li>• A link is not a cause: land use, roads and people also play a part.</li>
          </ul>
        </div>
      </section>

      <Glossary />

      <div className="mt-16 flex flex-wrap items-center gap-4">
        <Link
          href="/trends"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
        >
          Explore the trends yourself <ArrowRight size={18} />
        </Link>
        <Link href="/hazards" className="font-medium text-accent hover:underline">
          Check disaster risk by region
        </Link>
      </div>
    </article>
  );
}

function Finding({
  id,
  n,
  icon,
  title,
  big,
  bigNote,
  story,
  why,
  soWhat,
  sure,
  visual,
  visualNote,
  details,
  wide = false,
}: {
  id: string;
  n: number;
  icon: React.ReactNode;
  title: string;
  big: string;
  bigNote: string;
  story: React.ReactNode;
  why: string;
  soWhat: string;
  sure: React.ReactNode;
  visual: React.ReactNode;
  visualNote?: string;
  details: React.ReactNode;
  wide?: boolean;
}) {
  const text = (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">{icon}</span>
        <span className="text-sm font-medium text-ink-3">Finding {n}</span>
      </div>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-5">
        <div className="text-5xl font-semibold tracking-tight tabular-nums text-ink">{big}</div>
        <div className="mt-1 text-ink-2">{bigNote}</div>
      </div>
      <div className="mt-6 max-w-[62ch] space-y-3 text-lg leading-relaxed text-ink-2 [&_strong]:font-semibold [&_strong]:text-ink">
        {story}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Question size={18} className="text-accent" /> Why is this happening?
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{why}</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <UsersThree size={18} className="text-accent" /> What does it mean for people?
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{soWhat}</p>
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 text-sm font-medium text-ink-3">How sure are we?</div>
        {sure}
      </div>
    </div>
  );

  return (
    <section id={id} className="mt-24 scroll-mt-24">
      {wide ? (
        <>
          {text}
          <div className="mt-8">{visual}</div>
          {visualNote && <p className="mt-3 text-sm text-ink-3">{visualNote}</p>}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          {text}
          <div className="min-w-0">
            {visual}
            {visualNote && <p className="mt-3 text-sm text-ink-3">{visualNote}</p>}
          </div>
        </div>
      )}
      <div className="mt-6">
        <Numbers title="For scientists: the exact method and numbers">{details}</Numbers>
      </div>
    </section>
  );
}

const TERMS: [string, string][] = [
  ["Trend", "The long-term direction something is moving in, ignoring the ups and downs from one year to the next."],
  ["Clear change (significant)", "A change that is very unlikely to be luck. It does not mean big, only real."],
  ["No clear change", "The ups and downs are too big to tell. It does not prove nothing is changing."],
  ["Every 10 years", "How much something changes per decade. +0.3 °C every 10 years is about 1 °C every 33 years."],
  ["Warmer than normal", "Compared with the average of 1951–1980, a common starting point for climate records."],
  ["Link (correlation)", "Two things that rise and fall together. It is a clue, not proof that one causes the other."],
  ["Hot season / Rainy season", "March–May, the hot dry weeks before the rains / June–September, the monsoon."],
  ["Map square", "The data divides the map into squares about 200–280 km wide; each has one value per year."],
];

function Glossary() {
  return (
    <section id="glossary" className="mt-24 scroll-mt-24">
      <h2 className="text-2xl font-semibold text-ink">Words explained</h2>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        {TERMS.map(([term, def]) => (
          <div key={term} className="rounded-2xl bg-card p-5 shadow-soft">
            <dt className="font-semibold text-ink">{term}</dt>
            <dd className="mt-1 leading-relaxed text-ink-2">{def}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
