import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { T } from "@/lib/i18n";
import { ageOf } from "@/lib/signals/age";
import { readPlaces, readSignalsConfig, readSignalsMeta } from "@/lib/signals/data";
import type { PlaceArea, SignalsConfig } from "@/lib/signals/types";
import {
  countSignalRows,
  coverageSummary,
  loadSignalDirectory,
  readGeographyLicense,
  readSignalsSources,
} from "@/lib/geography/data";
import { CountrySignalList } from "@/components/signals/CountrySignalList";
import { DemoNotice, SignalLegend } from "@/components/signals/Legend";
import { Provenance } from "@/components/signals/Provenance";
import { SampleBanner } from "@/components/signals/parts";
import { GREEN_SENTENCE as GREEN } from "@/components/signals/PlaceView";
import { SignalsIndex, type IndexArea } from "@/components/signals/SignalsIndex";
import type { MapArea, MapTile } from "@/components/signals/SignalsMap";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Signals · Earth's Hidden Signals",
  description:
    "Today's rain signal for each covered area, with the 45-year history behind it, whether the place can be warned at all (Trust), and what to do. Green means no unusual signal in our data, never an all-clear. Not a forecast or an official warning.",
};

/** Red before Yellow before Green: the strongest place now comes first. */
const STATUS_RANK: Record<"red" | "yellow" | "green" | "grey", number> = { red: 0, yellow: 1, green: 2, grey: 3 };

async function readMapAreas(): Promise<{ areas: Record<string, MapArea>; tiles: MapTile[] }> {
  const dir = path.join(process.cwd(), "public", "data", "signals", "places-map");
  let index: { countries: string[]; tiles: string[] } = { countries: [], tiles: [] };
  try {
    index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8")) as { countries: string[]; tiles: string[] };
  } catch {
    // Without the index the map has no outlines; the list is still complete.
    return { areas: {}, tiles: [] };
  }
  const areas: Record<string, MapArea> = {};
  let tiles: MapTile[] = [];
  for (const iso of index.countries) {
    try {
      const payload = JSON.parse(await readFile(path.join(dir, `${iso}.json`), "utf8")) as {
        areas: MapArea[];
        tiles: MapTile[];
      };
      for (const area of payload.areas) areas[area.id] = area;
      tiles = payload.tiles ?? tiles;
    } catch {
      // A country without a written outline simply draws no boundary; the list still has it.
    }
  }
  const ids = new Set(index.tiles);
  tiles = tiles.filter((tile) => ids.has(tile.id));
  return { areas, tiles };
}

/** The one Green sentence, imported so the page and the place page cannot drift apart. */

/** The Now strip's headline in the list language: the pipeline copies are English-only. */
function nowLine(area: PlaceArea): { en: string; bn: string } {
  const cell = area.now.cells[0];
  if (!cell) return { en: `${area.name}: no rain reading here.`, bn: `${area.name}: এখানে কোনো বৃষ্টির পাঠ নেই।` };
  const pct = cell.percentile === null ? null : Math.round(cell.percentile);
  const extra = `${cell.confidence} confidence${pct === null ? "" : ` · day high for this date (${pct}th percentile of its history)`}`;
  if (cell.status === "green") return GREEN;
  if (cell.status === "grey")
    return {
      en: `${area.name}: Grey. Our data cannot judge it today; a gap, never an all-clear.`,
      bn: `${area.name}: ধূসর। আজ বিচার করার মতো তথ্য নেই; এটি ফাঁক, নিরাপত্তার নিশ্চয়তা নয়।`,
    };
  const word = cell.status === "red" ? { en: "Red", bn: "লাল" } : { en: "Yellow", bn: "হলুদ" };
  return {
    en: `${area.name}: ${word.en}. ${cell.reasonText}. ${extra}.`,
    bn: `${area.name}: ${word.bn}। ${cell.windowDays === 1 ? "১" : cell.windowDays === 3 ? "৩" : "৭"} দিনের বৃষ্টি এই তারিখের স্বাভাবিকের ${cell.ratio === null ? "অজানা" : cell.ratio.toFixed(1)} গুণ${pct === null ? "" : `; ইতিহাসের ${pct}তম শতক`}।`,
  };
}

function MiniStrips({
  top,
  sample,
  config,
}: {
  top: PlaceArea | null;
  sample: boolean;
  config: SignalsConfig;
}) {
  const cards = [
    {
      id: "before",
      label: { en: "Before", bn: "আগে" },
      range: { en: "45 years", bn: "৪৫ বছর" },
      body: top ? (
        <T
          en={`${top.name}: ${top.before.spanYears} years of history. A readable trend here is ${
            top.before.variables.find((v) => v.ciConsistent)?.label.toLowerCase() ?? "not separated from noise"
          }.`}
          bn={`${top.name}: ${top.before.spanYears} বছরের ইতিহাস। এখানে পাঠযোগ্য প্রবণতা ${
            top.before.variables.find((v) => v.ciConsistent)?.label ?? "কোলাহল থেকে আলাদা নয়"
          }।`}
        />
      ) : (
        <T en="No history here yet." bn="এখানে এখনো ইতিহাস নেই।" />
      ),
    },
    {
      id: "now",
      label: { en: "Now", bn: "এখন" },
      range: { en: "today", bn: "আজ" },
      body: top ? (() => {
        const line = nowLine(top);
        return <T en={line.en} bn={line.bn} />;
      })() : (
        <T en="No rain reading covers the covered areas." bn="আচ্ছাদিত এলাকাগুলোর কোনো বৃষ্টির পাঠ নেই।" />
      ),
      badge: sample ? { en: "SAMPLE DATA", bn: "নমুনা তথ্য" } : null,
    },
    {
      id: "next",
      label: { en: "Next", bn: "আসছে" },
      range: { en: `${config.outlook.days} days · external`, bn: `${config.outlook.days} দিন · বহিরাগত` },
      body: (
        <T
          en="Rain outlook from an external public source, shown on each place page. It is not our signal and never changes a status."
          bn="বহিরাগত বহুলপ্রাপ্ত উৎস থেকে বৃষ্টির পরিপ্রেক্ষিত, প্রতিটি জায়গার পাতায় দেখানো। এটি আমাদের সংকেত নয় এবং কখনো অবস্থা বদলায় না।"
        />
      ),
    },
    {
      id: "trust",
      label: { en: "Trust", bn: "ভরসা" },
      range: { en: "what we can measure", bn: "আমরা যা মাপতে পারি" },
      body: top ? <T en={top.trust.text} bn={top.trust.text} /> : <T en="Not measured here." bn="এখানে মাপা হয়নি।" />,
    },
    {
      id: "action",
      label: { en: "Action", bn: "করণীয়" },
      range: { en: "your next step", bn: "আপনার পরের পদক্ষেপ" },
      body: top ? <T en={top.action.en} bn={top.action.bn} /> : <T en="Follow official warnings." bn="সরকারি সতর্কবার্তা অনুসরণ করুন।" />,
    },
  ];
  return (
    <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Before, Now, Next, Trust, Action">
      {cards.map((card, index) => (
        <li key={card.id} className="rounded-2xl border border-line bg-card p-3">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">{index + 1}</span>
            <span className="text-sm font-semibold text-ink">
              <T en={card.label.en} bn={card.label.bn} />
            </span>
            <span className="text-xs text-ink-3">
              <T en={card.range.en} bn={card.range.bn} />
            </span>
          </p>
          {"badge" in card && card.badge && (
            <span className="mt-1 inline-block rounded-full bg-watch-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-watch">
              <T en={card.badge.en} bn={card.badge.bn} />
            </span>
          )}
          <p className="mt-1 text-xs leading-relaxed text-ink-2">{card.body}</p>
        </li>
      ))}
    </ol>
  );
}

export default async function SignalsPage() {
  const [directory, license, sources, places, meta, config, map] = await Promise.all([
    loadSignalDirectory(),
    readGeographyLicense(),
    readSignalsSources(),
    readPlaces(),
    readSignalsMeta(),
    readSignalsConfig(),
    readMapAreas(),
  ]);
  const { countries, demo, coverage, geography } = directory;
  const { counts, levels } = countSignalRows(directory);
  const measured = coverageSummary(countries);
  const age = ageOf(meta.measurementTime, new Date(meta.generatedAt), config.staleHours, meta.sampleData);
  const fmt = (value: number) => value.toLocaleString("en");
  const layerCount = Object.keys(coverage.variables).length;

  // The index rows are the place records (real grid cells only), not the demo scores above.
  const index: IndexArea[] = places.areas.map((area) => ({
    nowState: area.now.state,
    trustLabel: area.trust.label,
    id: area.id,
    name: area.name,
    country: area.country,
    countryName: area.countryName,
    level: area.level,
    centre: area.centre,
    tile: area.tile,
    tileLabel: area.tileLabel,
    status: area.now.cells[0]?.status === "grey" ? "no-data" : (area.now.cells[0]?.status ?? "no-data"),
    trust: area.trust.state,
    reason: area.now.cells[0]?.reasonText ?? "",
    confidence: area.now.cells[0]?.confidence ?? null,
  }));
  const top =
    // The strips lead with the strongest place that can be checked: highest status first, then
    // detectable rather than blind spot, then the larger area so the reading is about a district.
    [...places.areas]
      .filter((area) => area.now.cells[0] && area.now.cells[0].status !== "grey")
      .sort(
        (a, b) =>
          STATUS_RANK[a.now.cells[0].status] - STATUS_RANK[b.now.cells[0].status] ||
          (a.trust.state === "detectable" ? 0 : 1) - (b.trust.state === "detectable" ? 0 : 1) ||
          (a.level === "ADM1" ? 0 : 1) - (b.level === "ADM1" ? 0 : 1) ||
          b.areaKm2 - a.areaKm2,
      )[0] ?? null;

  // Totals come from the boundary files' own counts, never a hardcoded number.
  const countryCount = geography.counts?.countries ?? countries.length;
  const adm1Count = levels.ADM1 ?? 0;
  const adm2Count = levels.ADM2 ?? 0;
  const adm1Countries = geography.counts?.ADM1 ?? countries.filter((country) => country.levels.ADM1).length;
  const adm2Countries = geography.counts?.ADM2 ?? countries.filter((country) => country.levels.ADM2).length;
  const noAdm1 = countries.filter((country) => !country.levels.ADM1).length;
  const noAdm2 = countries.filter((country) => !country.levels.ADM2).length;
  const skipped = geography.skipped ?? [];
  const measuredIn = coverage.measuredCountries ?? [];
  const grid = coverage.gridExtent;
  const coverageRule = Object.values(coverage.variables)[0]?.rule ?? "";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      {meta.sampleData && <SampleBanner clock={meta.clock} />}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="Signals" bn="সংকেত" />
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-2">
          <T
            en="One preparedness view for the areas our ground data covers: what the place was like before, what the rain is doing now, what is coming next, whether the place can be warned at all (Trust), and what to do. Green means no unusual signal in our data — never an all-clear."
            bn="আমাদের ভূ-তথ্যে আচ্ছাদিত এলাকার জন্য এক প্রস্তুতি-দৃশ্য: আগে জায়গাটি কেমন ছিল, এখন বৃষ্টি কী করছে, এরপর কী আসছে, জায়গাটিকে আদৌ সতর্ক করা যায় কি না (ভরসা), এবং কী করবেন। সবুজ মানে আমাদের তথ্যে অস্বাভাবিক সংকেত নেই — কখনো ‘নিশ্চিন্ত থাকুন’ নয়।"
          />
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <T
            en="Not a forecast and not an official warning."
            bn="পূর্বাভাস নয়, সরকারি সতর্কবার্তাও নয়।"
          />
          <Link href="/accuracy" className="underline decoration-line underline-offset-2 hover:text-ink">
            <T en="Where the signal can be checked" bn="কোথায় সংকেত যাচাই করা যায়" />
          </Link>
        </p>
      </header>

      {top && <MiniStrips top={top} sample={meta.sampleData} config={config} />}

      <SignalsIndex areas={index} mapAreas={map.areas} tiles={map.tiles} />

      <section aria-labelledby="demo" className="mt-10 border-t border-line pt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="demo" className="text-lg font-semibold text-ink">
            <T en="Sample scores for every country (demo)" bn="প্রতিটি দেশের নমুনা স্কোর (ডেমো)" />
          </h2>
          <p className="text-xs text-ink-3">
            <T en="Fixed sample numbers, not predictions or measurements." bn="নির্দিষ্ট নমুনা সংখ্যা, পূর্বাভাস বা পরিমাপ নয়।" />
          </p>
        </div>

        <div className="mt-3 space-y-3">
          <p className="text-xs text-ink-3">
            <T
              en="Provisional demo band for judging only. Rows with a link open a real place page built from IMERG and NASA trends; the score itself is not a measurement."
              bn="শুধু বিচারের জন্য প্রাথমিক ডেমো ব্যান্ড। লিঙ্কযুক্ত সারি একটি বাস্তব জায়গার পাতায় যায়, যা IMERG ও নাসা প্রবণতা থেকে তৈরি; স্কোরটি নিজে কোনো পরিমাপ নয়।"
            />
          </p>
          <DemoNotice
            event={demo.event}
            eventPeriod={demo.eventPeriod}
            coverageText={{
              en: `“Data: 3 of ${layerCount} layers” is how many of the ${layerCount} NASA series have measured values for that area; the percentage beside it is the share of those layers' grid cells inside the boundary that carry data. Coverage is measured and separate from the demo score.`,
              bn: `“তথ্য: ${layerCount} স্তরের ৩টি” মানে ওই এলাকার জন্য ${layerCount}টি নাসা সিরিজের কতটিতে মাপা মান আছে; পাশের শতাংশটি সীমানার ভেতরে ওই স্তরগুলোর গ্রিড কোষের কত অংশে তথ্য আছে। আচ্ছাদন মাপা হয় এবং ডেমো স্কোর থেকে আলাদা।`,
            }}
          />
          <SignalLegend bands={demo.signalBands} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["green", counts.green, "Green", "সবুজ"],
              ["yellow", counts.yellow, "Yellow", "হলুদ"],
              ["red", counts.red, "Red", "লাল"],
              ["no-data", counts["no-data"], "No data", "তথ্য নেই"],
            ] as const
          ).map(([state, value, en, bn]) => (
            <div key={state} className="rounded-xl border border-line bg-card px-3 py-2">
              <dt className="text-xs text-ink-3">
                <T en={`${en} (demo)`} bn={`${bn} (ডেমো)`} />
              </dt>
              <dd className="text-xl font-semibold tabular-nums text-ink">{value.toLocaleString("en")}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-2 text-xs text-ink-3">
          <T
            en={`Measured NASA coverage: ${fmt(measured.country.withData)} of ${fmt(measured.country.total)} countries and ${fmt(measured.ADM1.withData)} of ${fmt(measured.ADM1.total)} ADM1 areas have usable data; ${fmt(measured.ADM2.withData)} of ${fmt(measured.ADM2.total)} ADM2 areas do, because ADM2 polygons are usually smaller than the grids. Our NASA analysis grids cover South Asia only (${grid ? `${grid.lon[0]}–${grid.lon[1]}°E, ${grid.lat[0]}–${grid.lat[1]}°N` : "South Asia"}), so the ${fmt(measured.country.total - measuredIn.length)} countries outside that extent show No data. ${coverageRule}`}
            bn={`মাপা নাসা আচ্ছাদন: ${measured.country.total} দেশের ${measured.country.withData}টি এবং ${measured.ADM1.total} ADM1 এলাকার ${measured.ADM1.withData}টিতে ব্যবহারযোগ্য তথ্য আছে; ${measured.ADM2.total} ADM2 এলাকার ${measured.ADM2.withData}টিতে আছে, কারণ ADM2 বহুভুজ সাধারণত গ্রিডের চেয়ে ছোট। আমাদের নাসা বিশ্লেষণ গ্রিড কেবল দক্ষিণ এশিয়া জুড়ে (${grid ? `${grid.lon[0]}–${grid.lon[1]}°পূ, ${grid.lat[0]}–${grid.lat[1]}°উ` : "দক্ষিণ এশিয়া"}), তাই ওই সীমার বাইরের ${measured.country.total - measuredIn.length}টি দেশ তথ্য নেই দেখায়। ${coverageRule}`}
          />
        </p>

        <CountrySignalList countries={countries} totalLayers={layerCount} places={index} />

        <p className="mt-6 rounded-2xl border border-line bg-card p-4 text-sm text-ink-2">
          <T
            en={`Boundaries loaded from geoBoundaries gbOpen: ${fmt(countryCount)} countries and territories at ADM0. ADM1 is published for ${fmt(adm1Countries)} of them (${fmt(adm1Count)} areas); ADM2 for ${fmt(adm2Countries)} (${fmt(adm2Count)} areas). ${noAdm1} have no ADM1 and ${noAdm2} no ADM2, mostly small islands and territories, and the list shows only the levels each country has.${skipped.length ? ` ${skipped.map((item) => item.iso).join(", ")} has ${skipped.map((item) => item.levels.join("/")).join(", ")} but no ADM0, so it is not listed as a country.` : ""}`}
            bn={`geoBoundaries gbOpen থেকে লোড করা সীমানা: ADM0 স্তরে ${countryCount} দেশ ও অঞ্চল। এদের মধ্যে ${adm1Countries}টির জন্য ADM1 (${adm1Count} এলাকা) এবং ${adm2Countries}টির জন্য ADM2 (${adm2Count} এলাকা) প্রকাশিত। ${noAdm1}টির ADM1 নেই এবং ${noAdm2}টির ADM2 নেই, বেশিরভাগই ছোট দ্বীপ ও অঞ্চল; তালিকায় প্রতিটি দেশের সত্যিকার উপলভ্য স্তরই দেখানো হয়।${skipped.length ? ` ${skipped.map((item) => item.iso).join(", ")}-এ ${skipped.map((item) => item.levels.join("/")).join(", ")} আছে কিন্তু ADM0 নেই, তাই দেশ হিসেবে তালিকাভুক্ত নয়।` : ""}`}
          />
        </p>

        <Provenance license={license} sources={sources} layerCount={layerCount} />
      </section>

      <section aria-labelledby="next" className="mt-6 grid gap-3 sm:grid-cols-2">
        <h2 id="next" className="sr-only">
          <T en="Related pages" bn="সম্পর্কিত পাতা" />
        </h2>
        <Link
          href="/watch"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
        >
          <span>
            <span className="block text-sm font-medium text-ink">
              <T en="Watch" bn="কী দেখবেন" />
            </span>
            <span className="mt-0.5 block text-sm text-ink-2">
              <T en="Places where the signal rose since the previous snapshot." bn="আগের স্ন্যাপশট থেকে সংকেত বেড়েছে এমন জায়গা।" />
            </span>
          </span>
          <ArrowRight size={18} aria-hidden className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/accuracy"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
        >
          <span>
            <span className="block text-sm font-medium text-ink">
              <T en="Trust and evidence" bn="ভরসা ও প্রমাণ" />
            </span>
            <span className="mt-0.5 block text-sm text-ink-2">
              <T en="How often the signal rose before a verified flood, misses included." bn="যাচাইকৃত বন্যার আগে সংকেত কতবার বেড়েছে, বাদ পড়া ঘটনাগুলোসহ।" />
            </span>
          </span>
          <ArrowRight size={18} aria-hidden className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/methods#signals"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
        >
          <span>
            <span className="block text-sm font-medium text-ink">
              <T en="How the signals are built" bn="সংকেত কীভাবে তৈরি" />
            </span>
            <span className="mt-0.5 block text-sm text-ink-2">
              <T
                en="Geographic levels, coverage rule, the Trust rule and credits."
                bn="ভৌগোলিক স্তর, আচ্ছাদনের নিয়ম, ভরসার নিয়ম ও স্বীকৃতি।"
              />
            </span>
          </span>
          <ArrowRight size={18} aria-hidden className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/explore"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
        >
          <span>
            <span className="block text-sm font-medium text-ink">
              <T en="Satellite map" bn="স্যাটেলাইট মানচিত্র" />
            </span>
            <span className="mt-0.5 block text-sm text-ink-2">
              <T en="The NASA imagery behind the measurements." bn="পরিমাপের পেছনের নাসা চিত্র।" />
            </span>
          </span>
          <ArrowRight size={18} aria-hidden className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </section>

      <p className="mt-4 text-xs text-ink-3">{age.label}</p>
    </main>
  );
}
