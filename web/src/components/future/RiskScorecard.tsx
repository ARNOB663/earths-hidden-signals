// "Could a model learn high-disaster years?" Every region's risk model, scored on years it never
// saw, with a strip of its year-by-year predictions. Renders on the server; text via <T>.

import { bnNum } from "@/lib/bn";
import { T } from "@/lib/i18n";
import { ZONE_BN } from "@/lib/names";

export interface RiskRegion {
  id: string;
  name: string;
  hazard: "flood" | "landslide" | "wildfire";
  eventSource: string;
  drivers: { key: string; label: string; coef: number }[];
  n: number;
  events: number;
  years: [number, number];
  cv: { auc: number; brier: number; brierBaseline: number; bss: number; permutationP: number; adjustedP: number; permutations: number };
  skillful: boolean;
  backtest: { year: number; p: number; high: number }[];
  future: null | {
    observedRate: number;
    scenarios: Record<string, { ratio: number; min: number; max: number; futureRate: number }>;
  };
}

export interface RiskModel {
  method: string;
  skillRule: { bss: number; auc: number; p: number };
  regions: RiskRegion[];
}

const HAZARD = {
  flood: ["High-flood years", "বন্যা-বহুল বছর"],
  landslide: ["High-landslide years", "ভূমিধস-বহুল বছর"],
  wildfire: ["High-fire years", "আগুন-বহুল বছর"],
} as const;

const DRIVER_BN: Record<string, string> = {
  "Monsoon rain": "বর্ষার বৃষ্টি",
  "Hot-season temperature": "গরমের মৌসুমের তাপমাত্রা",
  "Hot-season rain": "গরমের মৌসুমের বৃষ্টি",
  "Very heavy rain days": "অতি ভারী বৃষ্টির দিন",
  "Rain on the wettest day": "সবচেয়ে বৃষ্টির দিনে বৃষ্টি",
};

export function RiskScorecard({ model }: { model: RiskModel }) {
  const passed = model.regions.filter((r) => r.skillful);
  const best = [...model.regions].sort((a, b) => a.cv.adjustedP - b.cv.adjustedP)[0];

  return (
    <section aria-labelledby="risk-hdg" className="mt-14">
      <h2 id="risk-hdg" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        <T en="Could a model learn which years bring disasters?" bn="মডেল কি শিখতে পারে কোন বছর দুর্যোগ আনে?" />
      </h2>
      <p className="mt-2 max-w-[75ch] text-sm leading-relaxed text-ink-2">
        <T
          en="Before turning projections into disaster odds, we tested whether a small machine-learning model (logistic regression) can tell a high-disaster year from an ordinary one using that year's climate. Each region's model is scored only on years it never saw, against simply guessing the usual rate. To pass, it must beat guessing (Brier skill above 0), rank years well (AUC at least 0.65) and survive a luck test across all regions (adjusted p at most 0.10)."
          bn="অনুমানকে দুর্যোগের সম্ভাবনায় বদলানোর আগে আমরা পরীক্ষা করেছি, একটি ছোট মেশিন-লার্নিং মডেল (লজিস্টিক রিগ্রেশন) কি সেই বছরের জলবায়ু দেখে দুর্যোগ-বহুল বছরকে সাধারণ বছর থেকে আলাদা করতে পারে। প্রতিটি অঞ্চলের মডেলকে কেবল না-দেখা বছরে, সাধারণ হার অনুমান করার সাথে তুলনা করে নম্বর দেওয়া হয়। উত্তীর্ণ হতে হলে অনুমানের চেয়ে ভালো হতে হবে (ব্রায়ার স্কিল ০-এর বেশি), বছরগুলো ভালোভাবে সাজাতে হবে (AUC অন্তত ০.৬৫), আর সব অঞ্চল মিলিয়ে ভাগ্য-পরীক্ষায় টিকতে হবে (সমন্বিত p সর্বোচ্চ ০.১০)।"
        />
      </p>

      <p className="mt-4 rounded-lg border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm leading-relaxed text-ink">
        {passed.length === 0 ? (
          <T
            en={`Result: no region passes. With only ${Math.min(...model.regions.map((r) => r.n))}–${Math.max(...model.regions.map((r) => r.n))} years of disaster records per region, the model cannot reliably beat guessing. ${best.name} comes closest (AUC ${best.cv.auc.toFixed(2)}, but adjusted p ${best.cv.adjustedP.toFixed(2)}). So the Future Outlook above uses direct counts from the climate models, not this model. We publish the failure because a disaster “AI” that cannot pass this test should not be trusted.`}
            bn={`ফলাফল: কোনো অঞ্চল উত্তীর্ণ হয়নি। প্রতি অঞ্চলে মাত্র ${bnNum(Math.min(...model.regions.map((r) => r.n)))}–${bnNum(Math.max(...model.regions.map((r) => r.n)))} বছরের দুর্যোগ-রেকর্ড দিয়ে মডেল নির্ভরযোগ্যভাবে অনুমানকে হারাতে পারে না। সবচেয়ে কাছে ${ZONE_BN[best.id]?.name ?? best.name} (AUC ${bnNum(best.cv.auc.toFixed(2))}, কিন্তু সমন্বিত p ${bnNum(best.cv.adjustedP.toFixed(2))})। তাই ওপরের ভবিষ্যতের চিত্র এই মডেল নয়, জলবায়ু মডেলের সরাসরি গণনা ব্যবহার করে। আমরা ব্যর্থতাটি প্রকাশ করি, কারণ যে দুর্যোগ-“এআই” এই পরীক্ষায় উত্তীর্ণ হয় না তাকে বিশ্বাস করা উচিত নয়।`}
          />
        ) : (
          <T
            en={`Result: ${passed.length} of ${model.regions.length} regions pass (${passed.map((r) => r.name).join(", ")}). Only those regions get a projected change in disaster odds below; the rest rely on direct climate counts.`}
            bn={`ফলাফল: ${bnNum(model.regions.length)}টির মধ্যে ${bnNum(passed.length)}টি অঞ্চল উত্তীর্ণ (${passed.map((r) => ZONE_BN[r.id]?.name ?? r.name).join(", ")})। কেবল সেগুলোর জন্য নিচে দুর্যোগ-সম্ভাবনার পরিবর্তন দেখানো হয়েছে; বাকিগুলো সরাসরি জলবায়ু গণনার ওপর নির্ভর করে।`}
          />
        )}
      </p>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th scope="col" className="px-4 py-3 font-medium">
                <T en="Region and target" bn="অঞ্চল ও লক্ষ্য" />
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                <T en="Climate drivers" bn="জলবায়ু চালক" />
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">AUC</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                <T en="Brier skill" bn="ব্রায়ার স্কিল" />
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                <T en="Luck test (adj. p)" bn="ভাগ্য-পরীক্ষা (সমন্বিত p)" />
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                <T en="Each year: model's chance (fill) · real high year (ring)" bn="প্রতি বছর: মডেলের সম্ভাবনা (রং) · আসল দুর্যোগ-বহুল বছর (বৃত্ত)" />
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <T en="Verdict" bn="রায়" />
              </th>
            </tr>
          </thead>
          <tbody>
            {model.regions.map((r) => (
              <tr key={r.id} className="border-b border-line align-top last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium text-ink">
                  <T en={r.name} bn={ZONE_BN[r.id]?.name ?? r.name} />
                  <span className="block text-xs font-normal text-ink-3">
                    <T
                      en={`${HAZARD[r.hazard][0]}: ${r.events} of ${r.n} (${r.years[0]}–${r.years[1]})`}
                      bn={`${HAZARD[r.hazard][1]}: ${bnNum(r.n)}টির ${bnNum(r.events)}টি (${bnNum(r.years[0])}–${bnNum(r.years[1])})`}
                    />
                  </span>
                </th>
                <td className="px-3 py-3 text-xs text-ink-2">
                  {r.drivers.map((d) => (
                    <span key={d.key} className="block">
                      <T en={d.label} bn={DRIVER_BN[d.label] ?? d.label} /> <span className="text-ink-3">({d.coef > 0 ? "+" : "−"})</span>
                    </span>
                  ))}
                </td>
                <td className={`px-3 py-3 text-right tabular-nums ${r.cv.auc >= model.skillRule.auc ? "font-semibold text-ink" : "text-ink-3"}`}>
                  {r.cv.auc.toFixed(2)}
                </td>
                <td className={`px-3 py-3 text-right tabular-nums ${r.cv.bss > model.skillRule.bss ? "font-semibold text-ink" : "text-ink-3"}`}>
                  {r.cv.bss > 0 ? "+" : ""}
                  {r.cv.bss.toFixed(2)}
                </td>
                <td className={`px-3 py-3 text-right tabular-nums ${r.cv.adjustedP <= model.skillRule.p ? "font-semibold text-ink" : "text-ink-3"}`}>
                  {r.cv.adjustedP.toFixed(2)}
                  <span className="block text-[11px] text-ink-3">
                    <T en={`raw ${r.cv.permutationP.toFixed(3)}`} bn={`কাঁচা ${bnNum(r.cv.permutationP.toFixed(3))}`} />
                  </span>
                </td>
                <td className="px-3 py-3">
                  <Strip backtest={r.backtest} />
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${r.skillful ? "bg-accent-soft text-accent" : "bg-sunken text-ink-2"}`}
                  >
                    {r.skillful ? <T en="Passes" bn="উত্তীর্ণ" /> : <T en="No skill" bn="দক্ষতা নেই" />}
                  </span>
                  {r.future?.scenarios.ssp585 && (
                    <span className="mt-1 block text-xs text-ink-2">
                      <T
                        en={`High emissions, ${"2041–60"}: odds ×${r.future.scenarios.ssp585.ratio} (×${r.future.scenarios.ssp585.min}–×${r.future.scenarios.ssp585.max})`}
                        bn={`উচ্চ নিঃসরণ, ২০৪১–৬০: সম্ভাবনা ×${bnNum(r.future.scenarios.ssp585.ratio)} (×${bnNum(r.future.scenarios.ssp585.min)}–×${bnNum(r.future.scenarios.ssp585.max)})`}
                      />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-[85ch] text-xs leading-relaxed text-ink-3">
        <T
          en={`How it was tested: ${model.method}. Drivers were assigned to each region by the hazard pipeline before this model existed, so they were not chosen to make the score look good. Disaster records: GDACS floods, NASA Global Landslide Catalog (news-based, 2007–2017), NASA FIRMS fire detections. A high-disaster year is one at or above the region's 75th-percentile event count. An AUC far below 0.5 is not “anti-skill”: when a driver carries almost no signal, its fitted direction flips each time two years are held out, so pairs get ranked backwards. The luck test shuffles the years and goes through the same flip, which is why it, not the raw AUC, decides.`}
          bn={`যেভাবে পরীক্ষা হয়েছে: ${model.method}। এই মডেল তৈরির আগেই দুর্যোগ-পাইপলাইন প্রতিটি অঞ্চলের চালক নির্ধারণ করেছিল, তাই নম্বর ভালো দেখাতে সেগুলো বাছাই করা হয়নি। দুর্যোগ-রেকর্ড: GDACS বন্যা, নাসার গ্লোবাল ল্যান্ডস্লাইড ক্যাটালগ (সংবাদভিত্তিক, ২০০৭–২০১৭), নাসা FIRMS আগুন-শনাক্তকরণ। দুর্যোগ-বহুল বছর মানে যে বছর অঞ্চলের ঘটনা-সংখ্যা তার ৭৫তম শতকাংশ বা বেশি। ০.৫-এর অনেক নিচের AUC মানে “উল্টো দক্ষতা” নয়: চালকে প্রায় কোনো সংকেত না থাকলে প্রতিবার দুটি বছর বাদ দিলে তার দিক উল্টে যায়, তাই জোড়াগুলো উল্টোভাবে সাজানো হয়। ভাগ্য-পরীক্ষা বছরগুলো এলোমেলো করে একই উল্টে যাওয়ার মধ্য দিয়ে যায়, তাই কাঁচা AUC নয়, সেটিই সিদ্ধান্ত নেয়।`}
        />
      </p>
    </section>
  );
}

function Strip({ backtest }: { backtest: RiskRegion["backtest"] }) {
  return (
    <span className="flex flex-wrap gap-0.5" role="img" aria-label={backtest.map((b) => `${b.year}: ${Math.round(b.p * 100)}%${b.high ? " (high year)" : ""}`).join(", ")}>
      {backtest.map((b) => (
        <span
          key={b.year}
          title={`${b.year}: ${Math.round(b.p * 100)}%${b.high ? " · high-disaster year" : ""}`}
          className={`h-3.5 w-3.5 rounded-sm ${b.high ? "ring-2 ring-ink ring-offset-1 ring-offset-card" : ""}`}
          style={{ background: `color-mix(in oklab, var(--warm-3) ${Math.round(Math.min(1, b.p / 0.6) * 100)}%, var(--sunken))` }}
        />
      ))}
    </span>
  );
}
