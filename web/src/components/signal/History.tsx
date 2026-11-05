// The area's own historical case set: annual rain per year, the catalogued floods marked, and the
// frequency table at every level. Drawn from the committed frequency file; a year without a value
// is drawn as a gap, never as zero.

import { T } from "@/lib/i18n";
import type { SignalRow } from "@/lib/signals/model";
import { FREQUENCY_UNKNOWN } from "@/lib/signals/level";

export function SignalLevelHistory({ row }: { row: SignalRow }) {
  const freq = row.frequency;
  if (freq.state !== "ok" || freq.cases.length === 0) {
    return (
      <section aria-labelledby="history" className="mt-6 rounded-2xl border border-line bg-card p-4">
        <h2 id="history" className="text-base font-semibold text-ink">
          <T en="Historical record" bn="ঐতিহাসিক রেকর্ড" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T en={FREQUENCY_UNKNOWN.en} bn={FREQUENCY_UNKNOWN.bn} />
        </p>
        <p className="mt-1 text-xs text-ink-3">{freq.reason}</p>
      </section>
    );
  }
  const cases = freq.cases;
  const max = Math.max(...cases.map((entry) => entry.mm), 1);
  const floodYears = new Set(cases.filter((entry) => entry.flood).map((entry) => entry.year));
  const minY = Math.min(...cases.map((entry) => entry.year));
  const maxY = Math.max(...cases.map((entry) => entry.year));
  const levels = freq.floodsAtLeast.filter((level) => level.cases >= freq.minCases).slice(0, 8);

  return (
    <section aria-labelledby="history" className="mt-6 rounded-2xl border border-line bg-card p-4">
      <h2 id="history" className="text-base font-semibold text-ink">
        <T en="Historical record" bn="ঐতিহাসিক রেকর্ড" />
      </h2>
      <p className="mt-1 text-xs text-ink-2">
        <T
          en={`${freq.counts.cases} complete years from the historical rain archive (${freq.product ?? "external reanalysis"}), with the floods GDACS catalogued within ${freq.radiusKm} km. Marked bars are years with a catalogued flood. A missing year is a gap in the record, not a year without rain.`}
          bn={`ঐতিহাসিক বৃষ্টি-আর্কাইভ থেকে ${freq.counts.cases}টি সম্পূর্ণ বছর (${freq.product ?? "বহিরাগত রি-অ্যানালাইসিস"}), সাথে ${freq.radiusKm} কিমি মধ্যে GDACS-নথিভুক্ত বন্যা। চিহ্নিত বার মানে সেই বছরে নথিভুক্ত বন্যা আছে। অনুপস্থিত বছর রেকর্ডের ফাঁক, বৃষ্টিহীন বছর নয়।`}
        />
      </p>

      <figure className="mt-3">
        <figcaption className="sr-only">
          <T en="Annual rain by year, catalogued flood years marked" bn="বছর অনুযায়ী বার্ষিক বৃষ্টি, নথিভুক্ত বন্যার বছর চিহ্নিত" />
        </figcaption>
        <div className="flex h-40 items-end gap-1" role="img" aria-label={`Annual rain, ${minY}-${maxY}; ${floodYears.size} years with a catalogued flood`}>
          {Array.from({ length: maxY - minY + 1 }, (_, index) => {
            const year = minY + index;
            const entry = cases.find((c) => c.year === year);
            const height = entry ? Math.max(2, (entry.mm / max) * 100) : 0;
            return (
              <div key={year} className="flex h-full flex-1 flex-col justify-end" title={entry ? `${year}: ${entry.mm} mm${entry.flood ? " · flood catalogued" : ""}` : `${year}: no value`}>
                {entry ? (
                  <div
                    className={`w-full rounded-t-sm ${floodYears.has(year) ? "bg-alert" : "bg-ink-3/50"}`}
                    style={{ height: `${height}%` }}
                  />
                ) : (
                  <div className="w-full border-b border-dashed border-ink-3" aria-hidden />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-ink-3">
          <span>{minY}</span>
          <span>{maxY}</span>
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-alert" />
            <T en="flood catalogued" bn="বন্যা নথিভুক্ত" />
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-ink-3/50" />
            <T en="no catalogued flood" bn="নথিভুক্ত বন্যা নেই" />
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="w-3 border-b border-dashed border-ink-3" />
            <T en="no value" bn="কোনো মান নেই" />
          </li>
        </ul>
      </figure>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[460px] text-left text-sm">
          <caption className="mb-2 text-left text-xs text-ink-3">
            <T
              en={`Flood frequency and its 95% interval per rainfall level, shown where the sample reaches ${freq.minCases} cases. Each row is "at least this much annual rain".`}
              bn={`প্রতিটি বৃষ্টির মাত্রায় বন্যা-ফ্রিকোয়েন্সি ও তার ৯৫% ব্যবধান, যেখানে নমুনা ${freq.minCases} ক্ষেত্রে পৌঁছায়। প্রতিটি সারি মানে “বছরে অন্তত এত বৃষ্টি”।`}
            />
          </caption>
          <thead>
            <tr className="text-xs text-ink-3">
              <th scope="col" className="py-1 font-medium"><T en="Rain level" bn="বৃষ্টির মাত্রা" /></th>
              <th scope="col" className="py-1 text-right font-medium"><T en="Flood cases" bn="বন্যার ক্ষেত্র" /></th>
              <th scope="col" className="py-1 text-right font-medium"><T en="Frequency" bn="ফ্রিকোয়েন্সি" /></th>
              <th scope="col" className="py-1 text-right font-medium"><T en="95% interval" bn="৯৫% ব্যবধান" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {levels.map((level) => (
              <tr key={level.mm}>
                <th scope="row" className="py-1.5 font-normal tabular-nums text-ink">
                  {level.mm.toFixed(0)} mm
                </th>
                <td className="py-1.5 text-right tabular-nums text-ink-2">
                  {level.floods} of {level.cases}
                </td>
                <td className="py-1.5 text-right tabular-nums text-ink">{(level.low * 100).toFixed(0)}–{(level.high * 100).toFixed(0)}%</td>
                <td className="py-1.5 text-right tabular-nums text-ink-3">
                  {((level.floods / level.cases) * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        <T
          en="A historical frequency, not a forecast probability. The interval is a Wilson score interval on the observed count; the catalogue is incomplete, so a missing flood record is not a flood-free year."
          bn="ঐতিহাসিক ফ্রিকোয়েন্সি, পূর্বাভাসের সম্ভাবনা নয়। ব্যবধানটি পর্যবেক্ষিত সংখ্যার উপর উইলসন স্কোর ব্যবধান; ক্যাটালগ অসম্পূর্ণ, তাই অনুপস্থিত বন্যা-রেকর্ড মানে বন্যামুক্ত বছর নয়।"
        />
      </p>
    </section>
  );
}
