import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/lib/i18n";
import { readCoverage, readGeographyIndex } from "@/lib/geography/data";
import { readPlaces, readSignalsConfig, readSignalsMeta } from "@/lib/signals/data";
import { Eyebrow } from "@/components/ui/primitive";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "The monitoring gap · Earth's Hidden Signals",
  description:
    "How much of the world's administrative map Earth observation can actually support a decision on, and where nobody is watching. Geography is not measurement. Not a forecast or an official warning.",
};

/**
 * The Gap Atlas: geography listed vs geography actually measured. Every count is computed from the
 * loaded files, never hardcoded. A country with no data is correct output, not a bug — the page's
 * whole point is to show that gap rather than hide it.
 */
export default async function GapPage() {
  const [geography, coverage, places, meta, config] = await Promise.all([
    readGeographyIndex(),
    readCoverage(),
    readPlaces(),
    readSignalsMeta(),
    readSignalsConfig(),
  ]);

  // Listed: every boundary geoBoundaries publishes.
  const listedCountries = geography.counts?.countries ?? 0;
  const listedAdm1 = geography.counts?.ADM1Areas ?? 0;
  const listedAdm2 = geography.counts?.ADM2Areas ?? 0;

  // Measured: the countries whose boundaries overlap the NASA analysis grids.
  const measuredCountries = coverage.measuredCountries ?? [];
  const extent = coverage.gridExtent;

  // Decision-ready: the areas with a place record — a real Now reading and a Trust label.
  const trust = places.areas.reduce(
    (acc, area) => ({ ...acc, [area.trust.state]: acc[area.trust.state] + 1 }),
    { detectable: 0, "blind-spot": 0, "no-data": 0 } as Record<string, number>,
  );
  const withReading = places.areas.filter((area) => area.now.state === "measured").length;

  // Per-dataset coverage with its own denominators, computed from the coverage file. "Covered"
  // is the number of listed areas the variable actually reaches; the share is always shown beside
  // the areas that were examined, so a percentage is never printed without its sample size.
  const datasets = Object.entries(coverage.variables).map(([key, variable]) => {
    let covered = 0;
    let examined = 0;
    let coveredCells = 0;
    for (const area of coverage.areas) {
      const cell = area.cells[key];
      if (!cell) continue;
      examined += 1;
      if (cell.covered) covered += 1;
      coveredCells += cell.coveredCells;
    }
    return {
      key,
      name: variable.name,
      nameBn: variable.nameBn,
      dataset: variable.dataset,
      unit: variable.unit,
      gridDegrees: variable.gridDegrees,
      observedThrough: variable.observedThrough,
      years: variable.years,
      unusableRows: variable.unusableRows,
      covered,
      examined,
      coveredCells,
      missing: examined - covered,
    };
  });
  // Datasets the pipeline does not yet carry, stated as a gap rather than filled in.
  const MISSING_DATASETS = [
    {
      en: "Daily satellite rain (NASA IMERG)",
      bn: "দৈনিক স্যাটেলাইট বৃষ্টি (নাসা IMERG)",
      why: {
        en: "The daily screen runs on fixed sample readings on this site; real IMERG replays have not been built, so no day-level flood screen is shown as a current result.",
        bn: "এই সাইটে দৈনিক স্ক্রিনিং স্থির নমুনা পাঠে চলে; বাস্তব IMERG পুনরাবৃত্তি তৈরি হয়নি, তাই কোনো দৈনিক বন্যা-স্ক্রিনিং বর্তমান ফলাফল হিসেবে দেখানো হয় না।",
      },
    },
    {
      en: "Soil moisture and river levels (SMAP, discharge gauges)",
      bn: "মাটির আর্দ্রতা ও নদীর জলস্তর (SMAP, ডিসচার্জ গেজ)",
      why: {
        en: "Not integrated. A rain anomaly is not a flood measurement, and without soil or river data the screen cannot tell when rain becomes water on the ground.",
        bn: "সংযুক্ত নয়। বৃষ্টির অস্বাভাবিকতা বন্যার পরিমাপ নয়, আর মাটি বা নদীর তথ্য ছাড়া স্ক্রিনিং বুঝতে পারে না কখন বৃষ্টি মাটিতে পানি হয়ে ওঠে।",
      },
    },
    {
      en: "Observed flood extent (radar / optical flood water)",
      bn: "পর্যবেক্ষিত বন্যার বিস্তার (রাডার / অপটিক্যাল বন্যার পানি)",
      why: {
        en: "No committed flood-extent layer. Floods enter only as catalogue records (GDACS), not as mapped water.",
        bn: "কোনো সংরক্ষিত বন্যা-বিস্তারের স্তর নেই। বন্যা কেবল ক্যাটালগ-রেকর্ড (GDACS) হিসেবে আসে, মানচিত্রিত পানি হিসেবে নয়।",
      },
    },
    {
      en: "Outlook (7-day rainfall forecast)",
      bn: "পূর্বাভাস (৭ দিনের বৃষ্টির পূর্বাভাস)",
      why: {
        en: "An external forecast exists, but it is withheld until it meets the evidence conditions on the Accuracy page. It is not shown.",
        bn: "একটি বাহ্যিক পূর্বাভাস আছে, কিন্তু নির্ভুলতা পাতার প্রমাণ-শর্ত পূরণ না হওয়া পর্যন্ত তা দেখানো হয় না।",
      },
    },
  ];

  const pct = (part: number, whole: number) => (whole === 0 ? "0" : Math.round((part / whole) * 1000) / 10);
  const rungs = [
    {
      id: "listed",
      label: { en: "Listed", bn: "তালিকাভুক্ত" },
      value: listedCountries,
      unit: { en: "countries", bn: "দেশ" },
      body: {
        en: "Every country and territory geoBoundaries publishes boundaries for. This is geography, not measurement: a name and a line on a map.",
        bn: "জিওবাউন্ডারিজ যেসব দেশ ও অঞ্চলের সীমানা প্রকাশ করে। এটি ভূগোল, পরিমাপ নয়: একটি নাম ও মানচিত্রে একটি রেখা।",
      },
      tone: "listed",
    },
    {
      id: "measured",
      label: { en: "Measured", bn: "পরিমাপকৃত" },
      value: measuredCountries.length,
      unit: { en: "countries", bn: "দেশ" },
      body: {
        en: `Countries whose boundaries overlap the NASA analysis grids (${extent ? `${extent.lon[0]}–${extent.lon[1]}°E, ${extent.lat[0]}–${extent.lat[1]}°N` : "the South Asia grids"}). Here we have a satellite record to compare against.`,
        bn: `যেসব দেশের সীমানা নাসার বিশ্লেষণ-গ্রিডের (${extent ? `${extent.lon[0]}–${extent.lon[1]}°পূ, ${extent.lat[0]}–${extent.lat[1]}°উ` : "দক্ষিণ এশিয়ার গ্রিড"}) সাথে মেলে। এখানে তুলনা করার মতো স্যাটেলাইট রেকর্ড আছে।`,
      },
      tone: "measured",
    },
    {
      id: "decision",
      label: { en: "Decision-ready", bn: "সিদ্ধান্তযোগ্য" },
      value: places.areas.length,
      unit: { en: "areas", bn: "এলাকা" },
      body: {
        en: "Administrative areas with a place record: today's rain against its own history, and a Trust label saying whether that history can be checked at all.",
        bn: "যেসব প্রশাসনিক এলাকার রেকর্ড আছে: নিজের ইতিহাসের সাথে আজকের বৃষ্টি, এবং একটি ভরসা-লেবেল যা বলে ইতিহাস আদৌ যাচাই করা যায় কি না।",
      },
      tone: "decision",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      {meta.sampleData && (
        <div className="mb-4 rounded-xl border border-watch bg-watch-soft px-4 py-2 text-sm font-medium text-watch" role="status">
          <T en="SAMPLE DATA" bn="নমুনা তথ্য" /> —{" "}
          <T en="the counts below are real; the readings behind them are fixed samples." bn="নিচের সংখ্যাগুলো বাস্তব; এর পেছনের পাঠ স্থির নমুনা।" />
        </div>
      )}

      <header className="max-w-3xl">
        <Eyebrow en="The monitoring gap" bn="পর্যবেক্ষণের ফাঁক" />
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          <T
            en="Satellites cover the planet. Decisions happen in districts."
            bn="স্যাটেলাইট পুরো গ্রহ ঢাকে। সিদ্ধান্ত হয় জেলায়।"
          />
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-2">
          <T
            en="Most maps show where water goes. This one starts a step earlier: where can Earth observation actually support a decision — and where is nobody watching? Every number below is computed from the files this site ships, not quoted."
            bn="বেশিরভাগ মানচিত্র দেখায় পানি কোথায় যায়। এই মানচিত্রটি তার আগের ধাপ থেকে শুরু করে: ভূ-পর্যবেক্ষণ কোথায় সত্যিই একটি সিদ্ধান্তে সহায়তা করতে পারে — আর কোথায় কেউ দেখছে না? নিচের প্রতিটি সংখ্যা এই সাইটের ফাইল থেকেই গণনা করা, উদ্ধৃত নয়।"
          />
        </p>
      </header>

      {/* The three rungs: listed → measured → decision-ready. The fall from rung 1 to 3 is the story. */}
      <section aria-labelledby="ladder" className="mt-8">
        <h2 id="ladder" className="sr-only">
          <T en="From listed to decision-ready" bn="তালিকা থেকে সিদ্ধান্তযোগ্য" />
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {rungs.map((rung, index) => (
            <li key={rung.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  <T en={rung.label.en} bn={rung.label.bn} />
                </span>
                <span className="text-xs tabular-nums text-ink-3">{index + 1}/3</span>
              </div>
              <p className="mt-2 text-4xl font-semibold tabular-nums text-ink">
                {rung.value.toLocaleString("en-US")}
              </p>
              <p className="text-sm text-ink-3">
                <T en={rung.unit.en} bn={rung.unit.bn} />
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                <T en={rung.body.en} bn={rung.body.bn} />
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-xl border border-line bg-sunken p-4 text-sm text-ink-2">
          <T
            en={`That is ${pct(rungs[1].value, rungs[0].value)}% of listed countries measured, and ${pct(rungs[2].value, listedAdm1)}% of listed first-level areas reaching a decision-ready record. The fall from ${listedCountries.toLocaleString("en-US")} countries listed to ${rungs[2].value} areas we can actually stand behind is not a failure of the data — it is the finding.`}
            bn={`অর্থাৎ তালিকাভুক্ত দেশের ${pct(rungs[1].value, rungs[0].value)}% পরিমাপ করা হয়েছে, এবং তালিকাভুক্ত প্রথম স্তরের এলাকার ${pct(rungs[2].value, listedAdm1)}% সিদ্ধান্তযোগ্য রেকর্ডে পৌঁছেছে। তালিকাভুক্ত ${listedCountries.toLocaleString("en-US")}টি দেশ থেকে আমরা সত্যিই যার পেছনে দাঁড়াতে পারি এমন ${rungs[2].value}টি এলাকায় নামাটা তথ্যের ব্যর্থতা নয় — এটাই ফলাফল।`}
          />
        </p>
      </section>

      {/* The second dimension of the gap: even inside covered areas, most cannot be checked. */}
      <section aria-labelledby="blind" className="mt-10">
        <h2 id="blind" className="text-2xl font-semibold tracking-tight text-ink">
          <T en="Inside the covered area, most places still cannot be checked" bn="আচ্ছাদিত এলাকার ভেতরেও বেশিরভাগ জায়গা যাচাই করা যায় না" />
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          <T
            en={`Coverage is only the first barrier. The map lists ${listedAdm1.toLocaleString("en-US")} first-level and ${listedAdm2.toLocaleString("en-US")} second-level administrative areas; ${places.areas.length} of them reach a decision-ready record. And even where we have 45 years of history, a place can be unreadable if no trend in it stands out from year-to-year noise. Trust says which is which.`}
            bn={`আচ্ছাদন শুধু প্রথম বাধা। মানচিত্রে ${listedAdm1.toLocaleString("en-US")}টি প্রথম স্তর ও ${listedAdm2.toLocaleString("en-US")}টি দ্বিতীয় স্তরের প্রশাসনিক এলাকা আছে; এর মধ্যে ${places.areas.length}টি সিদ্ধান্তযোগ্য রেকর্ডে পৌঁছেছে। আর যেখানে ৪৫ বছরের ইতিহাস আছে, সেখানেও কোনো প্রবণতা বছরে-বছরে ওঠানামা থেকে আলাদা না হলে জায়গাটি পাঠযোগ্য নয়। ভরসা বলে দেয় কোনটি কোনটি।`}
          />
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-card p-4">
            <dt className="text-sm font-semibold text-accent-strong">
              <T en="Detectable" bn="শনাক্তযোগ্য" />
            </dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums text-ink">{trust.detectable}</dd>
            <dd className="mt-1 text-sm text-ink-2">
              <T
                en="A trend here is separated from noise, so a raised signal can be checked against history."
                bn="এখানে প্রবণতা কোলাহল থেকে আলাদা, তাই বাড়তি সংকেত ইতিহাসের সাথে যাচাই করা যায়।"
              />
            </dd>
          </div>
          <div className="rounded-2xl border border-line bg-card p-4">
            <dt className="text-sm font-semibold text-watch">
              <T en="Blind spot" bn="অন্ধ স্থান" />
            </dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums text-ink">{trust["blind-spot"]}</dd>
            <dd className="mt-1 text-sm text-ink-2">
              <T
                en="We have the rain, but no trend here can yet be told apart from noise — so a signal cannot be checked."
                bn="বৃষ্টি আমাদের আছে, কিন্তু এখানকার কোনো প্রবণতা এখনো কোলাহল থেকে আলাদা করা যায় না — তাই সংকেত যাচাই করা যায় না।"
              />
            </dd>
          </div>
        </dl>
        {/* "No history" is only shown when some area is actually in that state. Every area in a
            decision-ready record has a 45-year history, so the card would be dead content today. */}
        {trust["no-data"] > 0 && (
          <p className="mt-3 rounded-xl border border-line bg-sunken p-3 text-sm text-ink-2">
            <span className="font-semibold text-ink-3">
              <T en="No history" bn="ইতিহাস নেই" />: {trust["no-data"]}
            </span>{" "}
            <T
              en="areas have no gridded history at all and show No data rather than a colour."
              bn="এলাকায় কোনো গ্রিডযুক্ত ইতিহাস নেই, তাই রঙের বদলে ‘তথ্য নেই’ দেখানো হয়।"
            />
          </p>
        )}
        <p className="mt-3 text-sm text-ink-2">
          <T
            en={`Of ${places.areas.length} decision-ready areas, ${withReading} carry a live reading today and ${trust["blind-spot"]} (${pct(trust["blind-spot"], places.areas.length)}%) are blind spots: we can show the rain, but we cannot yet say it is a change.`}
            bn={`${places.areas.length}টি সিদ্ধান্তযোগ্য এলাকার মধ্যে ${withReading}টিতে আজ সরাসরি পাঠ আছে এবং ${trust["blind-spot"]}টি (${pct(trust["blind-spot"], places.areas.length)}%) অন্ধ স্থান: বৃষ্টি দেখাতে পারি, কিন্তু এটি পরিবর্তন বলে এখনো বলতে পারি না।`}
          />
        </p>
      </section>

      {/* Which datasets exist, how far each one reaches, and which are missing entirely. */}
      <section aria-labelledby="datasets" className="mt-10">
        <h2 id="datasets" className="text-2xl font-semibold tracking-tight text-ink">
          <T en="Datasets: how far each one reaches" bn="তথ্যসেট: প্রতিটি কতদূর পৌঁছায়" />
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          <T
            en="Six NASA analysis grids are committed. For each, the table counts the listed areas it actually reaches and the areas it was checked against — the sample size behind every share."
            bn="ছয়টি নাসা বিশ্লেষণ-গ্রিড সংরক্ষিত আছে। প্রতিটির জন্য ছকটি দেখায় তালিকাভুক্ত কতটি এলাকায় তা পৌঁছায় এবং কতটি এলাকার বিপরীতে যাচাই করা হয়েছে — প্রতিটি অনুপাতের পেছনের নমুনার আকার।"
          />
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">
              <T en="Per-dataset coverage with area counts and observation end year" bn="এলাকা-সংখ্যা ও পর্যবেক্ষণশেষ বছর সহ প্রতিটি তথ্যসেটের আচ্ছাদন" />
            </caption>
            <thead>
              <tr className="text-xs text-ink-3">
                <th scope="col" className="py-1.5 pr-3 font-medium"><T en="Dataset" bn="তথ্যসেট" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Resolution" bn="রেজোলিউশন" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Covered areas" bn="আচ্ছাদিত এলাকা" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Cells" bn="কোষ" /></th>
                <th scope="col" className="py-1.5 text-right font-medium"><T en="Observed through" bn="পর্যবেক্ষণশেষ" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {datasets.map((entry) => (
                <tr key={entry.key}>
                  <th scope="row" className="py-2 pr-3 font-normal text-ink">
                    <T en={entry.name} bn={entry.nameBn} />
                    <span className="block text-xs text-ink-3">{entry.dataset}</span>
                  </th>
                  <td className="py-2 text-right tabular-nums text-ink-2">{entry.gridDegrees}°</td>
                  <td className="py-2 text-right tabular-nums text-ink">
                    {entry.covered.toLocaleString("en-US")}
                    <span className="text-xs text-ink-3"> / {entry.examined.toLocaleString("en-US")}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-2">{entry.coveredCells.toLocaleString("en-US")}</td>
                  <td className="py-2 text-right tabular-nums text-ink-2">
                    {entry.observedThrough ?? "–"}
                    {entry.unusableRows > 0 && (
                      <span className="block text-xs text-ink-3">
                        <T en={`${entry.unusableRows} unusable rows`} bn={`${entry.unusableRows}টি অব্যবহারযোগ্য সারি`} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          <T
            en="'Covered areas' is out of every listed area checked for that variable; a share without that denominator would overstate coverage."
            bn="‘আচ্ছাদিত এলাকা’ হলো সেই ভেরিয়েবলের জন্য যাচাই করা প্রতিটি তালিকাভুক্ত এলাকার মধ্যে; সেই হর ছাড়া অনুপাত আচ্ছাদনকে অতিরঞ্জিত করবে।"
          />
        </p>

        <h3 className="mt-6 text-lg font-semibold text-ink">
          <T en="Datasets that are missing" bn="যেসব তথ্যসেট অনুপস্থিত" />
        </h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {MISSING_DATASETS.map((item) => (
            <li key={item.en} className="rounded-xl border border-watch bg-watch-soft p-3 text-sm">
              <p className="font-semibold text-ink">
                <T en={item.en} bn={item.bn} />
              </p>
              <p className="mt-1 leading-relaxed text-ink-2">
                <T en={item.why.en} bn={item.why.bn} />
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* What this reframes: the site's honest position. */}
      <section aria-labelledby="why" className="mt-10 rounded-2xl border border-line bg-sunken p-5">
        <h2 id="why" className="text-lg font-semibold text-ink">
          <T en="Why we map the gap instead of the flood" bn="বন্যার বদলে ফাঁক কেন আঁকি" />
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          <T
            en="A flood map that looks confident where it has no data is worse than no map: it spends trust it has not earned. So this project reports the two things it can stand behind — where observation exists, and whether a place can be checked — and leaves the decision to people who know the ground."
            bn="যে বন্যা-মানচিত্র তথ্য নেই অথচ আত্মবিশ্বাসী দেখায়, সেটি মানচিত্র না থাকার চেয়েও খারাপ: এটি অর্জন না করা ভরসা খরচ করে। তাই এই প্রকল্প দুটি বিষয় জানায় যার পেছনে দাঁড়ানো যায় — কোথায় পর্যবেক্ষণ আছে, আর একটি জায়গা যাচাই করা যায় কি না — এবং সিদ্ধান্ত তাদের হাতে রাখে যারা মাটি চেনে।"
          />
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/signal"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-accent-strong px-5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
          >
            <T en="See the covered areas" bn="আচ্ছাদিত এলাকা দেখুন" />
          </Link>
          <Link
            href="/accuracy"
            className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-5 text-sm text-ink-2 hover:text-ink"
          >
            <T en="How far the signal can be checked" bn="সংকেত কতটা যাচাই করা যায়" />
          </Link>
        </div>
      </section>

      <footer className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3">
        <span>
          <T en="Geography" bn="ভূগোল" />: geoBoundaries {geography.release} · <T en="Coverage" bn="আচ্ছাদন" />: {coverage.method}
        </span>
        <a
          href={config.official.wmo}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-line underline-offset-2 hover:text-ink"
        >
          <T en="Official warnings (WMO SWIC)" bn="সরকারি সতর্কবার্তা (WMO SWIC)" />
        </a>
        <span>
          <T en={config.official.line} bn="এটি পূর্বাভাস বা সরকারি সতর্কবার্তা নয়।" />
        </span>
      </footer>
    </main>
  );
}
