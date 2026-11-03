// Provenance for the Signals page: every boundary file's licence, the NASA series the coverage is
// measured from, and the demo-score status. Everything is read from the committed JSON, so the page
// can never credit a source the data does not actually use.

import { ExternalLink } from "lucide-react";
import { T } from "@/lib/i18n";
import type { GeographyLicenseFile, SignalsSourcesFile } from "@/lib/geography/types";

function licenceSummary(files: GeographyLicenseFile["files"]) {
  const counts = new Map<string, number>();
  for (const file of files) {
    const key = file.license || "Not stated in source";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function Provenance({
  license,
  sources,
  layerCount,
}: {
  license: GeographyLicenseFile;
  sources: SignalsSourcesFile;
  layerCount: number;
}) {
  const summary = licenceSummary(license.files);

  return (
    <section aria-labelledby="provenance" className="mt-6">
      <h2 id="provenance" className="text-lg font-semibold text-ink">
        <T en="Data, licences and credits" bn="তথ্য, লাইসেন্স ও স্বীকৃতি" />
      </h2>

      <div className="mt-3 rounded-2xl border border-line bg-card p-4">
        <h3 className="text-sm font-semibold text-ink">
          <T en="NASA measurements (coverage)" bn="নাসা পরিমাপ (আচ্ছাদন)" />
        </h3>
        <p className="mt-1 text-xs text-ink-2">
          <T
            en={`Coverage is measured from ${layerCount} NASA series. These are public, openly available products; the page shows only whether an area has usable values, never a weather value of its own.`}
            bn={`আচ্ছাদন ${layerCount}টি নাসা সিরিজ থেকে মাপা হয়। এগুলো উন্মুক্ত, প্রকাশ্যে উপলভ্য পণ্য; পাতাটি কেবল দেখায় এলাকায় ব্যবহারযোগ্য মান আছে কি না, নিজে কোনো আবহাওয়ার মান দেখায় না।`}
          />
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {sources.data.map((entry) => (
            <li key={entry.variable} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-ink">{entry.name}</span>
              <span className="text-ink-2">{entry.dataset}</span>
              <span className="text-xs text-ink-3">{entry.use}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-card p-4">
        <h3 className="text-sm font-semibold text-ink">
          <T en="Boundaries (geoBoundaries gbOpen)" bn="সীমানা (geoBoundaries gbOpen)" />
        </h3>
        <p className="mt-1 text-xs text-ink-2">
          {sources.geography.use}{" "}
          <a
            href={sources.geography.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 underline decoration-line underline-offset-2 hover:text-ink"
          >
            geoboundaries.org
            <ExternalLink size={12} aria-hidden />
          </a>
        </p>
        <p className="mt-1 text-xs text-ink-3">{sources.geography.citation}</p>

        <p className="mt-3 text-xs text-ink-2">
          <T
            en={`${license.files.length} boundary files were loaded, under ${summary.length} different licences. Each file records its own licence, boundary ID and upstream source, so credit is per boundary rather than once for the whole map.`}
            bn={`${license.files.length}টি সীমানা ফাইল লোড হয়েছে, ${summary.length}টি ভিন্ন লাইসেন্সে। প্রতিটি ফাইল নিজের লাইসেন্স, সীমানা আইডি ও উৎস রেকর্ড করে, তাই স্বীকৃতি পুরো মানচিত্রের জন্য একবার নয়, প্রতিটি সীমানার জন্য।`}
          />
        </p>
        <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
          {summary.map(([name, count]) => (
            <li key={name} className="flex items-baseline justify-between gap-2 border-b border-line py-1">
              <span className="text-ink-2">{name}</span>
              <span className="shrink-0 tabular-nums text-ink-3">
                {count} {count === 1 ? "file" : "files"}
              </span>
            </li>
          ))}
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-ink-2 hover:text-ink">
            <T en="Boundary IDs per country" bn="দেশ অনুযায়ী সীমানা আইডি" />
          </summary>
          <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">
                <T en="Boundary file licences" bn="সীমানা ফাইলের লাইসেন্স" />
              </caption>
              <thead className="sticky top-0 bg-sunken text-ink-3">
                <tr>
                  <th scope="col" className="px-2 py-1 font-medium">
                    <T en="ISO" bn="আইএসও" />
                  </th>
                  <th scope="col" className="px-2 py-1 font-medium">
                    <T en="Level" bn="স্তর" />
                  </th>
                  <th scope="col" className="px-2 py-1 font-medium">
                    <T en="Licence" bn="লাইসেন্স" />
                  </th>
                  <th scope="col" className="px-2 py-1 font-medium">
                    <T en="Boundary ID" bn="সীমানা আইডি" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {license.files.map((file) => (
                  <tr key={`${file.iso}-${file.level}`} className="border-t border-line align-baseline">
                    <td className="px-2 py-1 text-ink">{file.iso}</td>
                    <td className="px-2 py-1 text-ink-2">{file.level}</td>
                    <td className="px-2 py-1 text-ink-2">{file.license}</td>
                    <td className="px-2 py-1 font-mono text-[11px] text-ink-3">{file.boundaryId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="mt-1 text-xs text-ink-3">{license.note}</p>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-card p-4">
        <h3 className="text-sm font-semibold text-ink">
          <T en="Scores (demo)" bn="স্কোর (ডেমো)" />
        </h3>
        <p className="mt-1 text-xs text-ink-2">
          <T
            en={`The percentages and model confidence on this page are fixed sample values in ${sources.demo.file} (${sources.demo.status}). ${sources.demo.replacedBy}`}
            bn={`এই পাতার শতাংশ ও মডেল আত্মবিশ্বাস ${sources.demo.file} ফাইলের নির্দিষ্ট নমুনা মান (${sources.demo.status})। ${sources.demo.replacedBy}`}
          />
        </p>
      </div>
    </section>
  );
}
