import type { Metadata } from "next";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Suspense } from "react";
import { CountrySearch } from "@/components/site/CountrySearch";
import { countriesFrom } from "@/lib/countries";
import { T } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Countries · Earth's Hidden Signals",
  description: "Country dashboards for South Asia: observed climate trends, hazard records and NASA satellite layers.",
};

async function loadCountries() {
  const data = JSON.parse(await readFile(path.join(process.cwd(), "public/data/maps/place-signals.json"), "utf-8"));
  return countriesFrom(data);
}

export default async function CountriesPage() {
  const countries = await loadCountries();
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-12 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        <T en="Countries" bn="দেশ" />
      </h1>
      <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-ink-2">
        <T
          en="Each dashboard uses this project's own gridded results and event records. Countries appear here only when the datasets cover them; the study area is the South Asia box (5–38°N, 60–100°E)."
          bn="প্রতিটি ড্যাশবোর্ডে এই প্রকল্পের নিজস্ব গ্রিড ফলাফল ও ঘটনার তথ্য আছে। যে দেশের তথ্য আছে কেবল সেগুলোই এখানে।"
        />
      </p>
      <div className="mt-8 max-w-xl">
        <Suspense>
          <CountrySearch countries={countries.map(({ slug, name, nameBn, flag }) => ({ slug, name, nameBn, flag }))} large />
        </Suspense>
      </div>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => {
          const t = c.signals["temperature_annual"]?.trend;
          return (
            <li key={c.slug}>
              <Link
                href={`/country/${c.slug}`}
                className="group flex h-full items-start gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink-3"
              >
                {c.flag && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://flagcdn.com/w80/${c.flag}.png`} alt="" width={36} height={27} className="rounded-sm border border-line object-cover" />
                )}
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">
                    <T en={c.name} bn={c.nameBn} />
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-3">
                    {t ? (
                      <T
                        en={`${t.p < 0.05 ? "Warming" : "No clear trend"} · ${(t.slopePerDecade).toFixed(2)} °C/decade`}
                        bn={`${t.p < 0.05 ? "উষ্ণায়ন" : "স্পষ্ট প্রবণতা নেই"} · ${t.slopePerDecade.toFixed(2)} °সে/দশক`}
                      />
                    ) : (
                      <T en="Temperature not available" bn="তাপমাত্রা নেই" />
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-10 rounded-xl border border-line bg-sunken p-4 text-sm text-ink-3">
        <T
          en="Not found what you typed? Only countries inside the study area are analysed here. City-level reports remain available from the map pages."
          bn="যা লিখেছেন তা পাননি? এখানে কেবল গবেষণা এলাকার দেশগুলো বিশ্লেষণ করা হয়।"
        />
      </p>
    </div>
  );
}
