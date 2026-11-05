import type { Metadata } from "next";
import Link from "next/link";
import { ageOf } from "@/lib/signals/age";
import { readPlaces, readPlaceExtras, readSignalsConfig, readSignalsMeta } from "@/lib/signals/data";
import { DataProvenance, SampleBanner } from "@/components/signals/parts";
import { PlaceView, PlacePicker } from "@/components/signals/PlaceView";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Place signal · Earth's Hidden Signals",
  description:
    "Before, Now, Next, Trust and Action for one district: 45 years of NASA history, today's rain against its date, an external 7-day outlook, and whether the place can be warned at all. Not a forecast or an official warning.",
};

// A place with a readable record today, including a built extras file. The old default
// (pak-adm1-punjab) had no extras, so the Next strip and the picker's first hit showed empty.
const DEFAULT_PLACE = "bgd-adm1-dhaka";

export default async function PlacePage({ searchParams }: PageProps<"/signals/place">) {
  const params = await searchParams;
  const requested = typeof params.id === "string" ? params.id : null;
  const [places, meta, config] = await Promise.all([readPlaces(), readSignalsMeta(), readSignalsConfig()]);
  const byId = new Map(places.areas.map((area) => [area.id, area]));
  const area = (requested && byId.get(requested)) ?? byId.get(DEFAULT_PLACE) ?? places.areas[0] ?? null;
  if (!area) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink">No place record yet</h1>
        <p className="mt-2 text-sm text-ink-2">Run place.py to create one from the committed files.</p>
      </main>
    );
  }
  const extras = await readPlaceExtras(area.id);
  const age = ageOf(meta.measurementTime, new Date(meta.generatedAt), config.staleHours, meta.sampleData);
  const picker = places.areas.map((item) => ({
    id: item.id,
    name: item.name,
    country: item.country,
    countryName: item.countryName,
    level: item.level,
    centre: item.centre,
    tileLabel: item.tileLabel,
    trust: item.trust.state,
    nowState: item.now.state,
  }));
  const notFound = Boolean(requested && !byId.get(requested));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      {meta.sampleData && <SampleBanner clock={meta.clock} />}

      <nav aria-label="Breadcrumb" className="mt-3 text-xs text-ink-3">
        <Link href="/signals" className="underline decoration-line underline-offset-2 hover:text-ink">
          Signals
        </Link>
        <span aria-hidden> / </span>
        <span>{area.countryName}</span>
      </nav>

      <header className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{area.name}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {area.countryName} · {area.level} · {area.tileLabel} ·{" "}
            <span className="tabular-nums">
              {area.centre[0].toFixed(2)}, {area.centre[1].toFixed(2)}
            </span>
          </p>
        </div>
        <PlacePicker places={picker} currentId={area.id} />
      </header>

      {notFound && (
        <p className="mt-3 rounded-xl border border-line bg-sunken p-3 text-sm text-ink-2" role="status">
          That place is not in the covered set. Showing the first covered place instead.
        </p>
      )}

      <PlaceView area={area} extras={extras} config={config} />

      <nav aria-label="More" className="mt-5 flex flex-wrap gap-3 text-sm">
        <Link
          href={`/signals/evidence?id=${encodeURIComponent(area.id)}`}
          className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-ink-2 hover:text-ink"
        >
          Past years&apos; rain (evidence)
        </Link>
        <Link
          href="/accuracy"
          className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-ink-2 hover:text-ink"
        >
          Where the signal can be checked
        </Link>
        <Link
          href="/signals"
          className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-ink-2 hover:text-ink"
        >
          All signals
        </Link>
      </nav>

      <div className="mt-4">
        <DataProvenance
          source={
            meta.sampleData
              ? "IMERG Late (sample) for Now · NASA GISTEMP / GPCP for Before"
              : `IMERG ${meta.product} for Now · NASA GISTEMP / GPCP for Before`
          }
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
