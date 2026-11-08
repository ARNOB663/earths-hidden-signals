import type { Metadata } from "next";
import Link from "next/link";
import { CITATION } from "@/lib/download";
import { readCrosscheck, readData, readManifest, readTrendZones } from "@/lib/data";
import type { Outlook } from "@/lib/future";
import { T } from "@/lib/i18n";
import { MethodsIntelligence } from "@/components/intelligence/MethodsIntelligence";
import { readEvaluation, readSources, readThresholds } from "@/lib/intelligence/data";
import { readGeographyIndex } from "@/lib/geography/data";
import {
  agreement,
  formatSigned,
  type Agreement,
  type TrendSummary,
} from "@/lib/trends";

export const metadata: Metadata = {
  title: "Methods · Earth's Hidden Signals",
  description:
    "Reference methods for the climate trend, hazard and cross-check analyses: data sources, statistical tests, validation and known limitations.",
};

const REPO = "https://github.com/ARNOB663/earths-hidden-signals";

const KEYWORDS = [
  "Mann–Kendall",
  "Sen's slope",
  "Hamed–Rao",
  "false discovery rate",
  "GISTEMP",
  "GPCP",
  "CRU TS 4.10",
  "Pettitt",
  "NEX-GDDP-CMIP6",
  "South Asia",
];

type Ref = { en: string; url: string };

const REFERENCES: Ref[] = [
  {
    en: "Adler, R. F. et al. (2018). The Global Precipitation Climatology Project (GPCP) monthly analysis (new version 2.3) and a review of 2017 global precipitation. Atmosphere 9(4), 138.",
    url: "https://doi.org/10.3390/atmos9040138",
  },
  {
    en: "Airola, A. et al. (2011). An experimental comparison of cross-validation techniques for estimating the area under the ROC curve. Comput. Stat. Data Anal. 55(4), 1828–1844.",
    url: "https://doi.org/10.1016/j.csda.2010.11.018",
  },
  {
    en: "Benjamini, Y. & Hochberg, Y. (1995). Controlling the false discovery rate: a practical and powerful approach to multiple testing. J. R. Stat. Soc. B 57(1), 289–300.",
    url: "https://doi.org/10.1111/j.2517-6161.1995.tb02031.x",
  },
  {
    en: "Giglio, L., Schroeder, W. & Justice, C. O. (2016). The Collection 6 MODIS active fire detection algorithm and fire products. Remote Sens. Environ. 178, 31–41.",
    url: "https://doi.org/10.1016/j.rse.2016.02.054",
  },
  {
    en: "Gilbert, R. O. (1987). Statistical Methods for Environmental Pollution Monitoring. Van Nostrand Reinhold, New York.",
    url: "https://www.osti.gov/biblio/6166317",
  },
  {
    en: "Hamed, K. H. & Rao, A. R. (1998). A modified Mann–Kendall trend test for autocorrelated data. J. Hydrology 204(1–4), 182–196.",
    url: "https://doi.org/10.1016/S0022-1694(97)00125-X",
  },
  {
    en: "Hansen, M. C. et al. (2013). High-resolution global maps of 21st-century forest cover change. Science 342(6160), 850–853.",
    url: "https://doi.org/10.1126/science.1244693",
  },
  {
    en: "Harris, I. et al. (2020). Version 4 of the CRU TS monthly high-resolution gridded multivariate climate dataset. Sci. Data 7, 109.",
    url: "https://doi.org/10.1038/s41597-020-0453-3",
  },
  {
    en: "Kirschbaum, D. et al. (2015). Spatial and temporal analysis of a global landslide catalog. Geomorphology 249, 4–15.",
    url: "https://doi.org/10.1016/j.geomorph.2015.03.016",
  },
  {
    en: "Lenssen, N. et al. (2019). Improvements in the GISTEMP uncertainty model. J. Geophys. Res. Atmos. 124(12), 6307–6326.",
    url: "https://doi.org/10.1029/2018JD029522",
  },
  {
    en: "Pettitt, A. N. (1979). A non-parametric approach to the change-point problem. J. R. Stat. Soc. C 28(2), 126–135.",
    url: "https://doi.org/10.2307/2346729",
  },
  {
    en: "Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. J. Am. Stat. Assoc. 63(324), 1379–1389.",
    url: "https://doi.org/10.1080/01621459.1968.10480934",
  },
  {
    en: "Thrasher, B. et al. (2022). NASA Global Daily Downscaled Projections, CMIP6. Sci. Data 9, 262.",
    url: "https://doi.org/10.1038/s41597-022-01393-4",
  },
  {
    en: "Wilks, D. S. (2016). “The stippling shows statistically significant grid points”: how research results are routinely overstated and overinterpreted. Bull. Am. Meteorol. Soc. 97(12), 2263–2273.",
    url: "https://doi.org/10.1175/BAMS-D-15-00267.1",
  },
];

// Where each in-text citation points in the reference list above.
const cite = (keys: string[]) =>
  keys.map((key) => {
    const n = REFERENCES.findIndex((r) => r.en.startsWith(key)) + 1;
    return (
      <a
        key={key}
        href={`#ref-${n}`}
        className="text-ink-2 underline decoration-line underline-offset-2 hover:text-accent"
      >
        {n}
      </a>
    );
  });

function Cite({ keys }: { keys: string[] }) {
  const ns = cite(keys);
  return (
    <span className="ml-0.5 whitespace-nowrap">
      [
      {ns.map((n, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {n}
        </span>
      ))}
      ]
    </span>
  );
}

export default async function MethodsPage() {
  const [manifest, crosscheck, trendZones, thresholds, sources, evaluation, geography, twins, outlook, risk] = await Promise.all([
    readManifest(),
    readCrosscheck(),
    readTrendZones(),
    readThresholds(),
    readSources(),
    readEvaluation(),
    readGeographyIndex(),
    readData<{ blocks: unknown[]; regions: unknown[]; block: number }>("twins", "twins.json"),
    readData<Outlook>("future", "outlook.json"),
    readData<{ regions: { skillful: boolean; n: number }[]; skillRule: { bss: number; auc: number; p: number } }>("risk", "model.json"),
  ]);
  const riskPassed = risk.regions.filter((r) => r.skillful).length;
  const riskYears = risk.regions.map((r) => r.n);
  const [first, last] = [
    manifest.years[0],
    manifest.years[manifest.years.length - 1],
  ];
  const t = manifest.variables.temperature;
  const r = manifest.variables.rainfall;
  const regionName = (id?: string) =>
    id === "study-area"
      ? "the study area"
      : (trendZones.find((z) => z.id === id)?.name ?? "the region concerned");
  // Regions where the independent record agrees on warming but not on its significance;
  // keep the prose below Table 2 derived from the same data as the table itself.
  const warmSignificanceMismatch = trendZones
    .filter((z) => {
      const pair = crosscheck.zones[z.id]?.["temperature_annual"];
      return (
        !!pair?.ours && !!pair.cru && pair.ours.p < 0.05 && pair.cru.p >= 0.05
      );
    })
    .map((z) => z.id);

  return (
    <div className="mx-auto w-full max-w-384 px-6 pb-24 pt-12 sm:px-8 lg:px-12">
      <article className="mx-auto w-full max-w-5xl">
        {/* Title block */}
        <header className="border-b border-line pb-8">
          <p className="text-sm font-medium text-accent">
            <T en="Methods reference" bn="পদ্ধতির বিবরণ" />
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            <T
              en="Estimating climate trends and hazard links in South Asia, 1981–2025"
              bn="দক্ষিণ এশিয়ায় জলবায়ু প্রবণতা ও দুর্যোগ-সংযোগ নির্ণয়, ১৯৮১–২০২৫"
            />
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">
            <T
              en="A line on a chart that goes up is not yet a trend. This document describes how we establish that a change is real: which data we use, how we estimate its rate, how we test whether it could be chance, and where the evidence is weak."
              bn="চার্টে রেখা ওপরে উঠলেই তা প্রবণতা নয়। এই নথিতে বর্ণনা আছে—কোন তথ্য ব্যবহার করি, পরিবর্তনের হার কীভাবে মাপি, কাকতালীয় হতে পারে কি না কীভাবে পরীক্ষা করি, আর কোথায় প্রমাণ দুর্বল।"
            />
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <Meta label="Version" value={manifest.generated} />
            <Meta label="Study period" value={`${first}–${last}`} />
            <Meta label="Records" value="45 annual" />
            <Meta label="Status" value="Open methods" />
          </dl>
          <p className="mt-6 text-sm text-ink-3">
            <span className="font-medium text-ink-2">
              <T en="Keywords: " bn="মূল শব্দ: " />
            </span>
            {KEYWORDS.join(" · ")}
          </p>
          <T
            en={null}
            bn={
              <p className="mt-6 rounded-lg border-l-2 border-line bg-card px-4 py-3 text-sm text-ink-2">
                বিজ্ঞানী ও সমালোচকদের জন্য লেখা এই পাতার প্রযুক্তিগত বিবরণ
                ইংরেজিতে রাখা হয়েছে। সহজ ব্যাখ্যার জন্য &ldquo;গল্পটা&rdquo;
                পাতা দেখুন।
              </p>
            }
          />
        </header>

        <Section id="abstract" n={null} title="Abstract">
          <p>
            We test whether climate indicators over South Asia changed
            monotonically between {first} and {last}. Gridded surface
            temperature (GISTEMP) and precipitation (GPCP) are summarised per
            land grid cell and per ecological region, and a per-decade rate of
            change is estimated with Sen&apos;s slope, with a 95% confidence
            interval. Significance is assessed with a Mann–Kendall test
            corrected for serial autocorrelation (Hamed–Rao), and family-wise
            error from testing many cells is controlled with a false discovery
            rate procedure. Hazard counts per region are then related to the
            climate drivers using detrended Spearman correlation. Every headline
            trend is replicated with an independent station-based record (CRU TS
            4.10), and agreement between the two is reported alongside each
            result.
          </p>
          <KeyFindings />
        </Section>

        <Section id="scope" n="1" title="Scope and study area">
          <p>
            The domain covers {first} to {last} and the South Asian land area
            between 5–38°N and 60–100°E. Analyses are run at two scales: a
            gridded product (~2° resolution, about 200–220 km) for maps, and
            eight hazard regions drawn from geography rather than political
            borders for reporting and hazard work.
          </p>
          <DefinitionList
            items={[
              [
                "Unit of analysis",
                "Land grid cell; region aggregate for reporting.",
              ],
              [
                "Seasons",
                "Annual, pre-monsoon (Mar–May) and monsoon (Jun–Sep), as defined in the manifest.",
              ],
              [
                "Temperature form",
                `Anomalies relative to the ${t.baseline} baseline.`,
              ],
              [
                "Rainfall form",
                "Seasonal totals in millimetres, not anomalies.",
              ],
              [
                "Language of record",
                "English; the site also offers a narrative summary in Bangla.",
              ],
            ]}
          />
        </Section>

        <Section id="data" n="2" title="Data sources">
          <p>
            Table 1 lists every input. Trend products are restricted to records
            constructed to remain consistent over decades; visual layers on the
            satellite map may come from other products and are not used for any
            statistic.
          </p>
          <Table caption="Table 1. Input datasets, period covered and role in the analysis.">
            <thead className="bg-sunken text-ink-3">
              <tr>
                <th className="w-[16%] px-4 py-3 font-medium">Variable</th>
                <th className="px-4 py-3 font-medium">Dataset and period</th>
                <th className="w-[22%] px-4 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <Tr
                v="Temperature"
                d={`${t.dataset}; ${first}–${last}`}
                u="Trends"
                href={t.datasetUrl}
              />
              <Tr
                v="Rainfall"
                d={`${r.dataset}; ${first}–${last}`}
                u="Trends"
                href={r.datasetUrl}
              />
              <Tr
                v="Temperature (check)"
                d="CRU TS 4.10 station-based, University of East Anglia; same period"
                u="Replication"
                href="https://crudata.uea.ac.uk/cru/data/hrg/"
              />
              <Tr
                v="Wildfire"
                d="NASA FIRMS MODIS active fires (Terra + Aqua); 2003–2024"
                u="Hazard counts"
                href="https://firms.modaps.eosdis.nasa.gov/"
              />
              <Tr
                v="Landslides"
                d="NASA Global Landslide Catalog; 2007–2017"
                u="Hazard counts"
                href="https://data.nasa.gov/"
              />
              <Tr
                v="Floods"
                d="GDACS flood alerts (UN/EU); 2000–2025"
                u="Hazard counts"
                href="https://www.gdacs.org/"
              />
              <Tr
                v="Map imagery"
                d="NASA GIBS: MODIS LST and NDVI, MERRA-2, GLDAS"
                u="Visual only"
                href="https://earthdata.nasa.gov/gibs"
              />
              <Tr
                v="Soil water"
                d="SMAP L4 root-zone soil moisture; 2015–present"
                u="Visual only"
                href="https://smap.jpl.nasa.gov/"
              />
              <Tr
                v="Forest loss"
                d="Hansen/UMD Global Forest Change (Landsat), via Global Forest Watch"
                u="Visual only"
                href="https://glad.earthengine.app/view/global-forest-change"
              />
            </tbody>
          </Table>
          <Note title="Why MERRA-2 was rejected">
            <p>
              We initially used MERRA-2 precipitation. Plotted over the Bengal
              delta, it jumped from roughly 1,200 mm to 1,800 mm per year in
              1997 and to over 3,000 mm after 2015 — a discontinuity caused by
              changes in the observations assimilated into the reanalysis, not
              by rainfall. Its soil moisture inherits the same steps. Trends
              derived from it would have been confidently wrong, so GISTEMP and
              GPCP — records constructed for long-term consistency — replaced
              it. Every series is now plotted and inspected before its trend is
              reported. Soil water on the map is SMAP, a direct satellite
              retrieval available since 2015; MERRA-2 soil moisture is not used
              for any trend.
            </p>
          </Note>
        </Section>

        <Section id="trend-magnitude" n="3" title="Trend estimation">
          <p>
            The rate of change is estimated with{" "}
            <strong className="font-semibold text-ink">Sen&apos;s slope</strong>
            : the median of the slopes computed between every pair of
            observations. Unlike an ordinary least-squares fit, a single extreme
            year cannot dominate the estimate, which matters for short records
            <Cite keys={["Sen, P. K."]} />. The slope is reported per decade
            together with its{" "}
            <strong className="font-semibold text-ink">
              95% confidence interval
            </strong>
            , derived from the rank-based method of Gilbert
            <Cite keys={["Gilbert, R. O."]} />.
          </p>
          <Formula
            tex="b = median{ (xⱼ − xᵢ) / (tⱼ − tᵢ) : i < j }"
            caption="Sen's slope estimator, with t the year and x the annual value."
          />
          <p>
            Results are therefore reported as a point estimate and an interval,
            for example &ldquo;+0.31 °C per decade [+0.27, +0.36]&rdquo;, so
            that both the rate and its precision are visible. Slopes are quoted
            in the units of the underlying variable: °C per decade for
            temperature, mm per decade for rainfall.
          </p>
        </Section>

        <Section id="significance" n="4" title="Significance testing">
          <p>
            This section describes three tests applied in sequence. A trend is
            called significant only if it passes all three.
          </p>
          <Head3>4.1 Monotonic trend test</Head3>
          <p>
            The{" "}
            <strong className="font-semibold text-ink">
              Mann–Kendall test
            </strong>{" "}
            asks how often a record at least as ordered as the observed one
            would occur under the null hypothesis of no monotonic trend. A
            p-value below 0.05 means chance is an unlikely explanation.
          </p>
          <Head3>4.2 Autocorrelation correction</Head3>
          <p>
            Climate years are not independent: a warm year tends to follow
            another, which inflates the number of false trends reported by the
            plain test. We apply the{" "}
            <strong className="font-semibold text-ink">Hamed–Rao</strong>{" "}
            variance correction for serial autocorrelation before computing the
            p-value
            <Cite keys={["Hamed, K. H."]} />.
          </p>
          <Head3>4.3 Multiple testing across the map</Head3>
          <p>
            A map tests hundreds of cells simultaneously, so roughly 5% would
            appear significant by chance alone. We control the{" "}
            <strong className="font-semibold text-ink">
              false discovery rate
            </strong>{" "}
            using the Benjamini–Hochberg procedure at α<sub>FDR</sub> = 0.10
            <Cite keys={["Benjamini, Y."]} />, following the argument for
            map-wide correction made by Wilks
            <Cite keys={["Wilks, D. S."]} />. Only cells that pass this stage
            are rendered solid with a significance marker.
          </p>
          <Note title="Interpreting a null result">
            <p>
              Where no trend is detected we report &ldquo;no statistically
              detectable trend&rdquo;. This states that, over this record,
              year-to-year variability is too large to separate a trend from
              natural fluctuations. It does <em>not</em> establish that nothing
              is changing; a longer record or a larger spatial aggregate might
              resolve it.
            </p>
          </Note>
        </Section>

        <Section id="turning-points" n="4b" title="Turning points">
          <p>
            For every region and series we also ask where the record splits most sharply into a
            &ldquo;before&rdquo; and an &ldquo;after&rdquo;, using{" "}
            <strong className="font-semibold text-ink">Pettitt&apos;s test</strong>, a rank-based
            change-point test with no assumption about the shape of the data <Cite keys={["Pettitt"]} />.
            The statistic is the largest absolute value of U<sub>t</sub> = Σ<sub>i≤t</sub>Σ<sub>j&gt;t</sub>{" "}
            sign(x<sub>j</sub> − x<sub>i</sub>), with the approximate p-value 2·exp(−6K²/(n³+n²)). A split
            is reported only at p &lt; 0.05, with the averages before and after it.
          </p>
          <p>
            A steady trend also produces a split near the middle of the record, so the site words the
            result as &ldquo;the record splits most sharply around this year&rdquo;, never as &ldquo;the
            change began in this year&rdquo;. Output: <code className="rounded bg-sunken px-1.5 text-ink">trends/turning.json</code>{" "}
            (<code className="rounded bg-sunken px-1.5 text-ink">analysis/turning.py</code>).
          </p>
        </Section>

        <Section id="validation" n="5" title="Validation">
          <p>
            All primary trends were recomputed with a completely independent
            record,{" "}
            <strong className="font-semibold text-ink">CRU TS 4.10</strong> from
            the University of East Anglia, which is built from weather stations
            using separate methods
            <Cite keys={["Harris, I."]} />. Agreement between two independent
            estimates increases confidence; disagreement is reported rather than
            suppressed. Table 2 gives the region-level comparison.
          </p>
          <Table caption="Table 2. Region-level agreement between our estimates (first value) and CRU TS 4.10 (second value). * significant at p < 0.05.">
            <thead className="bg-sunken text-ink-3">
              <tr>
                <th className="w-[26%] px-4 py-3 font-medium">Region</th>
                <th className="px-4 py-3 font-medium">
                  Temperature, annual (°C / 10 yr)
                </th>
                <th className="px-4 py-3 font-medium">
                  Monsoon rain (mm / 10 yr)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {trendZones.map((z) => {
                const c = crosscheck.zones[z.id];
                if (!c) return null;
                return (
                  <tr key={z.id}>
                    <td className="px-4 py-3 font-medium text-ink">
                      {z.id === "study-area" ? "All of South Asia" : z.name}
                    </td>
                    <CheckCell pair={c["temperature_annual"]} decimals={2} />
                    <CheckCell pair={c["rainfall_monsoon"]} decimals={0} />
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="text-sm text-ink-3">
            <p>
              The two records agree on the direction of warming in every region,
              and on its significance in all but{" "}
              {regionName(warmSignificanceMismatch?.[0])}. For monsoon rain they
              agree on the headline pattern — wetter in the Indus plain, drier
              in the Bengal delta and the Northeast hills — but not in every
              region; rain-based findings are therefore assigned a lower
              confidence rating throughout the site.
            </p>
            <p className="mt-2">
              In {regionName(warmSignificanceMismatch?.[0])} our trend is
              significant (p &lt; 0.05) while CRU&apos;s is not, which is why
              that row is marked &ldquo;partly&rdquo;.
            </p>
          </div>
        </Section>

        <Section id="hazards" n="6" title="Hazard analysis">
          <p>
            For each hazard region we count recorded events per year and ask
            whether high-event years coincide with unusual heat or rainfall. We
            use a{" "}
            <strong className="font-semibold text-ink">
              Spearman rank correlation
            </strong>{" "}
            on series from which the long-term trend has been removed, so that
            two variables that both rise over time do not appear linked through
            a shared trend. A relationship is retained only if it is
            statistically significant <em>and</em> has the physically expected
            sign (more fires with more heat, more landslides with more rain).
          </p>
          <p>
            The relationship work is a research result, not an alerting product.
            The former{" "}
            <strong className="font-semibold text-ink">
              preparedness signal
            </strong>{" "}
            that compared a season with past high-event years was withdrawn: it
            was never validated against held-out events, so presenting it would
            have been a prediction without evidence. What the site shows today is
            only{" "}
            <strong className="font-semibold text-ink">
              observational screening
            </strong>{" "}
            — the rain against its own history — plus the historical frequency of
            catalogued floods at that rain level, each with its sample size. It
            never warns a district to prepare and it is never an official warning.
          </p>
        </Section>

        <Section id="intelligence" n="7" title="Climate hazard intelligence">
          <MethodsIntelligence thresholds={thresholds} sources={sources} evaluation={evaluation} />
        </Section>

        <Section id="signals" n="7b" title="Rain signals">
          <p>
            The Signals page lists every country and territory geoBoundaries publishes at ADM0
            ({geography.counts?.countries ?? geography.countries.length} of them) and each one&apos;s
            local administrative areas. ADM1 is published for {geography.counts?.ADM1 ?? "many"} of
            those countries ({geography.counts?.ADM1Areas ?? "thousands of"} areas) and ADM2 for{" "}
            {geography.counts?.ADM2 ?? "many"} ({geography.counts?.ADM2Areas ?? "tens of thousands of"}{" "}
            areas); a level is only shown where the source publishes it. Each level keeps the
            source&apos;s own name (Division, State / Union Territory, district, County, Province,
            Dzongdeys, Gewog, …). geoBoundaries provides geography only: no weather data and no
            scores.{" "}
            <Link href="/methods#signals-geography" className="underline decoration-line underline-offset-2 hover:text-ink">
              See how the levels and coverage are handled
            </Link>
            .
          </p>
          <p>
            The Signal page no longer uses a green/yellow/red danger scale. Each location instead
            carries three readable words: a <strong>Coverage state</strong> (Live Signal, Seasonal
            Context Only, or Can&apos;t Tell Here), a <strong>Watch Level</strong> (not elevated,
            elevated, high, or can&apos;t tell) and a <strong>Data Trust Grade</strong> (high, medium,
            low). A calm Watch Level means the rain is not unusual for the date — it never means the
            place is safe. Coverage is measured from the committed NASA analysis grids: a variable
            counts for an area when at least half of that variable&apos;s grid cells in the area&apos;s
            bounding box fall inside its boundary and carry a usable series. Those grids cover South
            Asia only, so countries outside that extent, and any area whose boundary holds no
            grid-cell centre, are shown as <strong>Can&apos;t Tell Here</strong> — a gap, never a calm
            or safe area.{" "}
            <Link href="/signal" className="underline decoration-line underline-offset-2 hover:text-ink">
              Open the Signal
            </Link>
          </p>
          <p>
            <strong>The daily rain readings on this site are currently fixed samples.</strong> They
            are labelled as such wherever they appear, on a fixed clock date, and are not presented
            as a live observation. The coverage counts, historical case sizes and the Accuracy
            backtest are computed from real committed datasets; when real IMERG readings replace the
            sample, the same files carry them and the sample label disappears. No probability,
            confidence percentage or accuracy score is shown anywhere unless it is computed from
            those data.
          </p>
          <p id="signals-geography" className="scroll-mt-24">
            <span className="font-medium text-ink">Geographic levels.</span> ADM0 is the country;
            ADM1 and ADM2 are its local levels, and the deepest published level is not always a
            district (Sri Lanka&apos;s gbOpen ADM1 and ADM2 labels are unset, and a few files name
            the country itself instead of a level, so the page says &ldquo;ADM1 areas&rdquo; and
            &ldquo;ADM2 areas&rdquo; rather than inventing a name). Countries without a level simply
            have no rows for it. The reusable identifier is stable per boundary: {" "}
            <code className="rounded bg-sunken px-1 text-xs">{"{iso}"}-adm0</code> for a country,{" "}
            <code className="rounded bg-sunken px-1 text-xs">{"{iso}"}-adm1-{"{slug}"}</code> and{" "}
            <code className="rounded bg-sunken px-1 text-xs">{"{iso}"}-adm2-{"{slug}"}</code> for
            areas, e.g. <code className="rounded bg-sunken px-1 text-xs">bgd-adm2-dhaka</code>.
            Every page that references a location can use the same ID.
          </p>
          <p>
            <span className="font-medium text-ink">Boundary provenance.</span> The committed record
            in <code className="rounded bg-sunken px-1 text-xs">public/data/geography/license.json</code>{" "}
            names the geoBoundaries boundary ID, represented year, license and upstream source for
            every country and level, alongside the dataset credits in{" "}
            <code className="rounded bg-sunken px-1 text-xs">public/data/signals/provenance.json</code>.
            Licenses differ by file (for example CC0 for Bangladesh ADM0/ADM1, CC BY 3.0 IGO for its
            ADM2), so credit is given per boundary, not once for the whole map.
          </p>
          <p>
            <span className="font-medium text-ink">Rebuild.</span>{" "}
            <code className="rounded bg-sunken px-1 text-xs">python build_geography.py</code> then{" "}
            <code className="rounded bg-sunken px-1 text-xs">python build_signal_scores.py</code>{" "}
            after <code className="rounded bg-sunken px-1 text-xs">build.py</code>. Both run offline
            from <code className="rounded bg-sunken px-1 text-xs">analysis/raw/</code> and write the
            committed files.
          </p>
        </Section>

        <Section id="trust" n="7c" title="Trust, Before, Now, Next and Evidence">
          <p>
            Each covered place opens a page of five strips. <strong className="font-semibold text-ink">Before</strong>{" "}
            is the analysis pipeline&apos;s own Sen slope and 95% interval, averaged over the grid
            cells whose centre lies inside the area&apos;s boundary (the same containment rule as the
            coverage measurement). <strong className="font-semibold text-ink">Now</strong> is the
            latest IMERG reading for the cell nearest the area&apos;s centre, compared with the same
            date in past years. A location with no elevated Watch Level reads &ldquo;No unusual
            signal in our data. This is not an all-clear.&rdquo; — never &ldquo;safe&rdquo;. The
            daily reading is a fixed sample on this site today, and is labelled as such.{" "}
          </p>
          <p>
            <strong className="font-semibold text-ink">Next</strong> — a 7-day rain outlook from
            Open-Meteo — is withheld entirely unless it passes the evidence rules on the Accuracy
            page (a named external forecast, a historical sample of at least 10, backtest lift above
            1, and a statistical interval that excludes 1). While it fails those rules the site
            shows &ldquo;Not enough evidence here&rdquo; instead of a forecast, and the outlook can
            never change a Watch Level.{" "}
            <strong className="font-semibold text-ink">Trust</strong> reuses only the interval above:
            an area is <em>Detectable</em> when the area-mean 95% interval leaves zero in at least
            one variable, a <em>blind spot</em> when none does, and <em>no history</em> when no
            gridded cells fall inside it. It is not a probability and not a confidence percentage.
          </p>
          <p>
            <strong className="font-semibold text-ink">Evidence</strong> plots the last 15 years of
            rain at the place from Open-Meteo&apos;s historical archive — a different product from
            IMERG — and marks flood years from the GDACS flood catalogue. Missing years stay visible
            as gaps. The file is written by{" "}
            <code className="rounded bg-sunken px-1 text-xs">python place.py --refresh</code>; the
            offline build stays deterministic and leaves it untouched.
          </p>
          <p>
            <Link href="/accuracy" className="underline decoration-line underline-offset-2 hover:text-ink">
              Trust and evidence
            </Link>{" "}
            shows the replayed flood events (misses included) and the leads we do not measure yet.
          </p>
        </Section>

        <Section id="twins" n="7d" title="Climate twins">
          <p>
            Global land between 55°S and 75°N is divided into {twins.block}° × {twins.block}° blocks; the{" "}
            {twins.blocks.length} blocks with at least 35% land and complete records are kept. Each block
            and each South Asian region receives the same tests as Sections 3–4 on the same records
            (GISTEMP, GPCP), giving a five-part fingerprint: warming rate (°C per decade), yearly and
            local rainy-season rain trends (% of the mean per decade; the rainy season is each place&apos;s
            four consecutive wettest months), log mean yearly rain, and the share of rain falling in the
            rainy season. The last two keep a desert from matching a delta merely because both trends are
            flat.
          </p>
          <p>
            Features are standardised robustly (median and interquartile range over global land, clipped
            at ±4), weighted (rainy-season trend 1.5, seasonality 0.75, others 1) and compared by
            Euclidean distance: a nearest-neighbour search. Twins must lie outside the study area and at
            least 10° apart. Disasters per block come from GDACS flood, drought and tropical-cyclone
            alerts (2000–2025) and the NASA Global Landslide Catalog <Cite keys={["Kirschbaum"]} />; GDACS
            points lying more than 3° from every country the record itself names are discarded. A shared
            trend is not a shared fate: exposure, terrain and reporting differ between twins.
          </p>
        </Section>

        <Section id="projections" n="7e" title="Future projections">
          <p>
            Projections come from NASA&apos;s{" "}
            <strong className="font-semibold text-ink">NEX-GDDP-CMIP6</strong> <Cite keys={["Thrasher"]} />:
            daily CMIP6 temperature and precipitation, bias-corrected and downscaled to 0.25°. We use
            {" "}{outlook.models.length} models from different centres ({outlook.models.join(", ")}), the
            historical run {outlook.present[0]}–{outlook.present[1]} and the SSP2-4.5 and SSP5-8.5 runs for{" "}
            {outlook.future[0]}–{outlook.future[1]}, subset to the study area at 1° through NASA NCCS THREDDS.
          </p>
          <p>
            Every change is computed for each model against its own historical run, so model bias cancels;
            we report the ensemble median, the model range and how many models agree on the sign
            (two-thirds or more is treated as agreement). Very heavy rain days use each grid square&apos;s
            95th percentile of wet days (≥ 1 mm) in the historical run; unusually hot days use the 95th
            percentile of the same calendar month. The site&apos;s future-risk number is a count, not a
            model: each model&apos;s own 1-in-10 level in {outlook.present[0]}–{outlook.present[1]} (its
            90th percentile, or 10th for dry monsoons) and the share of {outlook.future[0]}–
            {outlook.future[1]} years beyond it.
          </p>
        </Section>

        <Section id="disaster-model" n="7f" title="Disaster-year model">
          <p>
            Before turning projections into disaster odds we test whether a year&apos;s climate can tell a
            high-event year (at or above a region&apos;s 75th-percentile event count) from an ordinary one.
            Each region gets an L2 logistic regression on the drivers the hazard pipeline had already
            assigned to it (Section 6), so the inputs were not chosen for the score. Evaluation uses only
            unseen years: leave-one-year-out Brier skill against the base rate, leave-pair-out AUC (pooled
            leave-one-out AUC is biased towards 0 on small samples <Cite keys={["Airola"]} />), a
            label-permutation test, and Benjamini–Hochberg adjustment across regions{" "}
            <Cite keys={["Benjamini"]} />. A region passes only with Brier skill &gt; {risk.skillRule.bss},
            AUC ≥ {risk.skillRule.auc} and adjusted p ≤ {risk.skillRule.p}; only passing regions would have
            projected odds.
          </p>
          <p>
            Result: {riskPassed} of {risk.regions.length} regions pass, on {Math.min(...riskYears)}–
            {Math.max(...riskYears)} years of records each. {riskPassed === 0
              ? "The Future Outlook therefore uses the model-free counts of Section 7e, and the scorecard is published as a negative result."
              : "Only those regions carry projected odds; the rest use the model-free counts of Section 7e."}
          </p>
        </Section>

        <Section id="limitations" n="8" title="Limitations">
          <ol className="list-decimal space-y-2 pl-5 marker:text-ink-3">
            <li>
              Grid resolution is coarse (2°–2.5°, roughly 200–280 km), so local
              extremes are smoothed out.
            </li>
            <li>
              Hazard regions are approximate rectangles, not exact catchments or
              forest boundaries; edge effects are not modelled.
            </li>
            <li>
              Event records are incomplete: news-based landslide reporting
              misses remote areas, satellites miss fires under cloud, and GDACS
              coverage improved over the period.
            </li>
            <li>
              The landslide record spans 11 years, too short to support a trend
              in event counts; it is used only for relationships with drivers.
            </li>
            <li>
              Correlation is not causation: land use, deforestation, road
              building and human ignition also influence these hazards and are
              not included as covariates.
            </li>
            <li>
              Cross-check agreement is a consistency test, not an independent
              validation of every grid cell.
            </li>
            <li>
              Climate twins share a trend fingerprint, not a fate; disaster
              catalogues under-report poorer and remote places, so differences in
              recorded events between twins are partly differences in reporting.
            </li>
            <li>
              Projections use {outlook.models.length} models at 1°; rainfall
              changes are less certain than temperature changes, and local
              extremes are sharper than any 1° average.
            </li>
            <li>
              Disaster records of 11–26 years are too short for the disaster-year
              model to show skill; a longer, consistently reported record would be
              needed before projecting disaster odds.
            </li>
          </ol>
        </Section>

        <Section id="reproducibility" n="9" title="Reproducibility">
          <p>
            All code and derived data are open source at{" "}
            <a href={REPO} className="break-words text-accent hover:underline">
              {REPO.replace("https://", "")}
            </a>
            . The{" "}
            <code className="rounded bg-sunken px-1.5 text-ink">analysis/</code>{" "}
            directory regenerates every number on this site from the public
            inputs:
          </p>
          <pre className="overflow-x-auto rounded-lg border border-line bg-card p-4 font-mono text-xs leading-relaxed text-ink-2">
            <code>{`cd analysis
pip install -r requirements.txt
python build.py          # trends and zone summaries
python build_hazards.py  # hazard counts and driver links
python cyclones.py       # cyclone tracks and basin sea warmth
python crosscheck.py     # CRU TS 4.10 replication
python latest.py         # latest month vs normal
python intelligence.py   # conclusions, alerts, confidence, history
python evaluate.py       # backtest and evaluation metrics
python turning.py        # Pettitt turning points
python twins.py          # climate twins (global blocks, disasters)
python cmip6_download.py # NEX-GDDP-CMIP6 subsets (no login)
python future.py         # future outlook
python risk.py           # disaster-year model scorecard`}</code>
          </pre>
          <p>
            Python tests cover the statistical procedures (
            <code className="rounded bg-sunken px-1.5 text-ink">
              python -m pytest -q
            </code>
            ). No credentials are required. The results shown throughout this
            site were generated on {manifest.generated}.
          </p>
        </Section>

        <Section id="citation" n={null} title="How to cite this work">
          <p>
            Every chart has a &ldquo;Download the data (CSV)&rdquo; button. If
            you use the data or these results, please cite the work as follows.
          </p>
          <blockquote className="break-words rounded-lg border-l-2 border-accent bg-card p-4 text-sm leading-relaxed text-ink">
            {CITATION}
          </blockquote>
        </Section>

        <Section id="references" n={null} title="References">
          <ol className="space-y-3 text-sm leading-relaxed text-ink-2">
            {REFERENCES.map((ref, i) => (
              <li
                key={ref.url}
                id={`ref-${i + 1}`}
                className="grid grid-cols-[2rem_minmax(0,1fr)] scroll-mt-24"
              >
                <span className="tabular-nums text-ink-3">{i + 1}.</span>
                <span>
                  {ref.en}{" "}
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-accent hover:underline"
                  >
                    {ref.url}
                  </a>
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <div className="mt-12 border-t border-line pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            <T en="Related sections" bn="সম্পর্কিত অংশ" />
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            <li>
              <Link
                href="/replay"
                className="block rounded-lg border border-line bg-card p-4 transition-colors hover:border-ink-3"
              >
                <span className="text-sm font-medium text-ink">
                  <T en="Replay" bn="পুনরাবৃত্তি" /> →
                </span>
                <span className="mt-1 block text-sm text-ink-3">
                  <T
                    en="The historical rain record replayed against catalogued floods."
                    bn="নথিভুক্ত বন্যার সাথে ঐতিহাসিক বৃষ্টির রেকর্ড পুনরাবৃত্ত।"
                  />
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/accuracy"
                className="block rounded-lg border border-line bg-card p-4 transition-colors hover:border-ink-3"
              >
                <span className="text-sm font-medium text-ink">
                  <T en="Accuracy" bn="নির্ভুলতা" /> →
                </span>
                <span className="mt-1 block text-sm text-ink-3">
                  <T
                    en="The backtest behind the Data Trust Grade, and the tests that failed."
                    bn="তথ্য-ভরসার গ্রেডের পেছনের ব্যাকটেস্ট, ও যেসব পরীক্ষা ব্যর্থ হয়েছে।"
                  />
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </article>
    </div>
  );
}

function KeyFindings() {
  const items = [
    [
      "Warming",
      "Statistically significant at every hazard region and in the regional mean.",
    ],
    [
      "Rainfall",
      "Shifts are spatially uneven and individually weaker; fewer regions pass both significance and replication.",
    ],
    [
      "Hazards",
      "Links are accepted only where the correlation is significant and physically expected; otherwise no signal is issued.",
    ],
    [
      "Independence",
      "Every headline trend is replicated with a second, station-based record (CRU TS 4.10).",
    ],
  ];
  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
        Key results
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        {items.map(([k, v]) => (
          <div
            key={k}
            className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3"
          >
            <dt className="font-medium text-ink">{k}</dt>
            <dd className="text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const AGREE_STYLE: Record<Agreement, { text: string; cls: string }> = {
  agree: { text: "agree", cls: "bg-accent-soft text-ink" },
  partly: { text: "partly", cls: "bg-sunken text-ink-2" },
  disagree: { text: "disagree", cls: "bg-watch-soft text-ink" },
};

function CheckCell({
  pair,
  decimals,
}: {
  pair?: { ours: TrendSummary | null; cru: TrendSummary | null };
  decimals: number;
}) {
  if (!pair?.ours || !pair.cru)
    return <td className="px-4 py-3 text-ink-3">–</td>;
  const star = (t: TrendSummary) => (t.p < 0.05 ? "*" : "");
  const a = AGREE_STYLE[agreement(pair.ours, pair.cru)];
  return (
    <td className="px-4 py-3">
      <span className="tabular-nums text-ink-2">
        {formatSigned(pair.ours.slopePerDecade, decimals)}
        {star(pair.ours)} / {formatSigned(pair.cru.slopePerDecade, decimals)}
        {star(pair.cru)}
      </span>{" "}
      <span
        className={`ml-1 rounded px-1.5 py-0.5 text-xs font-medium ${a.cls}`}
      >
        {a.text}
      </span>
    </td>
  );
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string | null;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="mt-12 scroll-mt-24"
    >
      <h2
        id={`${id}-heading`}
        className="border-b border-line pb-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl"
      >
        {n && <span className="mr-2 tabular-nums text-ink-3">{n}</span>}
        {title}
      </h2>
      <div className="mt-5 space-y-4 leading-7 text-ink-2 [overflow-wrap:anywhere]">
        {children}
      </div>
    </section>
  );
}

function Head3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 text-[15px] font-semibold text-ink">{children}</h3>
  );
}

function Table({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[640px] table-fixed text-left text-sm">
          {children}
        </table>
      </div>
      <figcaption className="text-xs leading-relaxed text-ink-3">
        {caption}
      </figcaption>
    </figure>
  );
}

function Tr({
  v,
  d,
  u,
  href,
}: {
  v: string;
  d: string;
  u: string;
  href: string;
}) {
  return (
    <tr>
      <td className="px-4 py-3 align-top font-medium text-ink">{v}</td>
      <td className="px-4 py-3 align-top">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-ink-2 hover:text-accent hover:underline"
        >
          {d}
        </a>
      </td>
      <td className="px-4 py-3 align-top text-ink-3">{u}</td>
    </tr>
  );
}

function Note({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line border-l-2 border-l-accent bg-card p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <div className="mt-1 text-sm leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

function Formula({ tex, caption }: { tex: string; caption: string }) {
  return (
    <Figure caption={caption}>
      <span className="font-mono text-sm text-ink">{tex}</span>
    </Figure>
  );
}

function Figure({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="rounded-lg border border-line bg-sunken px-4 py-3">
      <div className="overflow-x-auto">{children}</div>
      <figcaption className="mt-1 text-xs text-ink-3">{caption}</figcaption>
    </figure>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-3">{label}</dt>
      <dd className="mt-0.5 tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function DefinitionList({ items }: { items: [string, string][] }) {
  return (
    <dl className="divide-y divide-line rounded-lg border border-line bg-card text-sm">
      {items.map(([k, v]) => (
        <div
          key={k}
          className="grid gap-1 px-4 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
        >
          <dt className="font-medium text-ink">{k}</dt>
          <dd className="text-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
