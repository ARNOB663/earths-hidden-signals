import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { T } from "@/lib/i18n";
import { ShareButton } from "@/components/ui/ShareButton";
import { ageOf } from "@/lib/signals/age";
import { nearestCell, readSignalsConfig, readSignalsMeta, readTileGrid, tileForPoint } from "@/lib/signals/data";
import type { SignalCell } from "@/lib/signals/types";
import { WhyBox } from "@/components/signals/WhyBox";
import { Checklist } from "@/components/signals/Checklist";
import { ConfidenceLabel, DataProvenance, SampleBanner, StatusBadge } from "@/components/signals/parts";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Place signal · Earth's Hidden Signals",
  description: "Today's NASA-measured rain for one place, compared with the same season in past years.",
};

function parseCoord(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

export default async function PlacePage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lon?: string }>;
}) {
  const params = await searchParams;
  const lat = parseCoord(params.lat);
  const lon = parseCoord(params.lon);
  const [meta, config] = await Promise.all([readSignalsMeta(), readSignalsConfig()]);

  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink">
          <T en="No place given" bn="কোনো জায়গা দেওয়া হয়নি" />
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          <T en="Open the map and tap a place, or search for one." bn="মানচিত্র খুলে জায়গায় চাপ দিন, বা নাম খুঁজুন।" />
        </p>
        <Link href="/signals" className="mt-4 inline-flex min-h-11 items-center gap-1 text-ink underline">
          <ChevronLeft size={16} aria-hidden /> <T en="Back to Signals" bn="সংকেতে ফিরুন" />
        </Link>
      </main>
    );
  }

  const tile = tileForPoint(config, lat, lon);
  const grid = tile ? await readTileGrid(tile.id) : null;
  const cell: SignalCell | null = grid ? nearestCell(grid, lat, lon) : null;
  const age = ageOf(meta.measurementTime, new Date(meta.generatedAt), config.staleHours, meta.sampleData);
  const status = age.stale ? "grey" : (cell?.status ?? "grey");
  const inCoverage = Math.abs(lat) <= config.maxAbsLat;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      {meta.sampleData && <SampleBanner clock={meta.clock} />}
      <Link href="/signals" className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> <T en="Signals" bn="সংকেত" />
      </Link>

      <header className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {tile ? tile.label : <T en="Not yet covered" bn="এখনো অন্তর্ভুক্ত নয়" />}
          </h1>
          <p className="mt-1 text-sm text-ink-3 tabular-nums">
            {lat.toFixed(3)}, {lon.toFixed(3)}
          </p>
        </div>
        <ShareButton variant="label" />
      </header>

      <section className="mt-4 rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge status={status} large />
          <span className="text-sm text-ink-3">
            {/* Grey (and a stale build) has no verdict to be confident about: show the reason. */}
            {cell && !age.stale && cell.status !== "grey" ? (
              <ConfidenceLabel confidence={cell.confidence} />
            ) : cell ? (
              cell.reasonText
            ) : (
              <T en="No reading" bn="কোনো পাঠ নেই" />
            )}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-2">
          {!inCoverage ? (
            <T en="Outside the area this tool covers." bn="এই যন্ত্রটি যে এলাকা কভার করে তার বাইরে।" />
          ) : age.stale ? (
            <T en="Data too old to describe today." bn="আজকের অবস্থা বলার জন্য তথ্য অনেক পুরোনো।" />
          ) : cell && cell.status === "green" ? (
            <T
              en="No unusual signal in our data. Always follow official warnings."
              bn="আমাদের তথ্যে অস্বাভাবিক কোনো সংকেত নেই। সর্বদা সরকারি সতর্কবার্তা মেনে চলুন।"
            />
          ) : (
            cell?.reasonText
          )}
        </p>
        {status === "red" && (
          <p className="mt-2 text-xs font-medium text-alert">
            <T en="Provisional: the backtest is still small." bn="প্রাথমিক: ব্যাকটেস্ট এখনো ছোট।" />
          </p>
        )}
      </section>

      {/* A stale reading was converted to Grey above; its numbers must not be shown as today's. */}
      {cell && !age.stale && (
        <WhyBox
          cell={cell}
          sampleData={meta.sampleData}
          lat={lat}
          lon={lon}
          percentileCutoffs={{ red: config.red.percentile, yellow: config.yellow.percentile }}
        />
      )}
      <Checklist status={status} />

      <div className="mt-4 space-y-3">
        <DataProvenance
          source={meta.sampleData ? "IMERG Late (sample)" : `IMERG ${meta.product}`}
          measurementTime={meta.measurementTime}
          ageLabel={age.label}
          ageStale={age.stale}
          wmoUrl={config.official.wmo}
          disclaimer={config.official.line}
        />
      </div>
    </main>
  );
}
