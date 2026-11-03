import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/lib/i18n";
import { readPlaces, readPlaceExtras, readSources as readSignalsSources } from "@/lib/signals/data";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Evidence · Earth's Hidden Signals",
  description:
    "Past years' rain for one place, with flood years from the GDACS catalogue marked and gaps left visible. A different product from our IMERG signal. Historical record, never a forecast or an official warning.",
};

const DEFAULT_PLACE = "pak-adm1-punjab";
const WMO = "https://severeweather.wmo.int/";

export default async function EvidencePage({ searchParams }: PageProps<"/signals/evidence">) {
  const params = await searchParams;
  const requested = typeof params.id === "string" ? params.id : null;
  const places = await readPlaces();
  const byId = new Map(places.areas.map((area) => [area.id, area]));
  const area = (requested && byId.get(requested)) ?? byId.get(DEFAULT_PLACE) ?? places.areas[0] ?? null;
  if (!area) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink">No place record yet</h1>
        <p className="mt-2 text-sm text-ink-2">Run place.py to create one from the committed files.</p>
      </main>
    );
  }
  const extras = await readPlaceExtras(area.id);
  const sources = await readSignalsSources().catch(() => null);
  const cadence = (sources?.["outlook-open-meteo"] as { cadence?: string } | undefined)?.cadence;
  const evidence = extras?.evidence ?? null;
  const years = evidence?.years ?? [];
  const max = Math.max(1, ...years.map((year) => year.mm ?? 0));
  const floodYears = new Set(evidence?.floodYears ?? []);
  // The catalogue lists every flood in the tiles, so most are far from this place. Only events
  // inside the place's own tile within its years are "here"; the page says how many were left.
  const localEvents = (evidence?.floodEvents ?? []).filter((event) => event.tile === area.tile);
  const otherEvents = (evidence?.floodEvents ?? []).length - localEvents.length;
  const gaps = years.filter((year) => year.mm === null);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-3">
        <Link href="/signals" className="underline decoration-line underline-offset-2 hover:text-ink">
          Signals
        </Link>
        <span aria-hidden> / </span>
        <Link href={`/signals/place?id=${encodeURIComponent(area.id)}`} className="underline decoration-line underline-offset-2 hover:text-ink">
          {area.name}
        </Link>
      </nav>

      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        <T en="Evidence" bn="প্রমাণ" />
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        <T
          en={`Past years' rain at ${area.name} (${area.countryName}), with flood years from the flood catalogue marked. We show the gaps too: a missing year is a gap in the record, never a year without rain or floods.`}
          bn={`${area.name} (${area.countryName})-এ আগের বছরের বৃষ্টি, বন্যা-ক্যাটালগ থেকে বন্যাবছর চিহ্নিত। ফাঁকও দেখানো হয়: অনুপস্থিত বছর মানে রেকর্ডে ফাঁক, কখনো বৃষ্টি বা বন্যা-শূন্য বছর নয়।`}
        />
      </p>

      {!evidence ? (
        <p className="mt-4 rounded-xl border border-line bg-card p-4 text-sm text-ink-2">
          <T
            en="The evidence file for this place is not built yet. Run place.py --refresh while the archive is reachable; without it we show nothing rather than substitute."
            bn="এই জায়গার প্রমাণ-ফাইল এখনো তৈরি হয়নি। আর্কাইভ পাওয়া গেলে place.py --refresh চালান; এটি ছাড়া অন্য কিছু বদলে দেখাই না।"
          />
        </p>
      ) : years.length === 0 ? (
        <p className="mt-4 rounded-xl border border-line bg-card p-4 text-sm text-ink-2">
          <T en="The archive returned no usable years for this point." bn="এই বিন্দুর জন্য আর্কাইভ কোনো ব্যবহারযোগ্য বছর দেয়নি।" />
        </p>
      ) : (
        <>
          <figure className="mt-4 rounded-2xl border border-line bg-card p-4">
            <figcaption className="text-xs text-ink-3">
              <T en="Rain per year, archive product" bn="বছরপ্রতি বৃষ্টি, আর্কাইভ পণ্য" /> · {evidence.product}
            </figcaption>
            <ul className="mt-3 space-y-1" aria-label="Rain per year">
              {years.map((year) => {
                const flood = floodYears.has(year.year);
                return (
                  <li key={year.year} className="flex items-center gap-2 text-xs">
                    <span className="w-10 shrink-0 tabular-nums text-ink-2">{year.year}</span>
                    <span className="relative h-4 flex-1 rounded bg-sunken" aria-hidden>
                      {year.mm !== null && (
                        <span
                          className={`absolute inset-y-0 left-0 rounded ${flood ? "bg-alert" : "bg-accent"}`}
                          style={{ width: `${Math.max(2, Math.round((year.mm / max) * 100))}%` }}
                        />
                      )}
                    </span>
                    <span className="w-20 shrink-0 text-right tabular-nums text-ink-2">
                      {year.mm === null ? <T en="gap" bn="ফাঁক" /> : `${Math.round(year.mm)} mm`}
                    </span>
                    <span className="w-16 shrink-0">
                      {flood && (
                        <span className="rounded-full bg-alert-soft px-2 py-0.5 text-[11px] font-medium text-alert">
                          <T en="flood" bn="বন্যা" />
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-accent" />
                <T en="rain year" bn="বৃষ্টির বছর" />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-alert" />
                <T en="flood year in the catalogue" bn="ক্যাটালগে বন্যাবছর" />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-6 rounded-sm border border-dashed border-ink-3" />
                <T en="gap in the record" bn="রেকর্ডে ফাঁক" />
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-3">{evidence.note}</p>
            {gaps.length > 0 && (
              <p className="mt-1 text-xs text-ink-3">
                <T en="Gap years" bn="ফাঁকের বছর" />:{" "}
                <span className="tabular-nums">{gaps.map((year) => year.year).join(", ")}</span>
              </p>
            )}
          </figure>

          <section aria-labelledby="flood-events" className="mt-4 rounded-2xl border border-line bg-card p-4">
            <h2 id="flood-events" className="text-base font-semibold text-ink">
              <T en={`Flood events in the catalogue (${area.tileLabel})`} bn={`ক্যাটালগে বন্যা-ঘটনা (${area.tileLabel})`} />
            </h2>
            {localEvents.length === 0 ? (
              <p className="mt-1 text-sm text-ink-2">
                <T en="No catalogued flood event falls in these years for the covered tiles." bn="আচ্ছাদিত টাইলে এই বছরে কোনো ক্যাটালগভুক্ত বন্যা-ঘটনা নেই।" />
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-ink-2">
                {localEvents.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center gap-x-2">
                    <time dateTime={event.start} className="tabular-nums">
                      {event.start}
                    </time>
                    <span className="tabular-nums text-ink-3">
                      {event.lat.toFixed(2)}, {event.lon.toFixed(2)}
                    </span>
                    <a
                      href={`https://www.gdacs.org/report.aspx?eventtype=FL&eventid=${event.id.split("-")[1] ?? ""}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-line underline-offset-2 hover:text-ink"
                    >
                      GDACS
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-3">
              {evidence.floodNote}
              {otherEvents > 0 && (
                <>
                  {" "}
                  <T
                    en={`${otherEvents} more catalogued floods fall in the other covered tiles in these years; they are not near this place.`}
                    bn={`এই বছরগুলোতে আরও ${otherEvents}টি ক্যাটালগভুক্ত বন্যা অন্য আচ্ছাদিত টাইলে পড়ে; সেগুলো এই জায়গার কাছে নয়।`}
                  />
                </>
              )}
            </p>
          </section>
        </>
      )}

      <section className="mt-4 rounded-2xl border border-sunken bg-sunken p-4 text-sm text-ink-2">
        <h2 className="text-base font-semibold text-ink">
          <T en="What this is not" bn="এটি যা নয়" />
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <T
              en="Not our signal and not a forecast: the years are a different rain product from the IMERG signal on the place page."
              bn="আমাদের সংকেত নয়, পূর্বাভাসও নয়: বছরগুলো জায়গার পাতার IMERG সংকেত থেকে আলাদা একটি বৃষ্টি-পণ্য।"
            />
          </li>
          <li>
            <T
              en="Not a warning: for a live alert, follow the official authority for your area."
              bn="সতর্কবার্তা নয়: সরাসরি সতর্কবার্তার জন্য আপনার এলাকার সরকারি কর্তৃপক্ষ অনুসরণ করুন।"
            />
          </li>
          <li>
            <T
              en={cadence ?? "The archive is updated by its provider; we refresh it when the place build runs with --refresh."}
              bn="আর্কাইভ এর সরবরাহকারী হালনাগাদ করে; জায়গা-বিল্ড --refresh সহ চালালে আমরা এটি হালনাগাদ করি।"
            />
          </li>
        </ul>
        <a
          href={WMO}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm underline decoration-line underline-offset-2 hover:text-ink"
        >
          <T en="Official warnings (WMO SWIC)" bn="সরকারি সতর্কবার্তা (WMO SWIC)" />
        </a>
      </section>
    </main>
  );
}
