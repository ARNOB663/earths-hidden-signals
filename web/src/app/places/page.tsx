import type { Metadata } from "next";
import Link from "next/link";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { T } from "@/lib/i18n";
import { COUNTRY_BN, PLACE_BN } from "@/lib/names";
import { PLACES } from "@/lib/places";

export const metadata: Metadata = {
  title: "Find a place · Earth's Hidden Signals",
  description: "Climate trends and nearby disasters for cities across South Asia.",
};

export default function PlacesPage() {
  const countries = [...new Set(PLACES.map((p) => p.country))];
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-12 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        <T en="Find a place" bn="জায়গা খুঁজুন" />
      </h1>
      <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-ink-2">
        <T
          en="Pick a city to see how its temperature and rain have changed since 1981, and which disasters happen nearby."
          bn="একটি শহর বেছে নিন: ১৯৮১ সাল থেকে সেখানকার তাপমাত্রা ও বৃষ্টি কীভাবে বদলেছে, আর আশপাশে কোন কোন দুর্যোগ ঘটে, দেখুন।"
        />
      </p>
      <div className="mt-8">
        <PlaceSearch large />
      </div>

      <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => (
          <section key={c}>
            <h2 className="font-semibold text-ink">
              <T en={c} bn={COUNTRY_BN[c] ?? c} />
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {PLACES.filter((p) => p.country === c).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/places/${p.id}`}
                    className="inline-block rounded-full bg-card px-3.5 py-1.5 text-sm text-ink-2 shadow-soft transition-colors hover:text-accent"
                  >
                    <T en={p.name} bn={PLACE_BN[p.id] ?? p.name} />
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
