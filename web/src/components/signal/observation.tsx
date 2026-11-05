// One signal, as evidence: the seven fields every Signal must show, and the historical frequency
// with its sample size and interval. Shared by /signal (row detail) and /signal/[id].

import { T } from "@/lib/i18n";
import type { SignalRow } from "@/lib/signals/model";
import { ageWords } from "@/lib/signals/model";
import { CoverageBadge, TrustBadge, WatchBadge } from "./levels";

export function SignalEvidence({ row }: { row: SignalRow }) {
  const age = ageWords(row.daysOld);
  const level = row.frequency.level;
  const enough = level !== null && level.cases >= row.frequency.minCases;
  const cellsWithReading = row.cells.filter((cell) => cell.status !== "grey").length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <CoverageBadge state={row.coverage} />
        <WatchBadge level={row.watch} />
        <TrustBadge grade={row.trust} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <Field label={row.sample ? "Sample clock date" : "Observation date"} labelBn={row.sample ? "নমুনার ঘড়ির তারিখ" : "পর্যবেক্ষণের তারিখ"}>
          {row.observed ? (
            <>
              <time dateTime={row.observed}>{row.observed.slice(0, 10)}</time>
              <span className="block text-xs text-ink-3">
                {row.sample ? (
                  <T en="fixed sample date — not a live observation" bn="স্থির নমুনার তারিখ — বাস্তব পর্যবেক্ষণ নয়" />
                ) : (
                  <T en={age.en} bn={age.bn} />
                )}
              </span>
            </>
          ) : (
            <T en="None" bn="নেই" />
          )}
        </Field>
        <Field label="Data source" labelBn="তথ্যসূত্র">
          {row.sample ? (
            <T en="Sample (not a satellite retrieval)" bn="নমুনা (স্যাটেলাইট থেকে সংগৃহীত নয়)" />
          ) : (
            <>
              NASA IMERG Late (GPM)
              <span className="block text-xs text-ink-3">
                <T en="satellite rain estimate" bn="স্যাটেলাইট বৃষ্টির অনুমান" />
              </span>
            </>
          )}
        </Field>
        <Field label="Geographic resolution" labelBn="ভৌগোলিক রেজোলিউশন">
          0.5° grid (~55 km), 1 cell
          <span className="block text-xs text-ink-3">
            <T en={`cell ${row.cells[0]?.lat.toFixed(1) ?? "–"}°N ${row.cells[0]?.lon.toFixed(1) ?? "–"}°E`} bn={`কোষ ${row.cells[0]?.lat.toFixed(1) ?? "–"}°উ ${row.cells[0]?.lon.toFixed(1) ?? "–"}°পূ`} />
          </span>
        </Field>
        <Field label="Historical baseline" labelBn="ঐতিহাসিক ভিত্তি">
          <T
            en={`${row.spanYears} years (${row.before[0]?.firstYear ?? "—"}–${row.before[0]?.lastYear ?? "—"}), same date ±15 days`}
            bn={`${row.spanYears} বছর (${row.before[0]?.firstYear ?? "–"}–${row.before[0]?.lastYear ?? "–"}), একই তারিখ ±১৫ দিন`}
          />
        </Field>
        <Field label="Observed value" labelBn="পর্যবেক্ষিত মান">
          <span className="tabular-nums">{row.rain.day1 === null ? "–" : `${row.rain.day1.toFixed(1)} mm`}</span>
          <span className="block text-xs text-ink-3">
            <T en="1-day total" bn="১ দিনের মোট" />
          </span>
        </Field>
        <Field label="Anomaly / percentile" labelBn="অস্বাভাবিকতা / শতকরা স্থান">
          <span className="tabular-nums">{row.ratio === null ? "–" : `${row.ratio.toFixed(1)}× normal`}</span>
          <span className="block text-xs text-ink-3">
            {row.percentile === null ? <T en="No percentile" bn="শতকরা স্থান নেই" /> : <T en={`${Math.round(row.percentile)}th percentile of the date`} bn={`তারিখের ${Math.round(row.percentile)}তম শতক`} />}
          </span>
        </Field>
      </dl>

      <div>
        <h4 className="text-sm font-semibold text-ink">
          <T en="Limitations" bn="সীমাবদ্ধতা" />
        </h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>
            <T
              en="A satellite estimate averages a whole 0.5° cell. Rain in one valley can be missed, and urban or river flooding is not directly observed."
              bn="স্যাটেলাইট অনুমান পুরো ০.৫° কোষের গড়। একটি উপত্যকার বৃষ্টি বাদ পড়তে পারে, আর শহর বা নদীর বন্যা সরাসরি দেখা যায় না।"
            />
          </li>
          <li>
            <T
              en="The date±15-day comparison pools every year in the record; a slow seasonal shift inside that window is not resolved."
              bn="তারিখ±১৫ দিনের তুলনা রেকর্ডের প্রতিটি বছর একত্র করে; সেই জানালার ভেতরে ধীর মৌসুমি পরিবর্তন ধরা পড়ে না।"
            />
          </li>
          <li>
            <T
              en={`${cellsWithReading} of ${row.cells.length} cells inside the boundary carry a usable reading.`}
              bn={`সীমানার ভেতরে ${row.cells.length}টি কোষের মধ্যে ${cellsWithReading}টিতে ব্যবহারযোগ্য পাঠ আছে।`}
            />
          </li>
          <li>
            <T
              en="A reading that is not unusual does not mean conditions are safe. Flood warnings come from official agencies, never from this screen."
              bn="অস্বাভাবিক নয় এমন পাঠ মানে পরিবেশ নিরাপদ নয়। বন্যার সতর্কবার্তা আসে সরকারি সংস্থা থেকে, এই স্ক্রিনিং থেকে নয়।"
            />
          </li>
        </ul>
      </div>

      <div id="frequency" className="scroll-mt-24 rounded-xl border border-line bg-sunken p-3">
        <h4 className="text-sm font-semibold text-ink">
          <T en="Historical frequency" bn="ঐতিহাসিক ফ্রিকোয়েন্সি" />
        </h4>
        {row.frequency.state !== "ok" ? (
          <p className="mt-1 text-sm text-ink-2">
            <T
              en="Not enough historical evidence to calculate a reliable frequency."
              bn="নির্ভরযোগ্য ফ্রিকোয়েন্সি গণনার জন্য যথেষ্ট ঐতিহাসিক প্রমাণ নেই।"
            />
            {row.frequency.reason && (
              <span className="mt-1 block text-xs text-ink-3">{row.frequency.reason}</span>
            )}
          </p>
        ) : level ? (
          <>
            <p className="mt-1 text-sm text-ink">
              <T
                en={`At this rainfall level (${level.mm.toFixed(0)} mm annual rain or more), floods were catalogued in ${level.floods} of ${level.cases} historical cases.`}
                bn={`এই বৃষ্টির মাত্রায় (বছরে ${level.mm.toFixed(0)} মিমি বা তার বেশি), ${level.cases}টি ঐতিহাসিক ক্ষেত্রে ${level.floods}টিতে বন্যা নথিভুক্ত।`}
              />
            </p>
            <p className="mt-1 text-xs tabular-nums text-ink-2">
              <T
                en={`95% Wilson score interval ${(level.low * 100).toFixed(0)}–${(level.high * 100).toFixed(0)}% · sample ${level.cases} years · ${row.frequency.radiusKm} km radius · catalogue: GDACS floods.`}
                bn={`৯৫% উইলসন স্কোর ব্যবধান ${(level.low * 100).toFixed(0)}–${(level.high * 100).toFixed(0)}% · নমুনা ${level.cases} বছর · ${row.frequency.radiusKm} কিমি ব্যাসার্ধ · ক্যাটালগ: GDACS বন্যা।`}
              />
            </p>
            {!enough && (
              <p className="mt-1 rounded-lg border border-watch/40 bg-watch-soft px-2 py-1 text-xs text-watch">
                <T
                  en={`Fewer than ${row.frequency.minCases} cases: the interval is too wide to stand on its own.`}
                  bn={`${row.frequency.minCases}-এর কম ক্ষেত্র: ব্যবধানটি একা দাঁড়ানোর জন্য খুব চওড়া।`}
                />
              </p>
            )}
            <p className="mt-1 text-xs text-ink-3">
              <T
                en="A historical frequency: the share of past years at this rain level in which a flood was catalogued. It is not the probability of a flood this year."
                bn="ঐতিহাসিক ফ্রিকোয়েন্সি: এই মাত্রার বৃষ্টি ছিল এমন আগের বছরগুলোর যে অংশে বন্যা নথিভুক্ত। এটি এ বছর বন্যার সম্ভাবনা নয়।"
              />
            </p>
          </>
        ) : null}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-ink">
          <T en="Why this Data Trust Grade" bn="কেন এই তথ্য-ভরসার গ্রেড" />
        </h4>
        <ul className="mt-1 space-y-1 text-sm">
          {row.trustFactors.map((factor) => (
            <li key={factor.key} className="flex gap-2">
              <span
                aria-hidden
                className={`mt-1.5 block h-2 w-2 shrink-0 rounded-full ${factor.ok ? "bg-accent" : "border border-ink-3"}`}
              />
              <span className="text-ink-2">
                <T en={factor.en} bn={factor.bn} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-ink-2">
        <span className="font-medium text-ink">
          <T en="Coverage: " bn="আচ্ছাদন: " />
        </span>
        <T en={row.coverageReason.en} bn={row.coverageReason.bn} />
      </p>

      {row.watchReasons.length > 0 && row.coverage === "live" && (
        <div>
          <h4 className="text-sm font-semibold text-ink">
            <T en="What the rain is doing" bn="বৃষ্টি কী করছে" />
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">
            {row.watchReasons.map((reason) => (
              <li key={reason.key}>
                <T en={reason.en} bn={reason.bn} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, labelBn, children }: { label: string; labelBn: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">
        <T en={label} bn={labelBn} />
      </dt>
      <dd className="mt-0.5 font-medium text-ink">{children}</dd>
    </div>
  );
}
