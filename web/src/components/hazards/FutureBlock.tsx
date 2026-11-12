"use client";

// "By 2041–2060" for one hazard region: how often today's rare (1-in-10) year would come, from
// NASA's NEX-GDDP-CMIP6 projections, plus the honest result of our disaster-year model test.
// Kept short on purpose: one dot row, one line, details folded away.

import { useState } from "react";
import { bnNum } from "@/lib/bn";
import type { OutlookSummary } from "@/lib/data";
import { T, useT } from "@/lib/i18n";

export interface RiskRow {
  id: string;
  skillful: boolean;
  n: number;
  cv: { auc: number; bss: number; adjustedP: number };
}

type Scenario = "ssp245" | "ssp585";

const EVENT: Record<string, { key: string; en: string; bn: string }> = {
  flood: { key: "wetMonsoon", en: "Very wet monsoons", bn: "অতি ভেজা বর্ষা" },
  landslide: { key: "wetMonsoon", en: "Very wet monsoons", bn: "অতি ভেজা বর্ষা" },
  wildfire: { key: "hotYear", en: "Very hot years", bn: "অতি গরম বছর" },
};

function inTen(rate: number): { en: string; bn: string } {
  if (rate >= 0.95) return { en: "almost every year", bn: "প্রায় প্রতি বছর" };
  const k = Math.max(1, Math.round(rate * 10));
  return { en: `${k} in 10 years`, bn: `১০ বছরে ${bnNum(k)} বার` };
}

export function FutureBlock({
  hazard,
  region,
  outlook,
  risk,
}: {
  hazard: string;
  region: OutlookSummary["regions"][number] | undefined;
  outlook: OutlookSummary;
  risk: RiskRow | undefined;
}) {
  const [scenario, setScenario] = useState<Scenario>("ssp245");
  const tx = useT();
  const event = EVENT[hazard];
  if (!region || !event) return null;
  const s = region.scenarios[scenario];
  const e = s.exceedance[event.key];
  const filled = Math.min(10, Math.max(1, Math.round(e.median * 10)));
  const words = inTen(e.median);
  const t = s.metrics.tMean.median;
  const rain = s.metrics.monsoonRain;
  const n = outlook.models.length;
  const span = `${outlook.future[0]}–${outlook.future[1]}`;

  return (
    <div id="future" className="scroll-mt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-ink">
          <T en={`By ${span}`} bn={`${bnNum(outlook.future[0])}–${bnNum(outlook.future[1])} সালের মধ্যে`} />
        </h3>
        <div role="radiogroup" aria-label={tx("Emissions path", "নিঃসরণের পথ")} className="flex rounded-full bg-sunken p-0.5 text-xs">
          {(
            [
              ["ssp245", "Middle road", "মাঝামাঝি পথ"],
              ["ssp585", "High emissions", "উচ্চ নিঃসরণ"],
            ] as const
          ).map(([id, en, bn]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={scenario === id}
              onClick={() => setScenario(id)}
              className={`rounded-full px-2.5 py-1 transition-colors ${scenario === id ? "bg-card font-medium text-ink shadow-soft" : "text-ink-2 hover:text-ink"}`}
            >
              <T en={en} bn={bn} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-sunken p-4">
        <p className="text-sm font-medium text-ink">
          <T en={event.en} bn={event.bn} />
        </p>
        <div className="mt-2 space-y-2 text-sm">
          <Dots label={<T en="Today" bn="আজ" />} filled={1} />
          <Dots label={<T en={`${outlook.future[0]}–${String(outlook.future[1]).slice(2)}`} bn={bnNum(`${outlook.future[0]}–${String(outlook.future[1]).slice(2)}`)} />} filled={filled} strong />
        </div>
        <p className="mt-3 text-sm text-ink-2">
          <T
            en={`Today about 1 in 10 years; by then ${words.en}.`}
            bn={`আজ প্রায় ১০ বছরে ১ বার; তখন ${words.bn}।`}
          />
        </p>
      </div>

      <p className="mt-3 text-sm text-ink-2">
        <T
          en={`${t > 0 ? "+" : ""}${t.toFixed(1)} °C warmer. Monsoon rain ${rain.median > 0 ? "+" : ""}${rain.median.toFixed(0)}% (${rain.agree} of ${n} climate models agree).`}
          bn={`${bnNum(t.toFixed(1))} °সে বেশি গরম। বর্ষার বৃষ্টি ${bnNum(rain.median.toFixed(0))}% (${bnNum(n)}টি জলবায়ু মডেলের ${bnNum(rain.agree)}টি একমত)।`}
        />
      </p>

      <details className="group mt-3 rounded-xl border border-line">
        <summary className="cursor-pointer list-none px-3.5 py-2.5 text-sm font-medium text-ink-2 hover:text-ink">
          <T en="Can AI predict disaster years here?" bn="এআই কি এখানে দুর্যোগের বছর আগে বলতে পারে?" />
        </summary>
        <div className="space-y-2 border-t border-line px-3.5 py-3 text-sm text-ink-2">
          <p>
            {risk?.skillful ? (
              <T en="Yes: our model passed the test on past years here." bn="হ্যাঁ: এখানে আমাদের মডেল অতীতের বছরে পরীক্ষায় উত্তীর্ণ।" />
            ) : (
              <T
                en={`Not yet. We trained a small machine-learning model on ${risk?.n ?? "the"} past years. It could not beat simple guessing, so we don't turn these projections into disaster odds.`}
                bn={`এখনো না। আমরা ${risk ? bnNum(risk.n) : ""} বছরের অতীত তথ্যে একটি ছোট মেশিন-লার্নিং মডেল শিখিয়েছি। এটি সাধারণ অনুমানের চেয়ে ভালো করেনি, তাই আমরা এই অনুমানকে দুর্যোগের সম্ভাবনায় বদলাই না।`}
              />
            )}
          </p>
          {risk && (
            <p className="text-xs text-ink-3">
              AUC {risk.cv.auc.toFixed(2)} · Brier skill {risk.cv.bss > 0 ? "+" : ""}
              {risk.cv.bss.toFixed(2)} · adjusted p {risk.cv.adjustedP.toFixed(2)}
            </p>
          )}
          <p className="text-xs text-ink-3">
            <T
              en={`Projections: NASA NEX-GDDP-CMIP6, ${n} models, ${span} vs ${outlook.present[0]}–${outlook.present[1]}.`}
              bn={`অনুমান: নাসা NEX-GDDP-CMIP6, ${bnNum(n)}টি মডেল, ${bnNum(outlook.future[0])}–${bnNum(outlook.future[1])} বনাম ${bnNum(outlook.present[0])}–${bnNum(outlook.present[1])}।`}
            />
          </p>
        </div>
      </details>
    </div>
  );
}

function Dots({ label, filled, strong }: { label: React.ReactNode; filled: number; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 whitespace-nowrap text-ink-2">{label}</span>
      <span aria-hidden className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`h-3 w-3 rounded-full ${i < filled ? (strong ? "bg-[var(--warm-3)]" : "bg-ink-2") : "border border-line bg-card"}`} />
        ))}
      </span>
      <span className="sr-only">{filled} of 10</span>
    </div>
  );
}
