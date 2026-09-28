import type { Metadata } from "next";
import Link from "next/link";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { PLACES } from "@/lib/places";

export const metadata: Metadata = {
  title: "Find a place · Earth's Hidden Signals",
  description: "Climate trends and nearby disasters for cities across South Asia.",
};

export default function PlacesPage() {
  const countries = [...new Set(PLACES.map((p) => p.country))];
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-12 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Find a place</h1>
      <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-ink-2">
        Pick a city to see how its temperature and rain have changed since 1981, and which disasters happen nearby.
      </p>
      <div className="mt-8">
        <PlaceSearch large />
      </div>

      <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => (
          <section key={c}>
            <h2 className="font-semibold text-ink">{c}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {PLACES.filter((p) => p.country === c).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/places/${p.id}`}
                    className="inline-block rounded-full bg-card px-3.5 py-1.5 text-sm text-ink-2 shadow-soft transition-colors hover:text-accent"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
