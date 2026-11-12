// Two planet-wide signals under the home page stripes: the cause (CO2) and the clearest effect
// (September Arctic sea ice), each a number, a one-line sentence and a small line of its 45 years.

import { bnNum } from "@/lib/bn";
import { T } from "@/lib/i18n";

export interface Signal {
  unit: string;
  years: [number, number];
  values: number[];
  perDecade: number;
  pctPerDecade: number;
  p: number;
  first: number;
  last: number;
}

function Spark({ values, color, label }: { values: number[]; color: string; label: string }) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - lo) / (hi - lo || 1)) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label} className="mt-4 h-14 w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function PlanetSignals({ co2, seaIce }: { co2: Signal; seaIce: Signal }) {
  const [y0, y1] = co2.years;
  const iceLoss = Math.round(((seaIce.last - seaIce.first) / seaIce.first) * 100);
  const iceText = `${iceLoss < 0 ? "−" : "+"}${Math.abs(iceLoss)}%`; // a true minus sign
  const clear = seaIce.p < 0.05;
  return (
    <section aria-labelledby="signals-hdg" className="mx-auto mt-16 w-full max-w-[1100px] px-4 sm:mt-20 sm:px-6">
      <h2 id="signals-hdg" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        <T en="The cause, and the clearest effect" bn="কারণ, আর সবচেয়ে স্পষ্ট ফল" />
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-card p-6 shadow-soft">
          <p className="text-sm font-medium text-ink-2">
            <T en="Carbon dioxide in the air" bn="বাতাসে কার্বন ডাই-অক্সাইড" />
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums text-ink">
            <T en={`${co2.first.toFixed(0)} → ${co2.last.toFixed(0)} ppm`} bn={`${bnNum(co2.first.toFixed(0))} → ${bnNum(co2.last.toFixed(0))} পিপিএম`} />
          </p>
          <p className="mt-2 text-ink-2">
            <T
              en={`from ${y0} to ${y1}, the main driver of the warming. Every year higher than the last.`}
              bn={`${bnNum(y0)} থেকে ${bnNum(y1)}, উষ্ণতার প্রধান কারণ। প্রতি বছর আগের বছরের চেয়ে বেশি।`}
            />
          </p>
          <Spark values={co2.values} color="var(--ink-2)" label={`Carbon dioxide, ${y0} to ${y1}: a steady rise.`} />
          <p className="mt-2 text-xs text-ink-3">NOAA Global Monitoring Laboratory</p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-soft">
          <p className="text-sm font-medium text-ink-2">
            <T en="Arctic sea ice each September" bn="প্রতি সেপ্টেম্বরে আর্কটিকের সমুদ্র-বরফ" />
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums text-[var(--cool-4)]">
            <T en={iceText} bn={bnNum(iceText)} />
          </p>
          <p className="mt-2 text-ink-2">
            <T
              en={`since ${y0}: about ${Math.abs(Math.round(seaIce.pctPerDecade))}% less every 10 years${clear ? ", a clear change" : ""}.`}
              bn={`${bnNum(y0)} থেকে: প্রতি ১০ বছরে প্রায় ${bnNum(Math.abs(Math.round(seaIce.pctPerDecade)))}% কম${clear ? ", স্পষ্ট পরিবর্তন" : ""}।`}
            />
          </p>
          <Spark values={seaIce.values} color="var(--cool-3)" label={`September Arctic sea ice, ${y0} to ${y1}: falling.`} />
          <p className="mt-2 text-xs text-ink-3">
            <T en="NSIDC Sea Ice Index, from NASA and US satellite records" bn="এনএসআইডিসি সি আইস ইনডেক্স, নাসা ও মার্কিন স্যাটেলাইটের রেকর্ড থেকে" />
          </p>
        </div>
      </div>
    </section>
  );
}
