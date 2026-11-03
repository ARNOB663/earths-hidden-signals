import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/lib/i18n";
import { ageOf } from "@/lib/signals/age";
import { readSignalsConfig, readSignalsMeta, readTop } from "@/lib/signals/data";
import type { Status } from "@/lib/signals/types";
import { PlaceSearch } from "@/components/signals/PlaceSearch";
import { SignalsList } from "@/components/signals/SignalsList";
import { SignalsMap } from "@/components/signals/SignalsMap";
import { UseMyLocation } from "@/components/signals/UseMyLocation";
import { DataProvenance, NotCovered, SampleBanner } from "@/components/signals/parts";

export const revalidate = 86400;

/** Strongest first: a tile's colour is the strongest status any of its listed cells carries. */
const BEST_STATUS: Status[] = ["red", "yellow"];

export const metadata: Metadata = {
  title: "Signals · Earth's Hidden Signals",
  description:
    "Is today's rain unusual for this time of year? Rain measured by NASA satellites, with the reason, the past years to compare, and a link to official warnings. Not a forecast.",
};

export default async function SignalsPage() {
  const [meta, config, top] = await Promise.all([readSignalsMeta(), readSignalsConfig(), readTop()]);
  const age = ageOf(meta.measurementTime, new Date(meta.generatedAt), config.staleHours, meta.sampleData);
  // The top list only carries Red and Yellow rows, so a tile absent from it is Green: its grid
  // holds no unusual signal. A stale build paints every tile Grey.
  const tileStatus = Object.fromEntries(
    config.enabledTiles.map((tile) => {
      const rows = top.rows.filter((row) => row.tile === tile.id);
      const best = BEST_STATUS.find((status) => rows.some((row) => row.status === status));
      return [tile.id, age.stale ? "grey" : (best ?? "green")];
    }),
  ) as Record<string, Status>;

  // Tiles with an enabled region but no grid file are genuinely "not yet covered"; the three
  // launch tiles are listed under "Strongest signals now" and are never shown as uncovered.
  const covered = new Set(meta.tiles);
  const notCovered = config.enabledTiles.filter((tile) => !covered.has(tile.id)).map((tile) => tile.label);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      {meta.sampleData && <SampleBanner clock={meta.clock} />}
      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <T en="Signals" bn="সংকেত" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          <T
            en="Is today's rain unusual for this time of year? Measured by NASA satellites. This is a preparedness signal, not a forecast."
            bn="এই মৌসুমে আজকের বৃষ্টি কি অস্বাভাবিক? নাসার স্যাটেলাইট থেকে মাপা। এটি প্রস্তুতির সংকেত, পূর্বাভাস নয়।"
          />
        </p>
      </header>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <PlaceSearch />
        <UseMyLocation />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="min-w-0">
          <SignalsMap config={config} tileStatus={tileStatus} />
          {notCovered.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-ink-3">
                <T en="Not yet covered" bn="এখনো অন্তর্ভুক্ত নয়" />
              </p>
              {notCovered.map((label) => (
                <NotCovered key={label} label={label} />
              ))}
            </div>
          )}
        </div>
        <SignalsList rows={top.rows} />
      </div>

      <div className="mt-6 space-y-3">
        <DataProvenance
          source={meta.sampleData ? "IMERG Late (sample)" : `IMERG ${meta.product}`}
          measurementTime={meta.measurementTime}
          ageLabel={age.label}
          ageStale={age.stale}
          wmoUrl={config.official.wmo}
          disclaimer={config.official.line}
        />
        <p className="flex flex-wrap gap-x-3 text-sm text-ink-2">
          <Link href="/accuracy" className="underline decoration-line underline-offset-2 hover:text-ink">
            <T en="How well does this work? See the accuracy page" bn="এটি কতটা কাজে লাগে? নির্ভুলতার পাতা দেখুন" />
          </Link>
          <Link href="/signals/evidence" className="underline decoration-line underline-offset-2 hover:text-ink">
            <T en="Evidence and checks" bn="প্রমাণ ও যাচাই" />
          </Link>
          <Link href="/about" className="underline decoration-line underline-offset-2 hover:text-ink">
            <T en="About the signals" bn="সংকেত সম্পর্কে" />
          </Link>
        </p>
        <p className="text-xs text-ink-3">
          <T
            en="Grey means no usable data for that area, not that the area is safe. Coverage grows tile by tile."
            bn="ধূসর মানে ওই এলাকার ব্যবহারযোগ্য তথ্য নেই, এলাকাটি নিরাপদ নয়। আচ্ছাদন ধীরে ধীরে বাড়ছে।"
          />
        </p>
      </div>
    </main>
  );
}
