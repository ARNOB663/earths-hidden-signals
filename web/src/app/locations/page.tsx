import type { Metadata } from "next";
import { Suspense } from "react";
import { LocationsBrowser } from "@/components/intelligence/LocationsBrowser";
import { Disclaimer } from "@/components/intelligence/parts";
import { bnNum } from "@/lib/bn";
import { T } from "@/lib/i18n";
import { readIndex } from "@/lib/intelligence/data";

export const metadata: Metadata = {
  title: "Locations · Earth's Hidden Signals",
  description: "Climate screening reports for South Asian countries, research regions and cities, from NASA GISTEMP and GPCP observations.",
};

export const revalidate = 86400;

export default async function LocationsPage() {
  const entries = await readIndex();
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-12 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        <T en="Locations" bn="স্থান" />
      </h1>
      <p className="mt-4 max-w-[64ch] text-lg leading-relaxed text-ink-2">
        <T
          en={`${entries.length} locations: six countries, eight research regions, the whole study area and ${entries.filter((e) => e.kind === "city").length} cities. City reports are estimates from the region or country that contains them, and say so.`}
          bn={`${bnNum(entries.length)}টি স্থান: ছয়টি দেশ, আটটি গবেষণা অঞ্চল, পুরো গবেষণা এলাকা ও ${bnNum(entries.filter((e) => e.kind === "city").length)}টি শহর। শহরের প্রতিবেদন তার অঞ্চল বা দেশের অনুমান, এবং তা স্পষ্টভাবে বলা আছে।`}
        />
      </p>
      <div className="mt-5 max-w-3xl">
        <Disclaimer />
      </div>
      <div className="mt-8">
        {/* The browser reads its filters from the URL, which needs a Suspense boundary on a static page. */}
        <Suspense>
          <LocationsBrowser entries={entries} />
        </Suspense>
      </div>
    </div>
  );
}
