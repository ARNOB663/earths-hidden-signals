import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TrendExplorer from "@/components/trends/TrendExplorer";
import { Eyebrow } from "@/components/ui/primitive";
import { bnNum } from "@/lib/bn";
import { readCrosscheck, readManifest, readTrendZones } from "@/lib/data";
import { T } from "@/lib/i18n";
import { ZONE_BN } from "@/lib/names";
import { ALPHA, formatP, formatSigned, type TrendSummary, type Zone } from "@/lib/trends";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Climate trends · Earth's Hidden Signals",
  description:
    "What is changing across South Asia since 1981, where, by how much, and whether each change is statistically significant. NASA GISTEMP temperature and GPCP rainfall, Mann–Kendall test and Sen's slope.",
};

/** Region-table columns: result key, its label, unit and decimals for the rate. */
const COLUMNS = [
  { key: "temperature_annual", en: "Temperature, year", bn: "তাপমাত্রা, সারা বছর", unit: "°C", d: 2 },
  { key: "rainfall_monsoon", en: "Monsoon rain", bn: "বর্ষার বৃষ্টি", unit: "mm", d: 0 },
  { key: "rainfall_pre-monsoon", en: "Hot-season rain", bn: "গরমের মৌসুমের বৃষ্টি", unit: "mm", d: 0 },
  { key: "heavy-rain_annual", en: "Very heavy rain days", bn: "অতি ভারী বৃষ্টির দিন", unit: "days", d: 1 },
  { key: "dry-spell_annual", en: "Monsoon dry spell", bn: "বর্ষায় শুকনো সময়", unit: "days", d: 1 },
] as const;

const zoneName = (z: Zone) => ({ en: z.name, bn: ZONE_BN[z.id]?.name ?? z.name });

export default async function ClimateTrendsPage() {
  const [manifest, zones, crosscheck] = await Promise.all([readManifest(), readTrendZones(), readCrosscheck()]);
  const first = manifest.years[0];
  const last = manifest.years[manifest.years.length - 1];

  // Headline findings, read from the committed results so the words can never drift from the data.
  const warm = manifest.summaries["temperature_annual"];
  const study = zones.find((z) => z.id === "study-area")?.results["temperature_annual"]?.trend ?? null;
  const regions = zones.filter((z) => z.id !== "study-area");
  const monsoon = (z: Zone) => z.results["rainfall_monsoon"]?.trend ?? null;
  const wetter = regions.filter((z) => {
    const t = monsoon(z);
    return t && t.p < ALPHA && t.slopePerDecade > 0;
  });
  const drier = regions.filter((z) => {
    const t = monsoon(z);
    return t && t.p < ALPHA && t.slopePerDecade < 0;
  });
  const unclearRain = regions.filter((z) => !wetter.includes(z) && !drier.includes(z));
  const rainSummary = manifest.summaries["rainfall_monsoon"];
  const heavy = manifest.summaries["heavy-rain_annual"];
  const heavyYears = manifest.variables["heavy-rain"].years ?? manifest.years;
  const totalWarm = study ? (study.slopePerDecade / 10) * (last - first) : null;

  const list = (zs: Zone[], lang: "en" | "bn") => zs.map((z) => zoneName(z)[lang]).join(lang === "bn" ? ", " : ", ");

  return (
    <div className="mx-auto w-full max-w-384 px-6 pb-24 pt-12 sm:px-8 lg:px-12">
      <header className="max-w-4xl">
        <Eyebrow en="Trend detective" bn="প্রবণতা গোয়েন্দা" />
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          <T
            en={`What is changing across South Asia, ${first}–${last}`}
            bn={`দক্ষিণ এশিয়ায় কী বদলাচ্ছে, ${bnNum(first)}–${bnNum(last)}`}
          />
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          <T
            en="Forty-five years of NASA temperature and rainfall records, tested square by square. For every place we answer four questions: what is changing, where, by how much, and whether the change is real or could be natural ups and downs."
            bn="নাসার পঁয়তাল্লিশ বছরের তাপমাত্রা ও বৃষ্টির রেকর্ড, বর্গ ধরে ধরে পরীক্ষা করা। প্রতিটি জায়গার জন্য আমরা চারটি প্রশ্নের উত্তর দিই: কী বদলাচ্ছে, কোথায়, কতটা, আর পরিবর্তনটি সত্যি নাকি স্বাভাবিক ওঠানামা।"
          />
        </p>
      </header>

      {/* ── Three headline findings ── */}
      <section aria-labelledby="found-hdg" className="mt-10">
        <h2 id="found-hdg" className="sr-only">
          <T en="Key findings" bn="মূল ফলাফল" />
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Finding
            tag={{ en: "Same everywhere", bn: "সবখানে একই" }}
            title={{ en: "Warming is everywhere", bn: "উষ্ণতা সবখানে" }}
            big={study ? `${formatSigned(study.slopePerDecade, 2)} °C` : "–"}
            bigNote={{ en: "per 10 years, whole study area", bn: "প্রতি ১০ বছরে, পুরো এলাকা" }}
            body={{
              en: `${warm.significantIncrease} of ${warm.cells} land squares warmed significantly, none cooled. That is about ${totalWarm?.toFixed(1) ?? "–"} °C since ${first}${study ? ` (${formatP(study.p)})` : ""}.`,
              bn: `${bnNum(warm.cells)}টি স্থলবর্গের ${bnNum(warm.significantIncrease)}টি স্পষ্টভাবে উষ্ণ হয়েছে, কোনোটি শীতল হয়নি। ${bnNum(first)} থেকে প্রায় ${bnNum(totalWarm?.toFixed(1) ?? "–")} °সে।`,
            }}
          />
          <Finding
            tag={{ en: "Opposite directions", bn: "বিপরীত দিক" }}
            title={{ en: "Monsoon rain splits", bn: "বর্ষার বৃষ্টি দুই ভাগ" }}
            big={`${wetter.length} ↑ · ${drier.length} ↓`}
            bigNote={{ en: "regions clearly wetter · clearly drier", bn: "অঞ্চল স্পষ্ট ভেজা · স্পষ্ট শুষ্ক" }}
            body={{
              en: `The same warming pushes rain in opposite directions. Clearly wetter: ${list(wetter, "en") || "none"}. Clearly drier: ${list(drier, "en") || "none"}. Most squares (${rainSummary.cells - rainSummary.significantIncrease - rainSummary.significantDecrease} of ${rainSummary.cells}) show no clear change.`,
              bn: `একই উষ্ণতা বৃষ্টিকে বিপরীত দিকে ঠেলে দেয়। স্পষ্ট ভেজা: ${list(wetter, "bn") || "কোনোটি নয়"}। স্পষ্ট শুষ্ক: ${list(drier, "bn") || "কোনোটি নয়"}। বেশিরভাগ বর্গে (${bnNum(rainSummary.cells)}টির ${bnNum(rainSummary.cells - rainSummary.significantIncrease - rainSummary.significantDecrease)}টি) স্পষ্ট পরিবর্তন নেই।`,
            }}
          />
          <Finding
            tag={{ en: "Honest result", bn: "সৎ ফলাফল" }}
            title={{ en: "Extremes: mostly no clear trend yet", bn: "চরম ঘটনা: বেশিরভাগে এখনো স্পষ্ট প্রবণতা নেই" }}
            big={`${heavy.significantIncrease + heavy.significantDecrease} / ${heavy.cells}`}
            bigNote={{ en: "squares with a clear change in very heavy rain days", bn: "বর্গে অতি ভারী বৃষ্টির দিনে স্পষ্ট পরিবর্তন" }}
            body={{
              en: `Daily rain records start in ${heavyYears[0]}, so there are only ${heavyYears.length} years to test. ${heavy.significantIncrease} squares show more very heavy rain days, ${heavy.significantDecrease} fewer. We report this as "not yet detectable", not as "no change".`,
              bn: `দৈনিক বৃষ্টির রেকর্ড ${bnNum(heavyYears[0])} থেকে, তাই পরীক্ষার জন্য মাত্র ${bnNum(heavyYears.length)} বছর। ${bnNum(heavy.significantIncrease)}টি বর্গে অতি ভারী বৃষ্টির দিন বেড়েছে, ${bnNum(heavy.significantDecrease)}টিতে কমেছে। আমরা একে "এখনো শনাক্তযোগ্য নয়" বলি, "পরিবর্তন নেই" নয়।`,
            }}
          />
        </div>
      </section>

      {/* ── The explorer ── */}
      <section aria-labelledby="explore-hdg" className="mt-14">
        <Eyebrow en="Explore" bn="অনুসন্ধান" />
        <h2 id="explore-hdg" className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="Where, and by how much" bn="কোথায়, আর কতটা" />
        </h2>
        <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-ink-2">
          <T
            en="Colour shows how fast each square is changing. Pick a region from the list or click a square to see its year-by-year record, its trend line with the 95% range, and whether the trend passes the significance test."
            bn="রং দেখায় প্রতিটি বর্গ কত দ্রুত বদলাচ্ছে। তালিকা থেকে অঞ্চল বেছে নিন বা বর্গে ক্লিক করুন: বছর-বছর রেকর্ড, ৯৫% পরিসরসহ প্রবণতা-রেখা, আর প্রবণতাটি তাৎপর্য-পরীক্ষায় উত্তীর্ণ কি না দেখবেন।"
          />
        </p>
        <div className="mt-6">
          <TrendExplorer manifest={manifest} zones={zones} crosscheck={crosscheck} />
        </div>
      </section>

      {/* ── Every region, every measure, one table ── */}
      <section aria-labelledby="table-hdg" className="mt-14">
        <Eyebrow en="All regions" bn="সব অঞ্চল" />
        <h2 id="table-hdg" className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="Region by region" bn="অঞ্চল ধরে ধরে" />
        </h2>
        <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-ink-2">
          <T
            en="Change per 10 years. Bold with ● = statistically significant (p < 0.05). Grey = no clear trend: the number is the best estimate, but chance cannot be ruled out."
            bn="প্রতি ১০ বছরে পরিবর্তন। গাঢ় ও ● = পরিসংখ্যানগতভাবে তাৎপর্যপূর্ণ (p < ০.০৫)। ধূসর = স্পষ্ট প্রবণতা নেই: সংখ্যাটি সেরা অনুমান, কিন্তু কাকতালীয় হওয়া বাদ দেওয়া যায় না।"
          />
        </p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th scope="col" className="px-4 py-3 font-medium">
                  <T en="Region" bn="অঞ্চল" />
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className="px-4 py-3 text-right font-medium">
                    <T en={c.en} bn={c.bn} />
                    <span className="block font-normal">
                      <T en={`${c.unit} / 10 yr`} bn={`${c.unit === "°C" ? "°সে" : c.unit === "mm" ? "মিমি" : "দিন"} / ১০ বছর`} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-ink">
                    <T en={zoneName(z).en} bn={zoneName(z).bn} />
                    {z.hazard && (
                      <span className="block text-xs font-normal text-ink-3">
                        <T
                          en={{ flood: "Flood-prone", landslide: "Landslide-prone", wildfire: "Wildfire-prone" }[z.hazard]}
                          bn={{ flood: "বন্যাপ্রবণ", landslide: "ভূমিধসপ্রবণ", wildfire: "দাবানলপ্রবণ" }[z.hazard]}
                        />
                      </span>
                    )}
                  </th>
                  {COLUMNS.map((c) => (
                    <Cell key={c.key} trend={z.results[c.key]?.trend ?? null} decimals={c.d} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {unclearRain.length > 0 && (
          <p className="mt-3 text-xs text-ink-3">
            <T
              en={`No clear monsoon-rain trend: ${list(unclearRain, "en")}.`}
              bn={`বর্ষার বৃষ্টিতে স্পষ্ট প্রবণতা নেই: ${list(unclearRain, "bn")}।`}
            />
          </p>
        )}
      </section>

      {/* ── Limits, stated plainly ── */}
      <section aria-labelledby="limits-hdg" className="mt-14 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-6">
          <h2 id="limits-hdg" className="text-lg font-semibold text-ink">
            <T en="What these trends do not say" bn="এই প্রবণতাগুলো কী বলে না" />
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
            <li>
              <T
                en="A trend is not a forecast. It describes the past 45 years; it does not say what next year will bring."
                bn="প্রবণতা পূর্বাভাস নয়। এটি গত ৪৫ বছরের বর্ণনা; আগামী বছর কী হবে তা বলে না।"
              />
            </li>
            <li>
              <T
                en="Together is not because. Rain trends sitting next to flood or landslide regions do not prove that one causes the other."
                bn="একসাথে ঘটা মানেই কারণ নয়। বন্যা বা ভূমিধস অঞ্চলের পাশে বৃষ্টির প্রবণতা থাকলেই একটি অন্যটির কারণ প্রমাণ হয় না।"
              />
            </li>
            <li>
              <T
                en="Squares are large (1° to 2.5°, roughly 100–275 km). A single valley or city can differ from its square."
                bn="বর্গগুলো বড় (১° থেকে ২.৫°, প্রায় ১০০–২৭৫ কিমি)। একটি উপত্যকা বা শহর তার বর্গ থেকে আলাদা হতে পারে।"
              />
            </li>
            <li>
              <T
                en="Soil moisture and vegetation trends are not yet included; they need a longer NASA record (SMAP, MODIS) than we have processed."
                bn="মাটির আর্দ্রতা ও উদ্ভিদের প্রবণতা এখনো যোগ হয়নি; এর জন্য নাসার দীর্ঘতর রেকর্ড (SMAP, MODIS) প্রক্রিয়া করতে হবে।"
              />
            </li>
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg font-semibold text-ink">
            <T en="How a trend is tested" bn="প্রবণতা কীভাবে পরীক্ষা করা হয়" />
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
            <li>
              <T
                en="Mann–Kendall test, corrected for year-to-year memory (Hamed–Rao): is the series moving one way more often than chance allows?"
                bn="ম্যান–কেন্ডাল পরীক্ষা, বছর-বছর স্মৃতির জন্য সংশোধিত (হামেদ–রাও): সিরিজটি কি কাকতালীয়ের চেয়ে বেশি একদিকে যাচ্ছে?"
              />
            </li>
            <li>
              <T
                en="Sen's slope with a 95% range: how much per decade, robust to a few unusual years."
                bn="৯৫% পরিসরসহ সেন-এর ঢাল: প্রতি দশকে কতটা, কয়েকটি অস্বাভাবিক বছরে বিচলিত হয় না।"
              />
            </li>
            <li>
              <T
                en="False-discovery-rate control on the map, so testing hundreds of squares does not manufacture false alarms."
                bn="মানচিত্রে মিথ্যা-আবিষ্কার-হার নিয়ন্ত্রণ, যাতে শত শত বর্গ পরীক্ষা করলে ভুল সংকেত তৈরি না হয়।"
              />
            </li>
            <li>
              <T
                en="An independent check against CRU TS station data, region by region."
                bn="অঞ্চল ধরে ধরে CRU TS আবহাওয়া-কেন্দ্রের তথ্যের সাথে স্বাধীন যাচাই।"
              />
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/methods" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <T en="Full methods" bn="পুরো পদ্ধতি" />
              <ArrowRight size={14} aria-hidden />
            </Link>
            <Link href="/signal" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <T en="From trends to today's rain: Signal" bn="প্রবণতা থেকে আজকের বৃষ্টি: সংকেত" />
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Finding({
  tag,
  title,
  big,
  bigNote,
  body,
}: {
  tag: { en: string; bn: string };
  title: { en: string; bn: string };
  big: string;
  bigNote: { en: string; bn: string };
  body: { en: string; bn: string };
}) {
  return (
    <article className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <p className="text-xs font-medium text-ink-3">
        <T en={tag.en} bn={tag.bn} />
      </p>
      <h3 className="mt-1 font-semibold text-ink">
        <T en={title.en} bn={title.bn} />
      </h3>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-ink">{big}</p>
      <p className="text-xs text-ink-3">
        <T en={bigNote.en} bn={bigNote.bn} />
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        <T en={body.en} bn={body.bn} />
      </p>
    </article>
  );
}

function Cell({ trend, decimals }: { trend: TrendSummary | null; decimals: number }) {
  if (!trend) return <td className="px-4 py-3 text-right text-ink-3">–</td>;
  const clear = trend.p < ALPHA;
  return (
    <td
      className={`px-4 py-3 text-right tabular-nums ${clear ? "font-semibold text-ink" : "text-ink-3"}`}
      title={`${formatP(trend.p)} · 95% CI ${formatSigned(trend.lowerPerDecade, decimals + 1)} to ${formatSigned(trend.upperPerDecade, decimals + 1)}`}
    >
      {clear && (
        <span aria-hidden className="mr-1 text-accent">
          ●
        </span>
      )}
      {formatSigned(trend.slopePerDecade, decimals)}
      <span className="sr-only">{clear ? " (significant)" : " (no clear trend)"}</span>
    </td>
  );
}
