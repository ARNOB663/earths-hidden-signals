import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/lib/i18n";
import { ageOf } from "@/lib/signals/age";
import { readPlaces, readSignalsConfig, readSignalsMeta, readWatch } from "@/lib/signals/data";
import { DataProvenance, SampleBanner, StatusBadge } from "@/components/signals/parts";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "What to watch · Earth's Hidden Signals",
  description:
    "Areas where the rain signal rose since the previous snapshot, named where our data covers them. Compared with the previous archive entry only, never with a live forecast. Not an official warning.",
};

export default async function WatchPage() {
  const [watch, meta, config, places] = await Promise.all([
    readWatch(),
    readSignalsMeta(),
    readSignalsConfig(),
    readPlaces(),
  ]);
  const age = ageOf(meta.measurementTime, new Date(meta.generatedAt), config.staleHours, meta.sampleData);

  // A rise is named only when a covered area's boundary contains it; otherwise the tile is all
  // we know, and the page says so rather than inventing a place.
  const areas = places.areas;
  const areaAt = (lat: number, lon: number) => {
    let best: (typeof areas)[number] | null = null;
    let bestArea = Infinity;
    for (const area of areas) {
      const [alat, alon] = area.centre;
      // Cheap pre-check on the centroid, then the boundary's own distance.
      if (Math.abs(alat - lat) > 2.5 || Math.abs(alon - lon) > 2.5) continue;
      const d = (alat - lat) ** 2 + (alon - lon) ** 2;
      if (d < bestArea) {
        best = area;
        bestArea = d;
      }
    }
    return best;
  };

  // Rises come from the archive only; the label is the tile each rise falls in.
  const inside = (rise: { lat: number; lon: number }, tile: (typeof config.enabledTiles)[number]) =>
    rise.lat >= tile.south && rise.lat < tile.north && rise.lon >= tile.west && rise.lon < tile.east;
  const labels: Record<string, string> = {};
  for (const rise of watch.rises) {
    const tile = config.enabledTiles.find((candidate) => inside(rise, candidate));
    if (tile) labels[`${rise.lat},${rise.lon}`] = tile.label;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      {meta.sampleData && <SampleBanner clock={meta.clock} />}
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        <T en="What to watch" bn="কী দেখবেন" />
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        <T
          en="Places where the rain signal rose since the previous snapshot. We compare with our own previous reading, never with a forecast."
          bn="আগের স্ন্যাপশটের পর যেখানে বৃষ্টির সংকেত বেড়েছে। আমরা শুধু আমাদের আগের পাঠের সাথে তুলনা করি, পূর্বাভাসের সাথে নয়।"
        />
      </p>

      <section aria-labelledby="rises" className="mt-5">
        <h2 id="rises" className="text-base font-semibold text-ink">
          <T en="Rises since the previous snapshot" bn="আগের স্ন্যাপশটের পর বৃদ্ধি" />
        </h2>
        <p className="mt-1 text-xs text-ink-3">
          {watch.latest ? (
            <>
              <T en="Latest snapshot" bn="সর্বশেষ স্ন্যাপশট" />: <time dateTime={watch.latest}>{watch.latest}</time>
              {watch.previous ? (
                <>
                  {" · "}
                  <T en="Previous" bn="আগের" />: <time dateTime={watch.previous}>{watch.previous}</time>
                </>
              ) : null}
            </>
          ) : (
            <T en="No snapshot stored yet." bn="এখনো কোনো স্ন্যাপশট সংরক্ষিত নেই।" />
          )}
        </p>

        {watch.rises.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-sunken p-4 text-sm text-ink-2">
            <T en="No rise recorded yet." bn="এখনো কোনো বৃদ্ধি নথিভুক্ত হয়নি।" />
            {watch.entries < 2 && (
              <>
                {" "}
                <T
                  en="There is one snapshot so far; a rise needs two to compare."
                  bn="এখন পর্যন্ত একটি স্ন্যাপশট আছে; বৃদ্ধি দেখতে দুটি লাগে।"
                />
              </>
            )}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {watch.rises.map((rise) => (
              <li key={`${rise.lat},${rise.lon}`} className="rounded-xl border border-line bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {(() => {
                    const area = areaAt(rise.lat, rise.lon);
                    return area ? (
                      <Link
                        href={`/signals/place?id=${encodeURIComponent(area.id)}`}
                        className="text-sm font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
                      >
                        {area.name}, {area.countryName}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-ink-2">
                        <T en="No named area at this cell" bn="এই কোষে নামযুক্ত এলাকা নেই" />
                      </span>
                    );
                  })()}
                  <StatusBadge status={rise.status} />
                </div>
                <p className="mt-1 text-xs text-ink-3">
                  {(() => {
                    const area = areaAt(rise.lat, rise.lon);
                    return area ? (
                      <>
                        {area.now.cells[0] && <T en={area.now.cells[0].reasonText} bn={area.now.cells[0].reasonTextBn ?? area.now.cells[0].reasonText} />}
                        {" · "}
                      </>
                    ) : (
                      <>
                        {labels[`${rise.lat},${rise.lon}`] ?? ""} · {rise.lat.toFixed(2)}, {rise.lon.toFixed(2)} ·{" "}
                      </>
                    );
                    return <T en="was" bn="আগে ছিল" />;
                  })()}{" "}
                  <StatusBadge status={rise.from} />
                </p>
                {(() => {
                  const area = areaAt(rise.lat, rise.lon);
                  return area ? (
                    <p className="mt-1 text-xs text-ink-3">
                      <T en={`Trust here: ${area.trust.label}.`} bn={`এখানে ভরসা: ${area.trust.state === "detectable" ? "শনাক্তযোগ্য" : area.trust.state === "blind-spot" ? "অন্ধ স্থান" : "তথ্য নেই"}।`} />{" "}
                      {area.trust.state === "blind-spot" && (
                        <T
                          en="Today's rain is real; a rise here cannot yet be told apart from noise."
                          bn="আজকের বৃষ্টি বাস্তব; এখানকার বৃদ্ধি এখনো কোলাহল থেকে আলাদা করা যায় না।"
                        />
                      )}{" "}
                      <Link href={`/signals/place?id=${encodeURIComponent(area.id)}`} className="underline decoration-line underline-offset-2 hover:text-ink">
                        <T en="Open the place" bn="জায়গাটি খুলুন" />
                      </Link>
                    </p>
                  ) : null;
                })()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="outlook" className="mt-5 rounded-2xl border border-line bg-card p-4">
        <h2 id="outlook" className="text-base font-semibold text-ink">
          <T en={`${config.outlook.days}-day outlook`} bn={`${config.outlook.days} দিনের পরিপ্রেক্ষিত`} />
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          <T
            en="Outlook is off in sample mode. On the place page it comes from an external public source and is labelled as such."
            bn="নমুনা মোডে পরিপ্রেক্ষিত বন্ধ। জায়গার পাতায় এটি একটি বহিরাগত সর্বজনীন উৎস থেকে আসে এবং সেটি স্পষ্টভাবে লেখা থাকে।"
          />
        </p>
        <p className="mt-1 text-xs text-ink-3">{config.outlook.label}</p>
        <a
          href={config.official.wmo}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm underline decoration-line underline-offset-2 hover:text-ink"
        >
          <T en="Official warnings (WMO SWIC)" bn="সরকারি সতর্কবার্তা (WMO SWIC)" />
        </a>
      </section>

      <div className="mt-4">
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
