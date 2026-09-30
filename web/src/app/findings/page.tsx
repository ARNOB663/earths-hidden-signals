import { ArrowRight, CloudRain, Lightbulb, Question, Thermometer, UsersThree } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { MiniGridMap } from "@/components/findings/MiniGridMap";
import { EventDriverChart, PercentileBar, RegionBars, type RegionBar } from "@/components/findings/parts";
import { StoryNav } from "@/components/findings/StoryNav";
import { SeriesChart } from "@/components/trends/SeriesChart";
import { Dots, Numbers, Sureness } from "@/components/ui";
import { bnNum } from "@/lib/bn";
import { readCrosscheck, readHazardZones, readManifest, readTrendGrid, readTrendZones } from "@/lib/data";
import { preparednessSignal, type HazardZone } from "@/lib/hazards";
import { T } from "@/lib/i18n";
import { driverNameBn, zoneNameBn } from "@/lib/names";
import { agreement, colorLimit, formatP, formatSigned, type Zone } from "@/lib/trends";

export const metadata: Metadata = {
  title: "The story · Earth's Hidden Signals",
  description: "Five things 45 years of NASA data show about heat, rain and disasters in South Asia, explained simply.",
};

const EVENT_COLOR = {
  flood: "var(--ev-flood)",
  landslide: "var(--ev-landslide)",
  wildfire: "var(--ev-fire)",
  cyclone: "var(--ev-cyclone)",
} as const;

/** English and Bangla side by side; the reader's language picks one. */
const tx = (en: React.ReactNode, bn: React.ReactNode) => <T en={en} bn={bn} />;

export default async function StoryPage() {
  const [manifest, trendZones, hazardZones, tempGrid, rainGrid, crosscheck] = await Promise.all([
    readManifest(),
    readTrendZones(),
    readHazardZones(),
    readTrendGrid("temperature_annual"),
    readTrendGrid("rainfall_monsoon"),
    readCrosscheck(),
  ]);
  // Independent check (CRU TS): which regions does it confirm?
  const cruConfirms = (id: string, key: string) => {
    const pair = crosscheck.zones[id]?.[key];
    return !!pair?.ours && !!pair.cru && agreement(pair.ours, pair.cru) === "agree";
  };
  const years = manifest.years;
  const [first, last] = [years[0], years[years.length - 1]];
  const [firstBn, lastBn] = [bnNum(first), bnNum(last)];
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
  const sinceStart = formatSigned((tStudy.slopePerDecade * (last - first)) / 10, 1);
  const hot = study.results["hot-months_annual"].series as number[];
  const hotThen = hot.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
  const hotNow = hot.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const hazardRegions = trendZones.filter((z) => z.hazard);
  const cruWarm = hazardRegions.filter((z) => {
    const c = crosscheck.zones[z.id]?.["temperature_annual"]?.cru;
    return c && c.slopePerDecade > 0;
  }).length;

  // 2. Spring heats fastest
  const regionIds = trendZones.filter((z) => z.hazard).map((z) => z.id);
  const bar = (id: string, value: number, significant: boolean): RegionBar => ({
    name: zone(id).name,
    nameBn: zoneNameBn(id, zone(id).name),
    value,
    significant,
  });
  const preBars = regionIds.map((id) => {
    const t = trendOf(zone(id), "temperature_pre-monsoon");
    return bar(id, t.slopePerDecade, t.p < 0.05);
  });
  const fastest = [...preBars].sort((a, b) => b.value - a.value)[0];
  const slowest = [...preBars].sort((a, b) => a.value - b.value)[0];
  const tFastest = trendOf(zone(regionIds.find((id) => zone(id).name === fastest.name)!), "temperature_pre-monsoon");
  const fastestRate = formatSigned(fastest.value, 2);
  const times = Math.round(fastest.value / slowest.value);
  const seasonMedian = (s: string) => manifest.summaries[`temperature_${s}`].medianSlopePerDecade;

  // 3. Rain is moving
  const rainPct = (z: Zone) => {
    const r = z.results["rainfall_monsoon"];
    return (r.trend!.slopePerDecade / r.mean) * 100;
  };
  const rainBars = regionIds.map((id) => bar(id, rainPct(zone(id)), trendOf(zone(id), "rainfall_monsoon").p < 0.05));
  // Headline only regions where the independent rain record (CRU TS) tells the same story.
  const confirmed = rainBars.filter((b, i) => b.significant && cruConfirms(regionIds[i], "rainfall_monsoon"));
  const wettest = [...confirmed].sort((a, b) => b.value - a.value)[0];
  const driest = [...confirmed].sort((a, b) => a.value - b.value)[0];
  const [wetPct, dryPct] = [formatSigned(wettest.value, 0), formatSigned(driest.value, 0)];
  const confirmedNames = confirmed.map((b) => b.name).join(", ");
  const confirmedNamesBn = confirmed.map((b) => b.nameBn).join(", ");
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
  const nWatch = watchList.length;
  const plural = nWatch === 1 ? "" : "s";

  return (
    <article className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-12 sm:px-6">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-accent">
          {tx(`The story · ${first} to ${last}`, `গল্পটা · ${firstBn} থেকে ${lastBn}`)}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {tx("Five things NASA data tell us about South Asia", "নাসার তথ্য দক্ষিণ এশিয়া নিয়ে যে পাঁচটি কথা বলে")}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          {tx(
            "Each finding is explained in simple words first. The exact numbers are there too, for anyone who wants them.",
            "প্রতিটি ফলাফল আগে সহজ ভাষায় বোঝানো হয়েছে। যারা চান, তাদের জন্য সঠিক সংখ্যাগুলোও দেওয়া আছে।",
          )}
        </p>
      </header>

      <StoryNav
        items={[
          { id: "warming", en: "1. Getting warmer", bn: "১. গরম বাড়ছে" },
          { id: "spring", en: "2. Spring heats fastest", bn: "২. বসন্তে গরম বাড়ছে সবচেয়ে দ্রুত" },
          { id: "rain", en: "3. Rain is moving", bn: "৩. বৃষ্টির জায়গা বদলাচ্ছে" },
          { id: "disasters", en: "4. Disasters follow the weather", bn: "৪. দুর্যোগ আবহাওয়ার পথ ধরে" },
          { id: "watch", en: `5. Where to prepare in ${last}`, bn: `৫. ${lastBn}: কোথায় প্রস্তুতি দরকার` },
          { id: "glossary", en: "Words explained", bn: "শব্দের মানে" },
        ]}
      />

      <Finding
        id="warming"
        n={1}
        icon={<Thermometer size={22} weight="duotone" />}
        title={tx("South Asia is getting warmer, everywhere", "দক্ষিণ এশিয়া সবখানেই গরম হচ্ছে")}
        big={tx(`${sinceStart} °C`, `${bnNum(sinceStart)} °সে`)}
        bigNote={tx(`warmer than in ${first}`, `${firstBn} সালের চেয়ে বেশি গরম`)}
        story={
          <T
            en={
              <>
                <p>
                  Since {first}, the whole region has warmed by about {sinceStart} °C. That is a steady climb of about a third
                  of a degree every 10 years.
                </p>
                <p>
                  All <strong>{tempSum.cells} squares</strong> on our map got warmer, and not one got cooler. {hottest} was the
                  hottest year on record.
                </p>
                <p>
                  Very hot months, more than 1 °C above normal, used to come about <strong>{Math.round(hotThen)} times a year</strong>{" "}
                  in the 1980s. Now it is about <strong>{Math.round(hotNow)} months out of 12</strong>.
                </p>
              </>
            }
            bn={
              <>
                <p>
                  {firstBn} সালের পর থেকে পুরো অঞ্চলটি প্রায় {bnNum(sinceStart)} °সে গরম হয়েছে। অর্থাৎ প্রতি ১০ বছরে প্রায় এক
                  ডিগ্রির তিন ভাগের এক ভাগ করে, ধীরে কিন্তু একটানা।
                </p>
                <p>
                  আমাদের মানচিত্রের <strong>{bnNum(tempSum.cells)}টি বর্গের সবগুলোই</strong> গরম হয়েছে, একটিও ঠান্ডা হয়নি।{" "}
                  {bnNum(hottest)} সাল ছিল রেকর্ডে সবচেয়ে গরম বছর।
                </p>
                <p>
                  খুব গরম মাস (স্বাভাবিকের চেয়ে ১ °সে-র বেশি) ১৯৮০-এর দশকে বছরে <strong>প্রায় {bnNum(Math.round(hotThen))}টি</strong>{" "}
                  আসত। এখন <strong>১২ মাসের মধ্যে প্রায় {bnNum(Math.round(hotNow))}টি</strong>।
                </p>
              </>
            }
          />
        }
        why={tx(
          "Gases from burning coal, oil and gas trap heat, like a blanket around the Earth.",
          "কয়লা, তেল ও গ্যাস পোড়ালে যে গ্যাস তৈরি হয়, তা পৃথিবীর চারপাশে কম্বলের মতো তাপ আটকে রাখে।",
        )}
        soWhat={tx(
          "More dangerous heatwaves for workers and farmers, and drier land that catches fire more easily.",
          "শ্রমিক ও কৃষকদের জন্য আরও বিপজ্জনক তাপপ্রবাহ, আর শুকনো জমিতে সহজেই আগুন লাগে।",
        )}
        sure={<Sureness p={tStudy.p} />}
        visual={
          <div className="space-y-4">
            <figure className="rounded-2xl bg-card p-5 shadow-soft">
              <figcaption className="mb-2 text-sm font-medium text-ink">
                {tx("How much warmer each year was than normal", "প্রতি বছর স্বাভাবিকের চেয়ে কতটা বেশি গরম ছিল")}
              </figcaption>
              <SeriesChart
                years={years}
                values={tSeries}
                slopePerDecade={tStudy.slopePerDecade}
                unit="°C"
                decimals={2}
                axisLabel="°C warmer than the 1951–1980 average"
                axisLabelBn="১৯৫১–১৯৮০ সালের গড়ের চেয়ে কত °সে বেশি"
                zeroLine
                lowerPerDecade={tStudy.lowerPerDecade}
                upperPerDecade={tStudy.upperPerDecade}
                title="South Asia temperature whole year"
              />
            </figure>
            <MiniGridMap
              id="map-warming"
              grid={manifest.grids.temperature}
              stats={tempGrid}
              variable="temperature"
              meta={tMeta}
              limit={0.5}
              title={tx("Warming in every square of the map", "মানচিত্রের প্রতিটি বর্গেই উষ্ণতা বৃদ্ধি")}
              decreaseWord={tx("Cooling", "ঠান্ডা হচ্ছে")}
              increaseWord={tx("Warming", "গরম হচ্ছে")}
            />
          </div>
        }
        details={
          <>
            NASA GISTEMP v4 surface temperature anomalies (2° grid, base 1951–1980), yearly means {first}–{last}. Land-weighted
            regional trend (Sen&apos;s slope) {formatSigned(tStudy.slopePerDecade, 3)} °C/decade, 95% CI{" "}
            {formatSigned(tStudy.lowerPerDecade, 3)} to {formatSigned(tStudy.upperPerDecade, 3)}; Hamed–Rao modified Mann–Kendall{" "}
            {formatP(tStudy.p)}. {tempSum.significantIncrease}/{tempSum.cells} land cells significant after Benjamini–Hochberg
            FDR (α = 0.10). Very hot months = monthly anomaly ≥ 1 °C (1981–1990 mean {hotThen.toFixed(1)}/yr; last five years{" "}
            {hotNow.toFixed(1)}/yr). Independent check: CRU TS 4.10 also shows warming in {cruWarm} of {hazardRegions.length}{" "}
            regions.
          </>
        }
      />

      <Finding
        id="spring"
        n={2}
        icon={<Thermometer size={22} weight="duotone" />}
        title={tx("Spring is heating up fastest, especially in the mountains", "বসন্তে গরম বাড়ছে সবচেয়ে দ্রুত, বিশেষ করে পাহাড়ে")}
        big={tx(`${fastestRate} °C`, `${bnNum(fastestRate)} °সে`)}
        bigNote={tx(`every 10 years in March–May · ${fastest.name}`, `মার্চ–মে মাসে প্রতি ১০ বছরে · ${fastest.nameBn}`)}
        story={
          <T
            en={
              <>
                <p>
                  March to May is already the hottest, driest time of year, just before the monsoon. That is exactly when the
                  warming is fastest.
                </p>
                <p>
                  Mountains warm fastest of all: the {fastest.name} about <strong>{times} times faster</strong> than the{" "}
                  {slowest.name}, where the sea keeps temperatures steady.
                </p>
              </>
            }
            bn={
              <>
                <p>
                  মার্চ থেকে মে, বর্ষার ঠিক আগের এই সময়টা এমনিতেই বছরের সবচেয়ে গরম ও শুকনো। আর ঠিক এই সময়েই উষ্ণতা বাড়ছে
                  সবচেয়ে দ্রুত।
                </p>
                <p>
                  পাহাড় গরম হচ্ছে সবার চেয়ে দ্রুত: {fastest.nameBn} গরম হচ্ছে {slowest.nameBn}-এর চেয়ে প্রায়{" "}
                  <strong>{bnNum(times)} গুণ দ্রুত</strong>। সেখানে কাছের সাগর তাপমাত্রা স্থির রাখে।
                </p>
              </>
            }
          />
        }
        why={tx(
          "In the mountains, snow melts earlier and the dark ground underneath soaks up more sunlight.",
          "পাহাড়ে বরফ আগেভাগে গলে যায়, আর নিচের গাঢ় রঙের মাটি বেশি রোদ শুষে নেয়।",
        )}
        soWhat={tx(
          "Longer fire seasons, heat damage to wheat just before harvest, and glaciers melting faster.",
          "আগুনের মৌসুম দীর্ঘ হয়, ফসল তোলার ঠিক আগে গম তাপে ক্ষতিগ্রস্ত হয়, আর হিমবাহ দ্রুত গলে।",
        )}
        sure={<Sureness p={tFastest.p} />}
        visual={
          <RegionBars
            bars={preBars}
            limit={0.5}
            variable="temperature"
            unit="°C every 10 years"
            unitBn="প্রতি ১০ বছরে °সে"
            decimals={2}
            label={tx("Warming in March–May, region by region", "মার্চ–মে মাসের উষ্ণতা, অঞ্চল অনুযায়ী")}
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
        title={tx("The monsoon rain is moving, not disappearing", "বর্ষার বৃষ্টি হারিয়ে যাচ্ছে না, জায়গা বদলাচ্ছে")}
        big={tx(`${wetPct}% vs ${dryPct}%`, `${bnNum(wetPct)}% বনাম ${bnNum(dryPct)}%`)}
        bigNote={tx(
          `rain every 10 years · ${wettest.name} vs ${driest.name}`,
          `প্রতি ১০ বছরে বৃষ্টি · ${wettest.nameBn} বনাম ${driest.nameBn}`,
        )}
        story={
          <T
            en={
              <>
                <p>
                  Add up all the monsoon rain over South Asia and the total has hardly changed. But <strong>where</strong> it
                  falls has changed: the dry northwest (the {wettest.name}) gets more, while the {driest.name} and nearby wet
                  regions in the east get less.
                </p>
                <p>This is the big idea of our project: one warming world, but opposite changes in different places.</p>
                <p>
                  We checked this with a second, independent rain record. It agrees for the {confirmedNames}. For some mountain
                  regions the two records disagree, so we don&apos;t claim a rain trend there.
                </p>
              </>
            }
            bn={
              <>
                <p>
                  দক্ষিণ এশিয়ার সব বর্ষার বৃষ্টি যোগ করলে মোট পরিমাণ প্রায় বদলায়নি। কিন্তু বৃষ্টি <strong>কোথায়</strong> পড়ে, সেটা
                  বদলেছে: শুষ্ক উত্তর-পশ্চিম ({wettest.nameBn}) বেশি পাচ্ছে, আর {driest.nameBn} ও পূর্বের আশপাশের ভেজা অঞ্চল
                  কম পাচ্ছে।
                </p>
                <p>এটাই আমাদের প্রকল্পের মূল কথা: পৃথিবী একটাই এবং তা গরম হচ্ছে, কিন্তু ভিন্ন জায়গায় পরিবর্তন উল্টো দিকে।</p>
                <p>
                  আমরা আরেকটি স্বাধীন বৃষ্টির রেকর্ড দিয়ে এটি যাচাই করেছি। {confirmedNamesBn}-এর ক্ষেত্রে দুটো রেকর্ড একমত। কিছু
                  পাহাড়ি অঞ্চলে দুটো রেকর্ড একমত নয়, তাই সেখানে আমরা বৃষ্টির প্রবণতা দাবি করি না।
                </p>
              </>
            }
          />
        }
        why={tx(
          "Air pollution can weaken the monsoon winds in the east, and warmer seas push more moisture to the northwest. Scientists are still working out the exact mix.",
          "বায়ুদূষণ পূর্ব দিকে মৌসুমি বাতাসকে দুর্বল করতে পারে, আর উষ্ণ সাগর উত্তর-পশ্চিমে বেশি জলীয় বাষ্প ঠেলে দেয়। কোনটার ভূমিকা কতটা, বিজ্ঞানীরা এখনো তা খুঁজছেন।",
        )}
        soWhat={tx(
          "Bigger floods on the crowded plains of Pakistan, and less water for rice farms and rivers in the east.",
          "পাকিস্তানের ঘনবসতিপূর্ণ সমভূমিতে বড় বন্যা, আর পূর্বে ধানক্ষেত ও নদীর জন্য কম পানি।",
        )}
        sure={
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm text-ink">
            <Dots level={2} />
            {tx(
              "Fairly sure: two rain records agree on the main pattern, but not for every region",
              "মোটামুটি নিশ্চিত: মূল ধরনটিতে দুটো বৃষ্টির রেকর্ড একমত, তবে সব অঞ্চলে নয়",
            )}
          </span>
        }
        visual={
          <div className="space-y-4">
            <MiniGridMap
              id="map-rain"
              grid={manifest.grids.rainfall}
              stats={rainGrid}
              variable="rainfall"
              meta={rMeta}
              limit={rainLimit}
              percent
              title={tx("Change in monsoon rain (June–September)", "বর্ষার বৃষ্টির পরিবর্তন (জুন–সেপ্টেম্বর)")}
              decreaseWord={tx("Drier", "শুষ্ক হচ্ছে")}
              increaseWord={tx("Wetter", "বৃষ্টি বাড়ছে")}
            />
            <RegionBars
              bars={rainBars}
              limit={15}
              variable="rainfall"
              unit="% change in monsoon rain every 10 years"
              unitBn="প্রতি ১০ বছরে বর্ষার বৃষ্টির পরিবর্তন (%)"
              decimals={1}
              label={tx("Monsoon rain, region by region", "বর্ষার বৃষ্টি, অঞ্চল অনুযায়ী")}
            />
          </div>
        }
        details={
          <>
            GPCP v2.3 monthly precipitation (2.5° grid), June–September totals {first}–{last}. Of {rainSum.cells} land cells,{" "}
            {rainSum.significantIncrease} show a significant increase and {rainSum.significantDecrease} a significant decrease after
            FDR control; {rainSum.cells - rainSum.significantIncrease - rainSum.significantDecrease} show no detectable trend. Whole
            study area: {formatSigned(trendOf(study, "rainfall_monsoon").slopePerDecade, 1)} mm/decade (
            {formatP(trendOf(study, "rainfall_monsoon").p)}, not significant). Independent check with CRU TS 4.10: same
            significant direction for {confirmedNames}; see How it works for every region.
          </>
        }
      />

      <Finding
        id="disasters"
        n={4}
        icon={<Lightbulb size={22} weight="duotone" />}
        title={tx("Disasters follow the weather", "দুর্যোগ আবহাওয়ার পথ ধরে আসে")}
        big={tx(`${linkedCount} regions`, `${bnNum(linkedCount)}টি অঞ্চল`)}
        bigNote={tx(
          "where the worst disaster years match the weather",
          "যেখানে সবচেয়ে খারাপ দুর্যোগের বছরগুলো আবহাওয়ার সাথে মেলে",
        )}
        story={
          <T
            en={
              <>
                <p>
                  We lined up the worst disaster years with the weather in the same season. <strong>Hot springs</strong> came
                  with more forest fires in Central India. <strong>Rainy monsoons</strong> came with more landslides in the
                  Western Himalaya and more floods on the Indus plain.
                </p>
                <p>
                  Just as useful: in some places the weather does <em>not</em> explain disasters. The Bengal delta keeps
                  flooding even though its own rain is falling, because its floods come from rivers upstream.
                </p>
              </>
            }
            bn={
              <>
                <p>
                  আমরা সবচেয়ে খারাপ দুর্যোগের বছরগুলোকে একই মৌসুমের আবহাওয়ার পাশে রেখে মিলিয়ে দেখেছি। <strong>গরম বসন্তে</strong>{" "}
                  মধ্য ভারতে বনে আগুন বেশি লেগেছে। <strong>বৃষ্টিবহুল বর্ষায়</strong> পশ্চিম হিমালয়ে ভূমিধস আর সিন্ধু সমভূমিতে
                  বন্যা বেশি হয়েছে।
                </p>
                <p>
                  সমান জরুরি কথা: কিছু জায়গায় আবহাওয়া দিয়ে দুর্যোগ ব্যাখ্যা <em>করা যায় না</em>। বাংলার ব-দ্বীপে নিজের বৃষ্টি
                  কমলেও বন্যা হয়েই চলেছে, কারণ এখানকার বন্যা আসে উজানের নদী থেকে।
                </p>
              </>
            }
          />
        }
        why={tx(
          "Heat dries forests into fuel. Heavy rain soaks steep slopes until they slide, and floods flat land.",
          "গরম বনকে শুকিয়ে জ্বালানিতে পরিণত করে। ভারী বৃষ্টি খাড়া ঢাল ভিজিয়ে ধসিয়ে দেয়, আর সমতল জমি ডুবিয়ে দেয়।",
        )}
        soWhat={tx(
          "Where disasters follow the weather, weather records can warn us early. Where they don't, other causes need attention.",
          "যেখানে দুর্যোগ আবহাওয়ার পথ ধরে আসে, সেখানে আবহাওয়ার রেকর্ড আগেভাগে সতর্ক করতে পারে। যেখানে তা হয় না, সেখানে অন্য কারণগুলোর দিকে নজর দিতে হবে।",
        )}
        sure={
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm text-ink">
            <Dots level={2} />
            {tx("Fairly sure: the disaster records are short (11 to 26 years)", "মোটামুটি নিশ্চিত: দুর্যোগের রেকর্ডগুলো ছোট (১১ থেকে ২৬ বছর)")}
          </span>
        }
        wide
        visual={
          <div className="grid gap-4 lg:grid-cols-3">
            <EventDriverChart
              id="chart-fires"
              title={tx("Forest fires in Central India", "মধ্য ভারতে বনের আগুন")}
              years={fires.years}
              counts={fires.counts}
              highYears={fires.highEventYears}
              driverValues={driverSeries(fires, "temperature_pre-monsoon")}
              eventLabel={tx("Fires spotted each spring", "প্রতি বসন্তে দেখা আগুন")}
              driverLabel={tx("How hot that spring was", "সেই বসন্ত কতটা গরম ছিল")}
              driverUnit="°C above normal"
              unitShort={["°C", "°সে"]}
              eventColor={EVENT_COLOR.wildfire}
              driverDecimals={2}
            />
            <EventDriverChart
              id="chart-slides"
              title={tx("Landslides in the Western Himalaya", "পশ্চিম হিমালয়ে ভূমিধস")}
              years={slides.years}
              counts={slides.counts}
              highYears={slides.highEventYears}
              driverValues={driverSeries(slides, "rainfall_monsoon")}
              eventLabel={tx("Landslides each monsoon", "প্রতি বর্ষায় ভূমিধস")}
              driverLabel={tx("How much monsoon rain fell", "বর্ষায় কত বৃষ্টি হয়েছে")}
              driverUnit="mm"
              unitShort={["mm", "মিমি"]}
              eventColor={EVENT_COLOR.landslide}
              driverDecimals={0}
            />
            <EventDriverChart
              id="chart-floods"
              title={tx("Floods on the Indus plain", "সিন্ধু সমভূমিতে বন্যা")}
              years={floods.years}
              counts={floods.counts}
              highYears={floods.highEventYears}
              driverValues={driverSeries(floods, "rainfall_monsoon")}
              eventLabel={tx("Flood alerts each year", "প্রতি বছর বন্যা সতর্কতা")}
              driverLabel={tx("How much monsoon rain fell", "বর্ষায় কত বৃষ্টি হয়েছে")}
              driverUnit="mm"
              unitShort={["mm", "মিমি"]}
              eventColor={EVENT_COLOR.flood}
              driverDecimals={0}
            />
          </div>
        }
        visualNote={tx(
          "Top: disasters each year; the dark bars are the worst years. Bottom: the weather that season, with those same worst years shaded and marked with big dots. When the big dots sit near the top, bad weather and bad disaster years came together.",
          "উপরে: প্রতি বছরের দুর্যোগ; গাঢ় দণ্ডগুলো সবচেয়ে খারাপ বছর। নিচে: সেই মৌসুমের আবহাওয়া, একই খারাপ বছরগুলো ছায়া ও বড় বিন্দু দিয়ে চিহ্নিত। বড় বিন্দুগুলো উপরের দিকে থাকলে বুঝবেন, খারাপ আবহাওয়া আর খারাপ দুর্যোগের বছর একসাথে এসেছে।",
        )}
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
        title={tx(`Where to prepare in ${last}`, `${lastBn}: কোথায় প্রস্তুতি দরকার`)}
        big={tx(`${nWatch} region${plural}`, `${bnNum(nWatch)}টি অঞ্চল`)}
        bigNote={tx(`looked like past disaster years in ${last}`, `${lastBn} সালে আগের দুর্যোগের বছরগুলোর মতো দেখাচ্ছিল`)}
        story={
          <T
            en={
              <>
                <p>
                  In {last}, monsoon rain on the Indus plain was higher than in{" "}
                  <strong>{signalDriver(floods).latest.percentile}% of years</strong> since {first}, and in the Western Himalaya
                  higher than in <strong>{signalDriver(slides).latest.percentile}%</strong>. Both look like past disaster years.
                </p>
                {last === 2025 && <p>And in 2025, both regions did suffer widely reported floods and landslides.</p>}
              </>
            }
            bn={
              <>
                <p>
                  {lastBn} সালে সিন্ধু সমভূমিতে বর্ষার বৃষ্টি {firstBn} সালের পর থেকে{" "}
                  <strong>{bnNum(signalDriver(floods).latest.percentile)}% বছরের চেয়ে বেশি</strong> ছিল, আর পশ্চিম হিমালয়ে{" "}
                  <strong>{bnNum(signalDriver(slides).latest.percentile)}%</strong> বছরের চেয়ে বেশি। দুটোই আগের দুর্যোগের বছরগুলোর
                  মতো।
                </p>
                {last === 2025 && <p>আর ২০২৫ সালে দুটো অঞ্চলেই সত্যিই ব্যাপক বন্যা ও ভূমিধসের খবর এসেছিল।</p>}
              </>
            }
          />
        }
        why={tx(
          "We only compare places where the weather and disasters are clearly linked, so the check means something.",
          "আমরা শুধু সেসব জায়গা তুলনা করি যেখানে আবহাওয়া ও দুর্যোগের স্পষ্ট যোগসূত্র আছে, যাতে তুলনাটা অর্থবহ হয়।",
        )}
        soWhat={tx(
          "Authorities can prepare early: check risky slopes, stock boats and medicine, and warn people. It is not a forecast.",
          "কর্তৃপক্ষ আগেভাগে প্রস্তুতি নিতে পারে: ঝুঁকিপূর্ণ ঢাল পরীক্ষা, নৌকা ও ওষুধ মজুত, আর মানুষকে সতর্ক করা। এটি পূর্বাভাস নয়।",
        )}
        sure={
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm text-ink">
            <Dots level={2} />
            {tx("Fairly sure: built on the links in finding 4", "মোটামুটি নিশ্চিত: ৪ নম্বর ফলাফলের যোগসূত্রের ওপর দাঁড়িয়ে")}
          </span>
        }
        visual={
          <figure className="space-y-6 rounded-2xl bg-card p-5 shadow-soft">
            <figcaption className="text-sm font-medium text-ink">
              {tx(`${last} compared with every year since ${first}`, `${lastBn} সাল, ${firstBn} থেকে প্রতিটি বছরের সাথে তুলনায়`)}
            </figcaption>
            {[floods, slides, fires].map((h) => {
              const d = signalDriver(h);
              return (
                <PercentileBar
                  key={h.id}
                  label={tx(`${h.name}: ${d.label.toLowerCase()}`, `${zoneNameBn(h.id, h.name)}: ${driverNameBn(d.key)}`)}
                  status={preparednessSignal(h).kind === "resembles" ? "watch" : "normal"}
                  latestYear={d.latest.year}
                  latest={d.latest.percentile}
                  highEvent={d.highEventYearsPercentile!}
                  color={EVENT_COLOR[h.hazard]}
                />
              );
            })}
            <p className="text-sm text-ink-3">
              {tx(
                "A dot to the right of the line means this year looks like the worst years.",
                "রেখার ডান দিকে বিন্দু থাকলে বুঝবেন, এই বছরটি সবচেয়ে খারাপ বছরগুলোর মতো।",
              )}
            </p>
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
          <h2 className="text-2xl font-semibold text-ink">{tx("Our take", "আমাদের মত")}</h2>
          <p className="mt-3 text-lg leading-relaxed text-ink">
            {tx(
              "The warming is certain, and it is everywhere. What changes from place to place is how it shows up: drying here, heavier rain there, fiercer fire seasons somewhere else. That is why local, season-by-season trends matter more than one big average.",
              "উষ্ণতা বৃদ্ধি নিশ্চিত, এবং তা সবখানে। জায়গাভেদে বদলায় শুধু এর চেহারা: কোথাও শুষ্কতা, কোথাও ভারী বৃষ্টি, কোথাও আরও ভয়াবহ আগুনের মৌসুম। তাই একটা বড় গড়ের চেয়ে স্থানীয়, মৌসুমভিত্তিক প্রবণতা বেশি গুরুত্বপূর্ণ।",
            )}
          </p>
        </div>
        <div className="rounded-3xl bg-card p-8 shadow-soft">
          <h2 className="text-2xl font-semibold text-ink">{tx("What we can't say (yet)", "যা আমরা (এখনো) বলতে পারি না")}</h2>
          <ul className="mt-4 space-y-3 text-ink-2">
            {[
              [
                "Each map square is 200–280 km wide, so one valley or city can be different.",
                "মানচিত্রের প্রতিটি বর্গ ২০০–২৮০ কিমি চওড়া, তাই কোনো একটি উপত্যকা বা শহর আলাদা হতে পারে।",
              ],
              [
                "The landslide record covers only 11 years and comes from news reports.",
                "ভূমিধসের রেকর্ড মাত্র ১১ বছরের, আর তা সংবাদপত্রের খবর থেকে নেওয়া।",
              ],
              ["Satellites miss fires under clouds and smoke.", "মেঘ ও ধোঁয়ার নিচের আগুন স্যাটেলাইট দেখতে পায় না।"],
              [
                "A link is not a cause: land use, roads and people also play a part.",
                "যোগসূত্র মানেই কারণ নয়: জমির ব্যবহার, রাস্তা ও মানুষেরও ভূমিকা আছে।",
              ],
            ].map(([en, bn]) => (
              <li key={en}>• {tx(en, bn)}</li>
            ))}
          </ul>
        </div>
      </section>

      <Glossary />

      <div className="mt-16 flex flex-wrap items-center gap-4">
        <Link
          href="/trends"
          className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-6 py-3 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
        >
          {tx("Explore the trends yourself", "নিজেই প্রবণতাগুলো ঘুরে দেখুন")} <ArrowRight size={18} />
        </Link>
        <Link href="/hazards" className="inline-flex min-h-10 items-center font-medium text-accent hover:underline">
          {tx("Check disaster risk by region", "অঞ্চলভিত্তিক দুর্যোগের ঝুঁকি দেখুন")}
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
  title: React.ReactNode;
  big: React.ReactNode;
  bigNote: React.ReactNode;
  story: React.ReactNode;
  why: React.ReactNode;
  soWhat: React.ReactNode;
  sure: React.ReactNode;
  visual: React.ReactNode;
  visualNote?: React.ReactNode;
  details: React.ReactNode;
  wide?: boolean;
}) {
  const text = (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">{icon}</span>
        <span className="text-sm font-medium text-ink-3">{tx(`Finding ${n}`, `ফলাফল ${bnNum(n)}`)}</span>
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
            <Question size={18} className="text-accent" /> {tx("Why is this happening?", "কেন এমন হচ্ছে?")}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{why}</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <UsersThree size={18} className="text-accent" /> {tx("What does it mean for people?", "মানুষের জন্য এর মানে কী?")}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{soWhat}</p>
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 text-sm font-medium text-ink-3">{tx("How sure are we?", "আমরা কতটা নিশ্চিত?")}</div>
        {sure}
      </div>
    </div>
  );

  return (
    <section id={id} className="mt-24 scroll-mt-36">
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
        <Numbers
          title={tx("For scientists: the exact method and numbers", "বিজ্ঞানীদের জন্য: সঠিক পদ্ধতি ও সংখ্যা (ইংরেজিতে)")}
        >
          {details}
        </Numbers>
      </div>
    </section>
  );
}

const TERMS: [string, string, string, string][] = [
  [
    "Trend",
    "The long-term direction something is moving in, ignoring the ups and downs from one year to the next.",
    "প্রবণতা",
    "বছর বছর ওঠানামা বাদ দিয়ে, কোনো কিছু দীর্ঘমেয়াদে কোন দিকে যাচ্ছে।",
  ],
  [
    "Clear change (significant)",
    "A change that is very unlikely to be luck. It does not mean big, only real.",
    "স্পষ্ট পরিবর্তন (তাৎপর্যপূর্ণ)",
    "এমন পরিবর্তন যা কাকতালীয় হওয়ার সম্ভাবনা খুবই কম। এর মানে বড় নয়, শুধু সত্যিকারের।",
  ],
  [
    "No clear change",
    "The ups and downs are too big to tell. It does not prove nothing is changing.",
    "স্পষ্ট পরিবর্তন নেই",
    "ওঠানামা এত বেশি যে নিশ্চিত বলা যায় না। এর মানে এই নয় যে কিছুই বদলাচ্ছে না।",
  ],
  [
    "Every 10 years",
    "How much something changes per decade. +0.3 °C every 10 years is about 1 °C every 33 years.",
    "প্রতি ১০ বছরে",
    "প্রতি দশকে কতটা বদলায়। প্রতি ১০ বছরে +০.৩ °সে মানে প্রায় ৩৩ বছরে ১ °সে।",
  ],
  [
    "Warmer than normal",
    "Compared with the average of 1951–1980, a common starting point for climate records.",
    "স্বাভাবিকের চেয়ে গরম",
    "১৯৫১–১৯৮০ সালের গড়ের সাথে তুলনা, যা জলবায়ুর রেকর্ডে প্রচলিত একটি ভিত্তি।",
  ],
  [
    "Link (correlation)",
    "Two things that rise and fall together. It is a clue, not proof that one causes the other.",
    "যোগসূত্র (সহসম্পর্ক)",
    "দুটো জিনিস যা একসাথে ওঠে-নামে। এটি একটি সূত্র মাত্র, একটি যে অন্যটির কারণ, তার প্রমাণ নয়।",
  ],
  [
    "Hot season / Rainy season",
    "March–May, the hot dry weeks before the rains / June–September, the monsoon.",
    "গরমকাল / বর্ষাকাল",
    "মার্চ–মে, বৃষ্টির আগের গরম ও শুকনো সপ্তাহগুলো / জুন–সেপ্টেম্বর, বর্ষা।",
  ],
  [
    "Map square",
    "The data divides the map into squares about 200–280 km wide; each has one value per year.",
    "মানচিত্রের বর্গ",
    "তথ্য মানচিত্রকে প্রায় ২০০–২৮০ কিমি চওড়া বর্গে ভাগ করে; প্রতিটি বর্গে বছরে একটি করে মান থাকে।",
  ],
];

function Glossary() {
  return (
    <section id="glossary" className="mt-24 scroll-mt-36">
      <h2 className="text-2xl font-semibold text-ink">{tx("Words explained", "শব্দের মানে")}</h2>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        {TERMS.map(([term, def, termBn, defBn]) => (
          <div key={term} className="rounded-2xl bg-card p-5 shadow-soft">
            <dt className="font-semibold text-ink">{tx(term, termBn)}</dt>
            <dd className="mt-1 leading-relaxed text-ink-2">{tx(def, defBn)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
