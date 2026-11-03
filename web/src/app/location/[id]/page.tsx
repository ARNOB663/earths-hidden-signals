import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertPreferences } from "@/components/intelligence/AlertPreferences";
import { Locator } from "@/components/intelligence/Locator";
import {
  AlertCard,
  CompositeCard,
  ConfidenceChips,
  Disclaimer,
  ForecastGap,
  FreshnessStamp,
  HazardCard,
  IndicatorCard,
  LevelBadge,
  OfficialAlertCard,
  PreparednessList,
  Section,
  Timeline,
  ValidationList,
} from "@/components/intelligence/parts";
import { ShareButton } from "@/components/ui/ShareButton";
import { bnNum } from "@/lib/bn";
import { T } from "@/lib/i18n";
import { KIND_LABEL } from "@/lib/intelligence/conclude";
import { readAlerts, readCurrent, readHistory, readLocation, readLocations } from "@/lib/intelligence/data";
import { readPlaceSignals } from "@/lib/data";

export const dynamicParams = false;
// Data pages re-render daily, so a pipeline refresh shows up without a redeploy.
export const revalidate = 86400;

export async function generateStaticParams() {
  return (await readLocations()).map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/location/[id]">): Promise<Metadata> {
  const loc = await readLocation((await params).id);
  if (!loc) return {};
  return {
    title: `${loc.name} · Climate screening · Earth's Hidden Signals`,
    description: loc.conclusion.headline.en,
  };
}

const QUESTIONS = [
  { key: "situation", en: "What is happening?", bn: "কী ঘটছে?" },
  { key: "normality", en: "Is it normal?", bn: "এটা কি স্বাভাবিক?" },
  { key: "magnitude", en: "How unusual is it?", bn: "কতটা অস্বাভাবিক?" },
  { key: "development", en: "Is it getting worse?", bn: "এটা কি খারাপ হচ্ছে?" },
] as const;

async function countryShapes() {
  const data = await readPlaceSignals();
  return data.places.filter((p) => p.type === "country").map((p) => ({ id: p.id, geometry: p.geometry as { type: "Polygon" | "MultiPolygon"; coordinates: unknown } }));
}

export default async function LocationPage({ params }: PageProps<"/location/[id]">) {
  const loc = await readLocation((await params).id);
  if (!loc) notFound();
  const [source, current, alerts, history, shapes] = await Promise.all([
    readLocation(loc.sourceId),
    readCurrent(),
    readAlerts(),
    readHistory(),
    countryShapes(),
  ]);
  if (!source) notFound();

  const c = loc.conclusion;
  const ind = current.indicators[loc.sourceId] ?? {};
  const comp = current.composites[loc.sourceId] ?? {};
  const internal = alerts.computed.filter((a) => a.locationId === loc.alertsFrom);
  const past = alerts.reconstructed.filter((a) => a.locationId === loc.alertsFrom).slice(-6).reverse();
  const official = alerts.official.filter((a) => a.locationId === loc.alertsFrom);
  const rows = history.periods[loc.alertsFrom] ?? [];
  const headlineFresh = ind["temperature_annual"] ?? ind["rainfall_annual"];
  const kind = KIND_LABEL[loc.kind];
  const country = loc.kind === "country" ? loc.id : null;

  const temps = ["temperature_annual", "temperature_pre-monsoon", "temperature_monsoon", "hot-months_annual"].map((k) => ind[k]).filter(Boolean);
  const daily = ["heavy-rain_annual", "wettest-day_annual", "dry-spell_annual"].map((k) => ind[k]).filter(Boolean);
  const monthly = Object.entries(ind).filter(([k]) => /_\d\d$/.test(k)).map(([, v]) => v);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
        <Link href="/" className="hover:text-ink"><T en="Home" bn="হোম" /></Link>
        <span aria-hidden> / </span>
        <Link href="/locations" className="hover:text-ink"><T en="Locations" bn="স্থান" /></Link>
        <span aria-hidden> / </span>
        <span className="text-ink-2"><T en={loc.name} bn={loc.nameBn} /></span>
      </nav>

      {/* 1. Conclusion headline */}
      <header className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
            <T en={kind.en} bn={kind.bn} />
            {loc.country && (
              <>
                <span aria-hidden>·</span>
                <T en={loc.country} bn={loc.countryBn ?? loc.country} />
              </>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              <T en={loc.name} bn={loc.nameBn} />
            </h1>
            <LevelBadge level={c.level} large />
            <ShareButton />
          </div>
          <p className="mt-4 max-w-[62ch] text-xl leading-relaxed text-ink">
            <T en={c.headline.en} bn={c.headline.bn} />
          </p>
          {headlineFresh && (
            <div className="mt-3">
              <FreshnessStamp f={headlineFresh} asOf={current.asOf} />
            </div>
          )}
          {loc.geography.fallback && (
            <p className="mt-3 max-w-[62ch] rounded-xl bg-watch-soft px-3 py-2 text-sm text-watch">
              <T en={loc.geography.fallbackReasonEn ?? ""} bn={loc.geography.fallbackReasonBn ?? ""} />
            </p>
          )}
          <div className="mt-4">
            <Disclaimer />
          </div>
        </div>
        <Locator
          countries={shapes}
          highlight={source.kind === "country" ? source.countryCodes[0]?.toLowerCase() : undefined}
          bbox={source.kind !== "country" ? source.bbox : undefined}
          point={loc.point}
          label={{
            en: `Area used for the numbers: ${loc.geography.sourceNameEn} (${loc.geography.resolutionLabelEn}).`,
            bn: `সংখ্যাগুলোর এলাকা: ${loc.geography.sourceNameBn} (${loc.geography.resolutionLabelBn})।`,
          }}
        />
      </header>

      {/* 2. The seven questions */}
      <Section id="conclusion" label={<T en="Conclusion" bn="সিদ্ধান্ত" />} title={<T en="Seven questions, answered from the data" bn="তথ্য থেকে সাতটি প্রশ্নের উত্তর" />}>
        <dl className="grid gap-4 md:grid-cols-2">
          {QUESTIONS.map((q) => (
            <div key={q.key} className="rounded-2xl border border-line bg-card p-5">
              <dt className="text-sm font-semibold text-ink"><T en={q.en} bn={q.bn} /></dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-2"><T en={c[q.key].en} bn={c[q.key].bn} /></dd>
            </div>
          ))}
          <div className="rounded-2xl border border-line bg-card p-5">
            <dt className="text-sm font-semibold text-ink"><T en="What could happen?" bn="কী ঘটতে পারে?" /></dt>
            <dd className="mt-2">
              <ul className="space-y-1.5 text-sm leading-relaxed text-ink-2">
                {c.hazards.map((h) => (
                  <li key={h.hazard}><T en={h.en} bn={h.bn} /></li>
                ))}
              </ul>
            </dd>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <dt className="text-sm font-semibold text-ink"><T en="How reliable is this?" bn="এটা কতটা নির্ভরযোগ্য?" /></dt>
            <dd className="mt-2 text-sm leading-relaxed text-ink-2"><T en={c.reliability.en} bn={c.reliability.bn} /></dd>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5 md:col-span-2">
            <dt className="text-sm font-semibold text-ink"><T en="What should I do?" bn="আমার কী করা উচিত?" /></dt>
            <dd className="mt-2">
              <ul className="space-y-1.5 text-sm leading-relaxed text-ink-2">
                {c.actions.map((a) => (
                  <li key={a.id}><T en={a.en} bn={a.bn} /></li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </Section>

      {/* 3. Current status */}
      <Section id="status" label={<T en="Current status" bn="বর্তমান অবস্থা" />} title={<T en="Latest assessed periods vs 1991–2020" bn="সর্বশেষ মূল্যায়িত সময় বনাম ১৯৯১–২০২০" />}>
        {monthly.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {monthly.slice(-2).map((r) => <IndicatorCard key={r.id} r={r} asOf={current.asOf} />)}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {temps.map((r) => <IndicatorCard key={r.id} r={r} asOf={current.asOf} />)}
        </div>
        <h3 className="mt-6 text-lg font-semibold text-ink"><T en="Rainfall" bn="বৃষ্টি" /></h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {(["annual", "monsoon", "pre-monsoon"] as const).map((p) => comp[p] && <CompositeCard key={p} c={comp[p]} />)}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {daily.map((r) => <IndicatorCard key={r.id} r={r} asOf={current.asOf} />)}
        </div>
      </Section>

      {/* 4. Hazard screening */}
      <Section id="hazards" label={<T en="Hazard screening" bn="দুর্যোগ স্ক্রিনিং" />} title={<T en="What the observations could mean" bn="পর্যবেক্ষণের সম্ভাব্য অর্থ" />}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {loc.hazards.map((h) => <HazardCard key={h.hazard} h={h} />)}
        </div>
      </Section>

      {/* 5. Alerts */}
      <Section id="alerts" label={<T en="Alerts" bn="সতর্কতা" />} title={<T en="Our screening and official records, kept apart" bn="আমাদের স্ক্রিনিং ও আনুষ্ঠানিক রেকর্ড, আলাদা" />}>
        {loc.kind === "city" && (
          <p className="mb-3 text-sm text-ink-3">
            <T en={`Alerts are computed once for ${loc.geography.sourceNameEn}, the area this estimate comes from.`} bn={`সতর্কতা ${loc.geography.sourceNameBn}-এর জন্য একবার গণনা করা হয়, যেখান থেকে এই অনুমান আসে।`} />
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3"><T en="Internal screening (this project)" bn="অভ্যন্তরীণ স্ক্রিনিং (এই প্রকল্প)" /></h3>
            <div className="mt-3 space-y-3">
              {internal.length ? internal.map((a) => <AlertCard key={a.id} a={a} />) : (
                <p className="text-sm text-ink-3"><T en="No internal alert in the latest assessed period." bn="সর্বশেষ মূল্যায়িত সময়ে কোনো অভ্যন্তরীণ সতর্কতা নেই।" /></p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3"><T en="Official records (GDACS)" bn="আনুষ্ঠানিক রেকর্ড (GDACS)" /></h3>
            <div className="mt-3 space-y-3">
              {official.length ? official.slice(0, 6).map((a) => <OfficialAlertCard key={a.id} a={a} />) : (
                <p className="text-sm text-ink-3"><T en="No GDACS flood record in this area in the latest assessed year." bn="সর্বশেষ মূল্যায়িত বছরে এই এলাকায় GDACS-এর কোনো বন্যার রেকর্ড নেই।" /></p>
              )}
              <p className="text-xs text-ink-3"><T en={alerts.officialWindowNoteEn} bn="আনুষ্ঠানিক রেকর্ড সর্বশেষ মূল্যায়িত বছরের; সরাসরি GDACS সতর্কতা এই অফলাইন রানে আনা হয় না।" /></p>
            </div>
          </div>
        </div>
        {past.length > 0 && (
          <details className="mt-6 rounded-xl border border-line">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink-2">
              <T en={`Historical replay: ${past.length} earlier alerts that would have triggered`} bn={`ঐতিহাসিক পুনরাবৃত্তি: আগের ${bnNum(past.length)}টি সতর্কতা যা তৈরি হতো`} />
            </summary>
            <div className="grid gap-3 border-t border-line p-4 md:grid-cols-2">
              {past.map((a) => <AlertCard key={a.id} a={a} />)}
            </div>
          </details>
        )}
      </Section>

      {/* 6. Reliability */}
      <Section id="reliability" label={<T en="Reliability" bn="নির্ভরযোগ্যতা" />} title={<T en="Four separate confidences" bn="চারটি আলাদা আস্থা" />}>
        <ConfidenceChips confidences={loc.confidences} />
        <p className="mt-3 text-sm text-ink-3">
          <T en="Grades are never combined into one number. Open a chip to see why it has its grade." bn="মানগুলো কখনো একটি সংখ্যায় মেশানো হয় না। কেন এই মান, তা দেখতে খুলুন।" />
        </p>
      </Section>

      {/* 7. Validation */}
      <Section id="validation" label={<T en="Validation" bn="যাচাইকরণ" />} title={<T en="Second sources, and how independent they are" bn="দ্বিতীয় উৎস, এবং সেগুলো কতটা স্বাধীন" />}>
        <ValidationList verdicts={loc.validation} />
      </Section>

      {/* 8. Development */}
      <Section id="development" label={<T en="Development" bn="অগ্রগতি" />} title={<T en="How the assessment has changed" bn="মূল্যায়ন কীভাবে বদলেছে" />}>
        <p className="mb-4 max-w-[70ch] text-sm text-ink-2"><T en={c.development.en} bn={c.development.bn} /></p>
        <Timeline rows={rows} />
      </Section>

      {/* 9. Preparedness */}
      <Section id="prepare" label={<T en="Preparedness" bn="প্রস্তুতি" />} title={<T en="What to do, official guidance first" bn="কী করবেন, আগে আনুষ্ঠানিক নির্দেশনা" />}>
        <PreparednessList actions={c.actions} sources={loc.officialSources} />
        <div className="mt-4">
          <AlertPreferences locationId={loc.id} locationName={loc.name} hazards={loc.hazards.map((h) => h.hazard)} asOf={current.asOf} />
        </div>
      </Section>

      {/* 10. Forecast gap and geography */}
      <Section id="limits" label={<T en="Limits" bn="সীমাবদ্ধতা" />} title={<T en="What this page cannot tell you" bn="এই পাতা যা বলতে পারে না" />}>
        <ForecastGap />
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-card p-4">
            <dt className="text-xs text-ink-3"><T en="Area used" bn="ব্যবহৃত এলাকা" /></dt>
            <dd className="mt-1 text-ink"><T en={loc.geography.sourceNameEn} bn={loc.geography.sourceNameBn} /></dd>
          </div>
          <div className="rounded-xl border border-line bg-card p-4">
            <dt className="text-xs text-ink-3"><T en="Grid" bn="গ্রিড" /></dt>
            <dd className="mt-1 text-ink"><T en={loc.geography.resolutionLabelEn} bn={loc.geography.resolutionLabelBn} /></dd>
          </div>
          <div className="rounded-xl border border-line bg-card p-4">
            <dt className="text-xs text-ink-3"><T en="Grid cells used" bn="ব্যবহৃত গ্রিড বর্গ" /></dt>
            <dd className="mt-1 tabular-nums text-ink">
              <T
                en={`${loc.geography.cellsUsed.temperature ?? "—"} temperature · ${loc.geography.cellsUsed.rainfall ?? "—"} rainfall`}
                bn={`তাপমাত্রা ${bnNum(loc.geography.cellsUsed.temperature ?? 0)} · বৃষ্টি ${bnNum(loc.geography.cellsUsed.rainfall ?? 0)}`}
              />
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-card p-4">
            <dt className="text-xs text-ink-3"><T en="Coverage" bn="আওতা" /></dt>
            <dd className="mt-1 tabular-nums text-ink">{loc.geography.coveragePct}%</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-3">
          <T en={`Weighting: ${loc.geography.weighting}. Grid averages, not point measurements. Thresholds ${c.thresholdsId}; evidence ids: ${c.evidenceIds.join(", ")}.`} bn={`ওজন: ${loc.geography.weighting}। গ্রিডের গড়, কোনো বিন্দুর পরিমাপ নয়। থ্রেশহোল্ড ${c.thresholdsId}।`} />
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {country && (
            <Link href={`/country/${country}`} className="font-medium text-accent hover:underline">
              <T en="Country dashboard: trends, map and hazard records" bn="দেশের ড্যাশবোর্ড: প্রবণতা, মানচিত্র ও দুর্যোগের রেকর্ড" />
            </Link>
          )}
          {loc.sourceId !== loc.id && (
            <Link href={`/location/${loc.sourceId}`} className="font-medium text-accent hover:underline">
              <T en={`Report for ${loc.geography.sourceNameEn}`} bn={`${loc.geography.sourceNameBn}-এর প্রতিবেদন`} />
            </Link>
          )}
          <Link href="/methods#intelligence" className="font-medium text-accent hover:underline">
            <T en="How the classes and alerts are defined" bn="শ্রেণি ও সতর্কতা কীভাবে নির্ধারিত" />
          </Link>
        </div>
      </Section>
    </div>
  );
}
