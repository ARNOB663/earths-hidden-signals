import type { Metadata } from "next";
import Link from "next/link";
import { EventDriverChart, PercentileBar, RegionBars, Confidence, type RegionBar } from "@/components/findings/parts";
import { MiniGridMap } from "@/components/findings/MiniGridMap";
import { SeriesChart } from "@/components/trends/SeriesChart";
import { readHazardZones, readManifest, readTrendGrid, readTrendZones } from "@/lib/data";
import { ordinal, preparednessSignal, type HazardZone } from "@/lib/hazards";
import { colorLimit, formatP, formatSigned, type Zone } from "@/lib/trends";

export const metadata: Metadata = {
  title: "Findings · Earth's Hidden Signals",
  description: "What NASA data shows about heat, rain and disasters in South Asia since 1981, explained simply and in detail.",
};

const EVENT_COLOR = { flood: "#3987e5", landslide: "#eda100", wildfire: "#d95926" } as const;

export default async function FindingsPage() {
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

  // Finding 1: warming
  const study = zone("study-area");
  const tStudy = trendOf(study, "temperature_annual");
  const tSeries = study.results["temperature_annual"].series as number[];
  const warmest = years
    .map((y, i) => ({ y, v: tSeries[i] }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 5);
  const tempSum = manifest.summaries["temperature_annual"];
  const sinceStart = (tStudy.slopePerDecade * (last - first)) / 10;

  // Finding 2: seasons and places
  const regionIds = trendZones.filter((z) => z.hazard).map((z) => z.id);
  const preBars: RegionBar[] = regionIds.map((id) => {
    const t = trendOf(zone(id), "temperature_pre-monsoon");
    return { name: zone(id).name, value: t.slopePerDecade, significant: t.p < 0.05 };
  });
  const fastest = [...preBars].sort((a, b) => b.value - a.value)[0];
  const slowest = [...preBars].sort((a, b) => a.value - b.value)[0];
  const seasonMedian = (s: string) => manifest.summaries[`temperature_${s}`].medianSlopePerDecade;

  // Finding 3: monsoon rain moves
  const rainPct = (z: Zone) => {
    const r = z.results["rainfall_monsoon"];
    return (r.trend!.slopePerDecade / r.mean) * 100;
  };
  const rainBars: RegionBar[] = regionIds.map((id) => ({
    name: zone(id).name,
    value: rainPct(zone(id)),
    significant: trendOf(zone(id), "rainfall_monsoon").p < 0.05,
  }));
  const rainSum = manifest.summaries["rainfall_monsoon"];
  const rainPctGrid = rainGrid.slopePerDecade.map((s, k) => (s === null || !rainGrid.mean[k] ? null : (s / rainGrid.mean[k]!) * 100));
  const rainLimit = colorLimit(rainPctGrid);
  const studyRainPct = rainPct(study);
  const noTrendRain = rainSum.cells - rainSum.significantIncrease - rainSum.significantDecrease;

  // Finding 4: links to disasters
  const driverSeries = (h: HazardZone, key: string) => {
    const s = zone(h.id).results[key].series as number[];
    return h.years.map((y) => s[years.indexOf(y)]);
  };
  const fires = hz("central-india-forests");
  const slides = hz("western-himalaya");
  const floods = hz("indus-plain");
  const rel = (h: HazardZone) => h.drivers.find((d) => d.linked)!.relationship!;
  const neFires = hz("northeast-hills");
  const delta = hz("bengal-delta");
  const deltaRain = trendOf(zone("bengal-delta"), "rainfall_monsoon");

  const linkedCount = hazardZones.filter((h) => h.drivers.some((d) => d.linked)).length;
  const drierSig = rainBars.filter((b) => b.significant && b.value < 0).map((b) => Math.abs(b.value));
  const drierRange = drierSig.length
    ? `${Math.round(Math.min(...drierSig))}–${Math.round(Math.max(...drierSig))}%`
    : "less";

  // Finding 5: this year's signals
  const signalDriver = (h: HazardZone) => h.drivers.find((d) => d.linked)!;
  const signalCount = hazardZones.filter((h) => preparednessSignal(h).kind === "resembles").length;

  return (
    <article className="mx-auto w-full max-w-5xl px-4 py-14 text-slate-300">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-400">Findings · {first}–{last}</p>
      <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white">
        What 45 years of NASA data say about South Asia
      </h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-400">
        Each finding is told twice: once in simple words that a school student can follow, and once in the technical
        language scientists use. Every number on this page comes from our analysis of public NASA data and is updated when
        the analysis is re-run.
      </p>

      <nav aria-label="Findings" className="mt-8 rounded-lg bg-[#0e141b] p-5 ring-1 ring-white/10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">The story in 30 seconds</div>
        <ol className="mt-3 space-y-2 text-sm">
          <li>
            <a href="#warming" className="text-white hover:text-sky-300">1. Every part of South Asia has warmed</a> by about{" "}
            {formatSigned(sinceStart, 1)} °C since {first}; {warmest[0].y} was the hottest year on record.
          </li>
          <li>
            <a href="#seasons" className="text-white hover:text-sky-300">2. The heat rises fastest in March–May</a>, the hot
            dry weeks before the monsoon, and fastest of all in the mountains.
          </li>
          <li>
            <a href="#rain" className="text-white hover:text-sky-300">3. The monsoon isn&apos;t disappearing, it&apos;s moving</a>
            : the dry northwest gets more rain, the wet east and the mountains get less.
          </li>
          <li>
            <a href="#disasters" className="text-white hover:text-sky-300">4. Disasters follow the weather</a> in{" "}
            {linkedCount} regions: hot springs with forest fires, wet monsoons with landslides and floods.
          </li>
          <li>
            <a href="#watch" className="text-white hover:text-sky-300">
              5. In {last}, {signalCount} region{signalCount === 1 ? "" : "s"} matched
            </a>{" "}
            the conditions of past disaster years.
          </li>
        </ol>
      </nav>

      {/* ---------------------------------------------------------------- 1 */}
      <Chapter
        id="warming"
        n={1}
        title="South Asia is warming, everywhere"
        big={`${formatSigned(tStudy.slopePerDecade, 2)} °C`}
        bigUnit={`per decade · about ${formatSigned(sinceStart, 1)} °C since ${first}`}
        simple={
          <>
            <p>
              Imagine one thermometer for all of South Asia. Every year we note how much warmer or cooler it was than the
              average of 1951–1980. In the early 1980s the region was close to that old average. In {warmest[0].y} it was{" "}
              <strong className="text-white">{warmest[0].v.toFixed(1)} °C warmer</strong>, the hottest year on record.
            </p>
            <p>
              This isn&apos;t one hot summer. It is a steady climb of about a third of a degree every ten years, and it
              appears in <strong className="text-white">every one of the {tempSum.cells} land squares</strong> on our map.
              Not a single square cooled.
            </p>
          </>
        }
        visual={
          <div className="space-y-4">
            <figure className="rounded-lg bg-[#0b0f14] p-4 ring-1 ring-white/10">
              <SeriesChart
                years={years}
                values={tSeries}
                slopePerDecade={tStudy.slopePerDecade}
                unit="°C"
                decimals={2}
                axisLabel="°C warmer than the 1951–1980 average"
                zeroLine
              />
              <figcaption className="mt-2 text-xs text-slate-500">
                Yearly temperature of South Asia&apos;s land, compared with the 1951–1980 average. Hover to read any year.
                Warmest years: {warmest.map((w) => w.y).join(", ")}.
              </figcaption>
            </figure>
            <MiniGridMap
              grid={manifest.grids.temperature}
              stats={tempGrid}
              variable="temperature"
              meta={tMeta}
              limit={0.5}
              caption="Warming per decade in each 2° square (about 220 km across), whole year."
            />
          </div>
        }
        science={
          <>
            NASA GISTEMP v4 surface temperature anomalies (2° grid, base 1951–1980), annual means {first}–{last}. Region
            average (land-weighted): Sen&apos;s slope {formatSigned(tStudy.slopePerDecade, 3)} °C/decade, 95% CI{" "}
            {formatSigned(tStudy.lowerPerDecade, 3)} to {formatSigned(tStudy.upperPerDecade, 3)}; Hamed–Rao modified
            Mann–Kendall {formatP(tStudy.p)}. {tempSum.significantIncrease}/{tempSum.cells} land cells significant after
            Benjamini–Hochberg FDR (α<sub>FDR</sub> = 0.10); median cell trend {formatSigned(tempSum.medianSlopePerDecade, 2)}{" "}
            °C/decade.
          </>
        }
        why={
          <>
            The main cause is the extra greenhouse gas in the air, mostly carbon dioxide from burning coal, oil and gas. It
            acts like a blanket that keeps more of the sun&apos;s heat near the ground. The IPCC (the UN&apos;s climate
            science panel) concludes that human activity is the dominant cause of warming since the mid-1900s. Local
            factors add to it, such as growing cities that trap heat. Air pollution does the opposite: its tiny particles
            block some sunlight, which hides part of the warming.
          </>
        }
        people={
          <>
            More dangerous heat for outdoor workers, farmers and people without cooling; higher electricity demand; and
            faster drying of soils and forests. Warming is the first link in the chain that leads to the hazards below.
          </>
        }
        confidence={<Confidence level="high" reason="Clear in every square, and confirmed by NASA's official temperature record." />}
      />

      {/* ---------------------------------------------------------------- 2 */}
      <Chapter
        id="seasons"
        n={2}
        title="Heat rises fastest before the monsoon, and in the mountains"
        big={`${formatSigned(fastest.value, 2)} °C`}
        bigUnit={`per decade in March–May · ${fastest.name}`}
        simple={
          <>
            <p>
              March to May is already the hottest, driest time of year, just before the monsoon rain arrives. That&apos;s
              exactly when the warming is fastest: a typical square warms{" "}
              <strong className="text-white">{formatSigned(seasonMedian("pre-monsoon"), 2)} °C per decade</strong> in spring
              but {formatSigned(seasonMedian("monsoon"), 2)} °C in the rainy season.
            </p>
            <p>
              Where you live matters too. The {fastest.name} warms about{" "}
              <strong className="text-white">{Math.round(fastest.value / slowest.value)} times faster</strong> in spring than
              the {slowest.name}, where the surrounding sea keeps temperatures steadier.
            </p>
          </>
        }
        visual={
          <RegionBars
            bars={preBars}
            limit={0.5}
            variable="temperature"
            unit="°C per decade"
            decimals={2}
            label="Pre-monsoon (March–May) warming by region"
          />
        }
        science={
          <>
            Median cell trend by season: whole year {formatSigned(seasonMedian("annual"), 2)}, pre-monsoon (MAM){" "}
            {formatSigned(seasonMedian("pre-monsoon"), 2)}, monsoon (JJAS) {formatSigned(seasonMedian("monsoon"), 2)} °C/decade.
            Every hazard region shows a significant MAM warming trend (Hamed–Rao MK, p &lt; 0.05). Regional confidence
            intervals overlap, so the exact ranking between neighbouring regions is less certain than the overall pattern.
          </>
        }
        why={
          <>
            In the mountains, snow melting earlier uncovers darker ground that soaks up more sunlight. Scientists call
            this the snow–albedo feedback. In dry spring soils there is little water to evaporate, so more of the
            sun&apos;s energy goes into heating the air. Near the coast and on islands like Sri Lanka, the ocean acts like
            a giant heat buffer.
          </>
        }
        people={
          <>
            Hotter springs mean a longer and more intense fire season, heat stress on wheat just as the grain fills in
            March–April, and faster melting of Himalayan snow and glaciers that feed the rivers.
          </>
        }
        confidence={<Confidence level="high" reason="Every region warms significantly in spring; the exact ranking is less certain." />}
      />

      {/* ---------------------------------------------------------------- 3 */}
      <Chapter
        id="rain"
        n={3}
        title="Same warming, opposite rain"
        big={`${rainSum.significantIncrease} wetter · ${rainSum.significantDecrease} drier`}
        bigUnit={`squares with a significant monsoon-rain trend · region total ${formatSigned(studyRainPct, 1)}% per decade`}
        simple={
          <>
            <p>
              Add up all the monsoon rain over South Asia and the total has{" "}
              <strong className="text-white">hardly changed in {years.length} years</strong>. But <em>where</em> it falls has changed.
              The dry northwest, the Indus plain, now gets about{" "}
              <strong className="text-white">{formatSigned(rainPct(zone("indus-plain")), 0)}% more every decade</strong>,
              while the wet east and the mountains get {drierRange} less.
            </p>
            <p>
              It&apos;s like pouring the same jug of water while slowly moving it west. This is exactly the challenge&apos;s
              point: <strong className="text-white">one process, opposite trends in different places.</strong>
            </p>
          </>
        }
        visual={
          <div className="space-y-4">
            <MiniGridMap
              grid={manifest.grids.rainfall}
              stats={rainGrid}
              variable="rainfall"
              meta={rMeta}
              limit={rainLimit}
              percent
              caption="Change in June–September rain per decade, as % of each square's average."
            />
            <RegionBars
              bars={rainBars}
              limit={15}
              variable="rainfall"
              unit="% per decade"
              decimals={1}
              label="Monsoon (June–September) rain change by region"
            />
          </div>
        }
        science={
          <>
            GPCP v2.3 monthly precipitation (2.5° grid), June–September totals {first}–{last}. Of {rainSum.cells} land cells,{" "}
            {rainSum.significantIncrease} show a significant increase and {rainSum.significantDecrease} a significant
            decrease after FDR control; {noTrendRain} ({Math.round((noTrendRain / rainSum.cells) * 100)}%) show no
            detectable trend. Region-average trends: Indus plain{" "}
            {formatSigned(trendOf(zone("indus-plain"), "rainfall_monsoon").slopePerDecade, 1)} mm/decade (
            {formatP(trendOf(zone("indus-plain"), "rainfall_monsoon").p)}), Central Himalaya{" "}
            {formatSigned(trendOf(zone("central-himalaya"), "rainfall_monsoon").slopePerDecade, 1)} mm/decade (
            {formatP(trendOf(zone("central-himalaya"), "rainfall_monsoon").p)}), whole study area{" "}
            {formatSigned(trendOf(study, "rainfall_monsoon").slopePerDecade, 1)} mm/decade (
            {formatP(trendOf(study, "rainfall_monsoon").p)}, not significant).
          </>
        }
        why={
          <>
            Scientists are still studying this, and several causes probably work together. Air pollution particles
            (aerosols) dim the sunlight and can weaken the monsoon winds, especially over the crowded east. Warmer seas,
            like the Arabian Sea, can send more moisture toward the northwest. Natural cycles such as El Niño also shift
            rain from year to year. Our data shows the pattern clearly, but it cannot separate these causes on its own.
          </>
        }
        people={
          <>
            <strong className="text-white">Wetter northwest:</strong> bigger floods on a flat, crowded floodplain, like
            Pakistan in 2010 and 2022. <strong className="text-white">Drier east and mountains:</strong> less water for rice
            farming and hydropower in places used to plenty, even while each downpour can still be intense.
          </>
        }
        confidence={
          <Confidence level="medium" reason="Strong in several regions, but most single squares show no clear trend. Rain varies a lot from year to year." />
        }
      />

      {/* ---------------------------------------------------------------- 4 */}
      <Chapter
        id="disasters"
        n={4}
        title="When the weather lines up, disasters follow"
        wide
        big={`${linkedCount} regions`}
        bigUnit="where disaster years clearly match the weather"
        simple={
          <>
            <p>
              We lined up the years with the most disasters against the weather in the same season. In three regions they
              clearly move together: <strong className="text-white">hotter springs → more forest fires</strong> in Central
              India, and <strong className="text-white">wetter monsoons → more landslides and floods</strong> in the Western
              Himalaya and on the Indus plain.
            </p>
            <p>
              We are careful here. &ldquo;Move together&rdquo; is not the same as &ldquo;cause&rdquo;, so we only count a
              link when it is statistically significant and makes physical sense.
            </p>
          </>
        }
        visual={
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <LinkedCase
              title="Central Indian forest fires"
              stat={`ρ = ${rel(fires).rho.toFixed(2)}, ${formatP(rel(fires).p)}, ${rel(fires).n} years`}
            >
              <EventDriverChart
                years={fires.years}
                counts={fires.counts}
                highYears={fires.highEventYears}
                driverValues={driverSeries(fires, "temperature_pre-monsoon")}
                eventLabel="Fire detections (Mar–May)"
                driverLabel="Spring temperature"
                driverUnit="°C vs 1951–80"
                eventColor={EVENT_COLOR.wildfire}
                driverDecimals={2}
              />
            </LinkedCase>
            <LinkedCase
              title="Western Himalaya landslides"
              stat={`ρ = ${rel(slides).rho.toFixed(2)}, ${formatP(rel(slides).p)}, ${rel(slides).n} years`}
            >
              <EventDriverChart
                years={slides.years}
                counts={slides.counts}
                highYears={slides.highEventYears}
                driverValues={driverSeries(slides, "rainfall_monsoon")}
                eventLabel="Landslides (Jun–Sep)"
                driverLabel="Monsoon rain"
                driverUnit="mm"
                eventColor={EVENT_COLOR.landslide}
                driverDecimals={0}
              />
            </LinkedCase>
            <LinkedCase
              title="Indus plain floods"
              stat={`ρ = ${rel(floods).rho.toFixed(2)}, ${formatP(rel(floods).p)}, ${rel(floods).n} years`}
            >
              <EventDriverChart
                years={floods.years}
                counts={floods.counts}
                highYears={floods.highEventYears}
                driverValues={driverSeries(floods, "rainfall_monsoon")}
                eventLabel="Flood alerts"
                driverLabel="Monsoon rain"
                driverUnit="mm"
                eventColor={EVENT_COLOR.flood}
                driverDecimals={0}
              />
            </LinkedCase>
          </div>
        }
        science={
          <>
            Event records: NASA FIRMS MODIS vegetation fires (Terra + Aqua, confidence ≥ 30, 2003–2024), NASA Global
            Landslide Catalog (2007–2017), GDACS flood alerts (2000–{last}). Link = Spearman rank correlation (ρ) between
            yearly event counts and the seasonal driver after removing each series&apos; Sen trend, so a shared long-term
            drift can&apos;t create a false link. Counted only if p &lt; 0.05 and the sign matches physics (heat → fire,
            rain → landslide/flood).
          </>
        }
        why={
          <>
            Heat dries leaves and grass into fuel that catches fire easily, and most fires in these forests are lit by
            people, so a hot spring turns ordinary burning into big fires. On steep slopes, heavy rain fills the soil with
            water until it becomes heavy and slippery and slides. On a flat floodplain, extra rain has nowhere to go.
          </>
        }
        people={
          <div className="space-y-3">
            <p>
              <strong className="text-white">Not everything is weather.</strong> The {delta.name} got{" "}
              {Math.abs((deltaRain.slopePerDecade / zone("bengal-delta").results["rainfall_monsoon"].mean) * 100).toFixed(1)}%
              drier per decade in the monsoon, yet it keeps flooding: its floods come mostly from water that falls far upstream and from
              cyclones and tides, not from local rain. Fires in the {neFires.name} fell by about{" "}
              {Math.round((Math.abs(neFires.eventTrend!.slopePerDecade) / neFires.eventTrend!.mean) * 100)}% per decade with
              no clear weather link. That points to changes in how people use the land. Finding where weather does{" "}
              <em>not</em> explain disasters is just as useful as finding where it does.
            </p>
          </div>
        }
        peopleTitle="Where the weather does not explain it"
        confidence={
          <Confidence level="medium" reason="Real statistical links, but short records (11–26 years), and a link is not proof of cause." />
        }
      />

      {/* ---------------------------------------------------------------- 5 */}
      <Chapter
        id="watch"
        n={5}
        title={`${last}: what to watch`}
        big={`${signalCount} region${signalCount === 1 ? "" : "s"}`}
        bigUnit={`matched the conditions of past disaster years in ${last}`}
        simple={
          <>
            <p>
              For the three regions with a real link, we asked: how does this year&apos;s weather compare with the years
              that had the most disasters? In {last}, monsoon rain on the{" "}
              <strong className="text-white">Indus plain was higher than in {signalDriver(floods).latest.percentile}%</strong>{" "}
              of years since {first}, and in the{" "}
              <strong className="text-white">
                Western Himalaya higher than in {signalDriver(slides).latest.percentile}%
              </strong>
              . Both are above the level typical of past disaster years.
            </p>
            {last === 2025 && (
              <p>
                This matches what happened: the 2025 monsoon brought widely reported floods in Pakistan&apos;s plains and
                deadly cloudbursts and landslides in the Western Himalaya.
              </p>
            )}
            <p>
              Central India&apos;s spring was only the {ordinal(signalDriver(fires).latest.percentile)} percentile, below its
              past big-fire years ({ordinal(signalDriver(fires).highEventYearsPercentile!)}), so there was no fire signal
              there.
            </p>
          </>
        }
        visual={
          <div className="space-y-5 rounded-lg bg-[#0b0f14] p-5 ring-1 ring-white/10">
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
            <p className="text-xs text-slate-500">
              0 = the lowest value since {first}, 100 = the highest. A dot to the right of the line means this year looks
              like past disaster years.
            </p>
          </div>
        }
        science={
          <>
            For each linked driver: percentile of the {last} value within the region&apos;s {first}–{last} record, compared with
            the mean percentile of the driver in the region&apos;s top-quartile event years. A signal is raised when the
            current value is at or beyond that mean in the risk direction. No signal is issued for regions without a
            significant link.
          </>
        }
        why={
          <>
            This is <strong className="text-white">not a forecast</strong>. It doesn&apos;t say a disaster will happen. It
            says &ldquo;conditions now look like the years when disasters happened before&rdquo;. That is the kind of
            evidence that helps people get ready early.
          </>
        }
        whyTitle="Why this is not a prediction"
        people={
          <>
            Disaster management agencies can raise monitoring and pre-position boats, food and medical supplies; road and
            hydropower operators can inspect risky slopes; forest departments can staff fire watch; and local authorities
            can warn communities before the peak season.
          </>
        }
        peopleTitle="Who can use this, and how"
        confidence={<Confidence level="medium" reason="Built on the links above, so it inherits their short records." />}
      />

      {/* ---------------------------------------------------------------- 6 */}
      <section id="limits" className="scroll-mt-20 border-t border-white/10 pt-12 mt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">6 · Honesty section</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">What we can&apos;t say (yet)</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            ["Squares are big", "Each square is 200–280 km wide, so a single valley or city can behave differently from its square."],
            ["Some records are short", "The landslide record covers only 11 years and is built from news reports, which miss remote places."],
            ["Satellites have blind spots", "Clouds and smoke hide fires, and the MODIS satellites have drifted since about 2020."],
            ["A link is not a cause", "Land use, deforestation, road building and people starting fires also drive these hazards."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-lg bg-[#0e141b] p-4 ring-1 ring-white/10">
              <div className="font-medium text-white">{title}</div>
              <p className="mt-1 text-sm text-slate-400">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-lg bg-sky-400/[0.06] p-5 ring-1 ring-sky-400/25">
          <div className="text-sm font-medium text-sky-200">Our take</div>
          <p className="mt-2 leading-relaxed text-slate-200">
            The warming is certain and it is everywhere. What changes from place to place is how that heat shows up: as
            drying in one region, heavier rain in another, and fiercer fire seasons in a third. That is why a single
            national average hides the real risk. Local, season-by-season trends, checked for statistical significance,
            are what tell a community what to prepare for.
          </p>
        </div>
      </section>

      <Glossary />

      <div className="mt-14 flex flex-wrap gap-3">
        <Link href="/trends" className="rounded-md bg-sky-500 px-4 py-2.5 text-sm font-medium text-[#04121d] hover:bg-sky-400">
          Explore the trends yourself
        </Link>
        <Link href="/hazards" className="rounded-md border border-white/15 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5">
          See every hazard region
        </Link>
        <Link href="/methods" className="rounded-md border border-white/15 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5">
          Read the full method
        </Link>
      </div>
    </article>
  );
}

function Chapter({
  id,
  n,
  title,
  big,
  bigUnit,
  simple,
  visual,
  science,
  why,
  whyTitle = "Why is this happening?",
  people,
  peopleTitle = "What it means for people",
  confidence,
  wide = false,
}: {
  wide?: boolean;
  id: string;
  n: number;
  title: string;
  big: string;
  bigUnit: string;
  simple: React.ReactNode;
  visual: React.ReactNode;
  science: React.ReactNode;
  why: React.ReactNode;
  whyTitle?: string;
  people: React.ReactNode;
  peopleTitle?: string;
  confidence: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-16 scroll-mt-20 border-t border-white/10 pt-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-400">Finding {n}</p>
      <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{title}</h2>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-4xl font-semibold tabular-nums text-white">{big}</span>
        <span className="text-sm text-slate-400">{bigUnit}</span>
      </div>
      <div className="mt-3">{confidence}</div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-5">
          <Block label="In simple words" accent>
            <div className="space-y-3 text-[15px] leading-relaxed text-slate-200">{simple}</div>
          </Block>
          <Block label={whyTitle}>
            <p className="text-sm leading-relaxed text-slate-300">{why}</p>
          </Block>
          {!wide && (
            <Block label={peopleTitle}>
              <div className="text-sm leading-relaxed text-slate-300">{people}</div>
            </Block>
          )}
        </div>
        <div className="min-w-0 space-y-4">
          {!wide && visual}
          {wide && (
            <Block label={peopleTitle}>
              <div className="text-sm leading-relaxed text-slate-300">{people}</div>
            </Block>
          )}
          <details className="group rounded-lg bg-[#0e141b] p-4 ring-1 ring-white/10" open>
            <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 group-open:text-slate-300">
              The science (technical details)
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{science}</p>
          </details>
        </div>
      </div>
      {wide && <div className="mt-8">{visual}</div>}
    </section>
  );
}

function Block({ label, accent, children }: { label: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className={accent ? "border-l-2 border-sky-400 pl-4" : ""}>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function LinkedCase({ title, stat, children }: { title: string; stat: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="font-mono text-[11px] text-slate-400">{stat}</div>
      </div>
      {children}
    </div>
  );
}

const TERMS: [string, string][] = [
  ["Trend", "The long-term direction a number is moving in over many years, ignoring the ups and downs from one year to the next."],
  ["Anomaly", "How far a value is from a normal reference. Here: how much warmer a year is than the 1951–1980 average."],
  ["Per decade", "The change over 10 years. +0.3 °C per decade means about 1 °C warmer every 33 years."],
  ["Sen's slope", "A robust way to measure a trend's speed: the middle value of the slopes between every pair of years, so one extreme year can't distort it."],
  ["95% range (confidence interval)", "The span in which the true rate very likely lies. A narrow range means we know the rate well."],
  ["Mann–Kendall test", "Checks whether later years are consistently higher (or lower) than earlier years, more often than chance would allow."],
  ["p-value", "The chance of seeing a trend this strong if nothing were really changing. Below 0.05 (5%) we call it significant."],
  ["Statistically significant", "Unlikely to be luck. It does not mean 'big' or 'important', only 'real, not chance'."],
  ["Not significant", "The data can't tell a trend apart from natural ups and downs. It does not prove there is no change."],
  ["Autocorrelation", "When one year resembles the next (a warm year after a warm year). If ignored, it creates false 'trends', so we correct for it."],
  ["False discovery rate", "When testing hundreds of map squares, a few look significant by luck. This check keeps those false alarms low."],
  ["Correlation (ρ, 'rho')", "How closely two things rise and fall together, from −1 to +1. It does not prove one causes the other."],
  ["Percentile", "Where a value ranks in the record. 90th percentile = higher than 90% of all years."],
  ["Pre-monsoon / monsoon", "March–May, the hot dry weeks before the rains / June–September, the main rainy season."],
  ["Grid square (cell)", "The satellite-based datasets divide the map into squares; each has one value per year."],
];

function Glossary() {
  return (
    <section id="glossary" className="mt-16 scroll-mt-20 border-t border-white/10 pt-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">7 · Glossary</p>
      <h2 className="mt-1 text-2xl font-semibold text-white">Words used on this page</h2>
      <dl className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
        {TERMS.map(([term, def]) => (
          <div key={term}>
            <dt className="font-medium text-white">{term}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-slate-400">{def}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
