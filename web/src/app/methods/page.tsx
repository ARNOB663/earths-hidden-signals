import type { Metadata } from "next";
import Link from "next/link";
import { readCrosscheck, readManifest, readTrendZones } from "@/lib/data";
import { CITATION } from "@/lib/download";
import { T } from "@/lib/i18n";
import { agreement, formatSigned, type Agreement, type TrendSummary } from "@/lib/trends";

export const metadata: Metadata = { title: "How it works · Earth's Hidden Signals" };

const REPO = "https://github.com/ARNOB663/earths-hidden-signals";

const QUESTIONS = [
  {
    q: "What is changing?",
    a: "Surface temperature and rainfall, plus the hazard events that follow them.",
    qBn: "কী বদলাচ্ছে?",
    aBn: "ভূপৃষ্ঠের তাপমাত্রা ও বৃষ্টি, আর এগুলোর পরে যেসব দুর্যোগ ঘটে।",
  },
  {
    q: "Where?",
    a: "Every land grid cell in South Asia (5–38°N, 60–100°E), and eight hazard regions drawn by geography, not borders.",
    qBn: "কোথায়?",
    aBn: "দক্ষিণ এশিয়ার (৫–৩৮° উ, ৬০–১০০° পূ) প্রতিটি স্থলভাগের বর্গ, আর দেশের সীমানা নয়, ভূগোল দেখে আঁকা আটটি দুর্যোগ-অঞ্চল।",
  },
  {
    q: "How much?",
    a: "Sen's slope: the rate of change per decade, with a 95% confidence range.",
    qBn: "কতটা?",
    aBn: "সেনের ঢাল (Sen's slope): প্রতি দশকে পরিবর্তনের হার, ৯৫% আস্থা-সীমাসহ।",
  },
  {
    q: "Is it significant?",
    a: "A Mann–Kendall test corrected for autocorrelation, plus a map-wide false-discovery check.",
    qBn: "এটা কি সত্যিকারের পরিবর্তন?",
    aBn: "স্বসম্পর্ক (autocorrelation) সংশোধিত ম্যান-কেন্ডাল পরীক্ষা, আর পুরো মানচিত্রজুড়ে ভুল-আবিষ্কার (FDR) যাচাই।",
  },
];

const REFERENCES = [
  "Lenssen, N. et al. (2019). Improvements in the GISTEMP uncertainty model. J. Geophys. Res. Atmos. 124.",
  "Adler, R. F. et al. (2018). The Global Precipitation Climatology Project (GPCP) monthly analysis (new version 2.3). Atmosphere 9(4).",
  "Hamed, K. H. & Rao, A. R. (1998). A modified Mann–Kendall trend test for autocorrelated data. J. Hydrology 204.",
  "Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. J. Am. Stat. Assoc. 63.",
  "Gilbert, R. O. (1987). Statistical Methods for Environmental Pollution Monitoring. Van Nostrand Reinhold.",
  "Benjamini, Y. & Hochberg, Y. (1995). Controlling the false discovery rate. J. R. Stat. Soc. B 57.",
  "Wilks, D. S. (2016). “The stippling shows statistically significant grid points.” Bull. Am. Meteorol. Soc. 97.",
  "Hansen, M. C. et al. (2013). High-resolution global maps of 21st-century forest cover change. Science 342.",
  "Kirschbaum, D. et al. (2015). Spatial and temporal analysis of a global landslide catalog. Geomorphology 249.",
  "Giglio, L. et al. (2016). The Collection 6 MODIS active fire detection algorithm and fire products. Remote Sens. Environ. 178.",
];

export default async function MethodsPage() {
  const [manifest, crosscheck, trendZones] = await Promise.all([readManifest(), readCrosscheck(), readTrendZones()]);
  const [first, last] = [manifest.years[0], manifest.years[manifest.years.length - 1]];
  const t = manifest.variables.temperature;
  const r = manifest.variables.rainfall;

  return (
    <article className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-12 leading-relaxed text-ink-2 sm:px-6 [&>*]:max-w-3xl">
      <p className="text-sm font-medium text-accent">
        <T en="How it works" bn="কীভাবে কাজ করে" />
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">
        <T en="How we know a change is real" bn="পরিবর্তনটা যে সত্যি, তা আমরা কীভাবে জানি" />
      </h1>
      <p className="mt-4 text-lg text-ink-2">
        <T
          en="A line on a chart that goes up is not yet a trend. We check that the data is consistent over time, test whether the change could be chance, and say clearly when it could."
          bn="চার্টে একটা রেখা ওপরে উঠলেই তা প্রবণতা নয়। আমরা দেখি তথ্য সময়ের সাথে সামঞ্জস্যপূর্ণ কি না, পরীক্ষা করি পরিবর্তনটা কাকতালীয় হতে পারে কি না, আর হতে পারলে তা স্পষ্ট করে বলি।"
        />
      </p>
      <T
        en={null}
        bn={
          <p className="mt-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-ink">
            এই পাতার বাকি অংশ বিজ্ঞানী ও বিচারকদের জন্য, তাই প্রযুক্তিগত বিবরণ ইংরেজিতে রাখা হয়েছে। সহজ ব্যাখ্যার জন্য
            &ldquo;গল্পটা&rdquo; পাতা দেখুন।
          </p>
        }
      />

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {QUESTIONS.map(({ q, a, qBn, aBn }) => (
          <div key={q} className="rounded-2xl bg-card p-5 shadow-soft">
            <div className="font-semibold text-ink">
              <T en={q} bn={qBn} />
            </div>
            <p className="mt-1 text-sm text-ink-2">
              <T en={a} bn={aBn} />
            </p>
          </div>
        ))}
      </div>

      <Section title="1. Data">
        <div className="overflow-x-auto rounded-2xl bg-card shadow-soft">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-sunken text-ink-3">
              <tr>
                <th className="px-3 py-2.5 font-medium">Variable</th>
                <th className="px-3 py-2.5 font-medium">Dataset</th>
                <th className="px-3 py-2.5 font-medium">Used for</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <Tr v="Temperature" d={`${t.dataset}, ${first}–${last}`} u="Trend analysis (anomalies vs 1951–1980)" href={t.datasetUrl} />
              <Tr v="Rainfall" d={`${r.dataset}, ${first}–${last}`} u="Trend analysis (seasonal totals)" href={r.datasetUrl} />
              <Tr v="Wildfire" d="NASA FIRMS MODIS active fires (Terra + Aqua), 2003–2024" u="Hazard events" href="https://firms.modaps.eosdis.nasa.gov/" />
              <Tr v="Landslides" d="NASA Global Landslide Catalog, 2007–2017" u="Hazard events" href="https://data.nasa.gov/" />
              <Tr v="Floods" d="GDACS flood alerts (UN/EU), 2000–2025" u="Hazard events" href="https://www.gdacs.org/" />
              <Tr v="Map imagery" d="NASA GIBS: MODIS surface temperature and NDVI, MERRA-2, GLDAS" u="Satellite map (visual only)" href="https://earthdata.nasa.gov/gibs" />
              <Tr v="Forest loss" d="Hansen/UMD Global Forest Change (Landsat), via Global Forest Watch" u="Satellite map" href="https://glad.earthengine.app/view/global-forest-change" />
            </tbody>
          </table>
        </div>
        <Callout title="A dataset we rejected">
          We first used NASA POWER (MERRA-2) rainfall. When we plotted it, rainfall over the Bengal delta jumped from about
          1,200 mm to about 1,800 mm a year in 1997, and to over 3,000 mm after 2015. Real rain doesn&apos;t do that; the jumps
          come from changes in the observations fed into the model. Its soil moisture inherits the same jumps. Trends
          from it would have been confidently wrong, so we switched to GISTEMP and GPCP, records built to stay consistent
          over decades. We now always plot a series before we trust its trend.
        </Callout>
      </Section>

      <Section title="2. How much is it changing?">
        <p>
          We use <strong className="font-semibold text-ink">Sen&apos;s slope</strong>: the median of the slopes between every pair of
          years. Unlike a straight-line fit, one extreme year can&apos;t drag it. We report it per decade with a{" "}
          <strong className="font-semibold text-ink">95% confidence range</strong> (Gilbert 1987), so &ldquo;+0.31 °C per decade
          (+0.27 to +0.36)&rdquo; tells you both the rate and how sure we are of it.
        </p>
      </Section>

      <Section title="3. Is it significant?">
        <p>
          The <strong className="font-semibold text-ink">Mann–Kendall test</strong> asks: if there were no trend, how likely would
          it be to see this many years higher than earlier years? A small p-value (below 0.05) means chance is an unlikely
          explanation.
        </p>
        <p>
          Climate years aren&apos;t independent: a warm year is often followed by another. That makes the plain test
          report too many false trends, so we use the <strong className="font-semibold text-ink">Hamed–Rao correction</strong> for
          autocorrelation.
        </p>
        <p>
          A map tests hundreds of cells at once, so about 5% would look significant by luck alone. We apply a{" "}
          <strong className="font-semibold text-ink">false discovery rate</strong> check (Benjamini–Hochberg, α<sub>FDR</sub> = 0.10,
          following Wilks 2016). Only cells that pass it are drawn solid with a dot.
        </p>
        <Callout title="When a result is not significant">
          We say so plainly: &ldquo;No statistically detectable trend.&rdquo; This means the ups and downs from year to year
          are too large, over this record, to separate a real trend from natural variability. It does{" "}
          <em>not</em> prove nothing is changing. A longer record or a larger area might show it.
        </Callout>
      </Section>

      <Section title="Do other datasets agree?">
        <p>
          We repeated the main trends with a completely separate climate record, <strong className="font-semibold text-ink">CRU TS 4.10</strong>{" "}
          from the University of East Anglia, which is built from weather stations with its own methods. Where both records tell
          the same story, we can be more confident. Where they don&apos;t, we say so.
        </p>
        <div className="overflow-x-auto rounded-2xl bg-card shadow-soft">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-sunken text-ink-3">
              <tr>
                <th className="px-3 py-2.5 font-medium">Region</th>
                <th className="px-3 py-2.5 font-medium">Temperature, whole year (°C per 10 years)</th>
                <th className="px-3 py-2.5 font-medium">Monsoon rain (mm per 10 years)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {trendZones.map((z) => {
                const c = crosscheck.zones[z.id];
                if (!c) return null;
                return (
                  <tr key={z.id}>
                    <td className="px-3 py-2.5 font-medium text-ink">{z.id === "study-area" ? "All of South Asia" : z.name}</td>
                    <CheckCell pair={c["temperature_annual"]} decimals={2} />
                    <CheckCell pair={c["rainfall_monsoon"]} decimals={0} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-ink-3">
          Each cell shows our value, then CRU&apos;s. * = a clear (statistically significant) change. The two agree on warming
          everywhere. For rain they agree on the headline pattern (Indus plain wetter; Bengal delta and Northeast hills drier) but
          not for every region, which is why rain findings get a lower &ldquo;how sure&rdquo; rating.
        </p>
      </Section>

      <Section title="4. From trends to hazards">
        <p>
          For each hazard region we count past events per year, then ask whether high-event years line up with unusual
          heat or rain. We use a Spearman correlation after removing each series&apos; long-term trend, so two things that
          simply both rise over time don&apos;t look connected. A link only counts if it is significant and points the
          physically expected way (more fires with more heat, more landslides with more rain).
        </p>
        <p>
          Where a link exists, the <strong className="font-semibold text-ink">preparedness signal</strong> compares the latest
          season with the conditions seen in past high-event years. If they match, authorities could raise monitoring,
          ready resources and warn vulnerable areas.{" "}
          <strong className="font-semibold text-ink">It never says a disaster will happen.</strong> Where no link exists, we give no
          signal at all.
        </p>
      </Section>

      <Section title="5. Limitations">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Grids are coarse (2°–2.5°, about 200–280 km), so local extremes are smoothed out.</li>
          <li>Hazard regions are approximate rectangles, not exact watersheds or forest boundaries.</li>
          <li>Event records are incomplete: news-based landslide reports miss remote areas, satellites miss fires under cloud, and GDACS coverage improved over time.</li>
          <li>The landslide record covers only 11 years, which is too short for a trend in event counts.</li>
          <li>Correlation is not causation: land use, deforestation, road building and human ignition also drive these hazards.</li>
        </ul>
      </Section>

      <Section title="6. Reproduce it">
        <p>
          Everything is open source at{" "}
          <a href={REPO} className="text-accent hover:underline">
            github.com/ARNOB663/earths-hidden-signals
          </a>
          . The <code className="rounded bg-sunken px-1.5 text-ink">analysis/</code> folder rebuilds every number on
          this site from the public data with <code className="rounded bg-sunken px-1.5 text-ink">python build.py</code>{" "}
          and <code className="rounded bg-sunken px-1.5 text-ink">python build_hazards.py</code>. No login is needed.
          Results generated {manifest.generated}.
        </p>
      </Section>

      <Section title="How to cite this work">
        <p>Every chart on the site has a &ldquo;Download the data (CSV)&rdquo; button. If you use the data or the results, please cite:</p>
        <p className="rounded-2xl bg-card p-4 font-mono text-sm leading-relaxed text-ink shadow-soft">{CITATION}</p>
      </Section>

      <Section title="References">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-3">
          {REFERENCES.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ol>
      </Section>

      <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/trends" className="inline-flex min-h-10 items-center font-medium text-accent hover:underline">
          <T en="Explore the climate trends →" bn="জলবায়ুর প্রবণতা ঘুরে দেখুন →" />
        </Link>
        <Link href="/hazards" className="inline-flex min-h-10 items-center font-medium text-accent hover:underline">
          <T en="Check disaster risk →" bn="দুর্যোগের ঝুঁকি দেখুন →" />
        </Link>
      </div>
    </article>
  );
}

const AGREE_STYLE: Record<Agreement, { text: string; cls: string }> = {
  agree: { text: "Agree", cls: "bg-accent-soft text-ink" },
  partly: { text: "Partly", cls: "bg-sunken text-ink-2" },
  disagree: { text: "Disagree", cls: "bg-watch-soft text-ink" },
};

function CheckCell({ pair, decimals }: { pair?: { ours: TrendSummary | null; cru: TrendSummary | null }; decimals: number }) {
  if (!pair?.ours || !pair.cru) return <td className="px-3 py-2.5 text-ink-3">–</td>;
  const star = (t: TrendSummary) => (t.p < 0.05 ? "*" : "");
  const a = AGREE_STYLE[agreement(pair.ours, pair.cru)];
  return (
    <td className="px-3 py-2.5">
      <span className="tabular-nums text-ink-2">
        {formatSigned(pair.ours.slopePerDecade, decimals)}
        {star(pair.ours)} / {formatSigned(pair.cru.slopePerDecade, decimals)}
        {star(pair.cru)}
      </span>{" "}
      <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${a.cls}`}>{a.text}</span>
    </td>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 space-y-3">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl bg-accent-soft p-5">
      <div className="font-semibold text-ink">{title}</div>
      <p className="mt-1 text-ink-2">{children}</p>
    </div>
  );
}

function Tr({ v, d, u, href }: { v: string; d: string; u: string; href: string }) {
  return (
    <tr>
      <td className="px-3 py-2.5 font-medium text-ink">{v}</td>
      <td className="px-3 py-2.5">
        <a href={href} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-accent hover:underline">
          {d}
        </a>
      </td>
      <td className="px-3 py-2.5 text-ink-3">{u}</td>
    </tr>
  );
}
