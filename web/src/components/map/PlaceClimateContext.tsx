"use client";

import { ArrowDownRight, ArrowUpRight, Info, Minus } from "@phosphor-icons/react";
import { useT } from "@/lib/i18n";
import type { MapPlace, PlaceSignal } from "@/lib/mapPlaces";
import type { LayerDef } from "@/lib/layers";
import { formatSigned } from "@/lib/trends";

// Keep the existing annual observation selection; presentation never substitutes monthly data.
function observation(place: MapPlace, layer: LayerDef, date: string | null) {
  const variable = layer.category === "heat" ? "temperature" : layer.category === "water" ? "rainfall" : null;
  const signal = variable ? place.signals[variable] : null;
  const selectedYear = date ? Number(date.slice(0, 4)) : signal?.years.at(-1);
  const latest = !!signal && selectedYear! > signal.years.at(-1)!;
  const index = signal ? latest ? signal.years.length - 1 : signal.years.indexOf(selectedYear!) : -1;
  return { signal, temperature: variable === "temperature", selectedYear, latest, index,
    value: signal && index >= 0 ? signal.series[index] : null,
    year: signal && index >= 0 ? signal.years[index] : selectedYear };
}

export function PlaceClimateContext({ place, layer, date }: { place: MapPlace; layer: LayerDef; date: string | null }) {
  const t = useT();
  const { signal, temperature, latest, index, value, year } = observation(place, layer, date);
  if (!signal) return <div className="py-5 text-center" role="status">
    <p className="text-base font-semibold text-ink">{place.type === "country" ? t("Country figures not available", "দেশের পরিসংখ্যান নেই") : t("Regional figures not available", "অঞ্চলের পরিসংখ্যান নেই")}</p>
    <p className="mt-2 text-sm text-ink-2">{t("You can still explore the satellite imagery.", "স্যাটেলাইটের ছবি দেখতে পারেন।")}</p>
  </div>;
  const clear = !!signal.trend && signal.trend.p < 0.05;
  const rising = (signal.trend?.slopePerDecade ?? 0) > 0;
  const Direction = clear ? rising ? ArrowUpRight : ArrowDownRight : Minus;
  const headline = !clear ? t("No clear change over time", "সময়ের সাথে স্পষ্ট পরিবর্তন নেই")
    : temperature ? rising ? t("Getting warmer", "আরও উষ্ণ হচ্ছে") : t("Getting cooler", "আরও শীতল হচ্ছে")
      : rising ? t("More rain over time", "সময়ের সাথে বৃষ্টি বাড়ছে") : t("Less rain over time", "সময়ের সাথে বৃষ্টি কমছে");
  const interpretation = !clear ? t("The ups and downs do not show a clear trend.", "ওঠানামার মধ্যে স্পষ্ট প্রবণতা নেই।")
    : temperature ? rising ? t("Temperatures are rising.", "তাপমাত্রা বাড়ছে।") : t("Temperatures are falling.", "তাপমাত্রা কমছে।")
      : rising ? t("Yearly rainfall is increasing.", "বার্ষিক বৃষ্টি বাড়ছে।") : t("Yearly rainfall is decreasing.", "বার্ষিক বৃষ্টি কমছে।");
  return <section className="mt-4" aria-label={`${place.name} annual climate context`}>
    <div className="text-center" role="status">
      <p className="text-base font-semibold text-ink">{headline}</p>
      {value !== null && value !== undefined ? <>
        <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums text-ink">
          {temperature ? formatSigned(value, 1) : Math.round(value).toLocaleString()}<span className="ml-1 text-2xl font-medium">{signal.unit}</span>
        </p>
        <p className="mt-2 text-sm text-ink-2">{temperature
          ? value > 0 ? t("warmer than the long-term average", "দীর্ঘমেয়াদি গড়ের চেয়ে উষ্ণ") : value < 0 ? t("cooler than the long-term average", "দীর্ঘমেয়াদি গড়ের চেয়ে শীতল") : t("at the long-term average", "দীর্ঘমেয়াদি গড়ের সমান")
          : t("rain across the year", "সারা বছরের বৃষ্টি")}</p>
        <p className="mt-1 text-xs text-ink-3">{year} · {temperature ? t("yearly average", "বার্ষিক গড়") : t("yearly total", "বার্ষিক মোট")}{latest ? ` · ${t("latest data", "সর্বশেষ তথ্য")}` : ""}</p>
        <ComparisonScale signal={signal} value={value} temperature={temperature} />
      </> : <p className="mt-3 text-sm text-ink-2">{t(`No yearly figure for ${year}.`, `${year} সালের বার্ষিক পরিমাপ নেই।`)}</p>}
    </div>
    <AnnualGraph signal={signal} activeIndex={index} title={temperature ? t("How temperature changed", "তাপমাত্রা যেভাবে বদলেছে") : t("How rainfall changed", "বৃষ্টি যেভাবে বদলেছে")} placeName={place.name} temperature={temperature} />
    <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-2"><Direction size={16} className="mt-0.5 shrink-0 text-ink" aria-hidden />{interpretation}</p>
  </section>;
}

function ComparisonScale({ signal, value, temperature }: { signal: PlaceSignal; value: number; temperature: boolean }) {
  const t = useT();
  const values = signal.series.filter((v): v is number => v !== null);
  // The temperature scale is symmetric around the existing zero-anomaly reference.
  // Rain is an annual total: use the observed range, never an invented percent change.
  const extent = Math.max(...values.map(Math.abs), Math.abs(value), 0.1);
  const low = temperature ? -extent : Math.min(...values);
  const high = temperature ? extent : Math.max(...values);
  const position = high === low ? 50 : (value - low) / (high - low) * 100;
  return <figure className="my-4" aria-label={temperature ? `${value} °C relative to the long-term average` : `${value} mm, compared with the recorded yearly range`}>
    <div className="flex justify-between text-[10px] text-ink-3">
      <span>{temperature ? t("Cooler", "শীতল") : t("Least recorded", "রেকর্ডে সর্বনিম্ন")}</span>
      {temperature && <span>{t("Average", "গড়")}</span>}
      <span>{temperature ? t("Hotter", "উষ্ণ") : t("Most recorded", "রেকর্ডে সর্বোচ্চ")}</span>
    </div>
    <div className="relative mx-1 mt-2 h-3" aria-hidden>
      <div className="absolute inset-x-0 top-1.5 border-t-2 border-line" />
      {temperature && <div className="absolute left-1/2 top-0 h-3 border-l border-ink-3" />}
      <div className="absolute top-0 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-card bg-accent" style={{ left: `${position}%` }} />
    </div>
  </figure>;
}

export function PlaceDataDetails({ place, layer, date }: { place: MapPlace; layer: LayerDef; date: string | null }) {
  const t = useT();
  const { signal, temperature, selectedYear, latest, year } = observation(place, layer, date);
  return <details className="border-t border-line pt-3 text-xs text-ink-2">
    <summary className="flex cursor-pointer items-center gap-2 rounded-lg py-1 font-medium text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"><Info size={16} aria-hidden />{t("About this data", "এই তথ্য সম্পর্কে")}</summary>
    <div className="mt-3 space-y-3 leading-relaxed">
      <p>{t(layer.description, layer.bn.description)}</p>
      <p>{t("The map shows the selected satellite month. The trend chart uses the long-term annual climate record.", "মানচিত্রে নির্বাচিত মাসের স্যাটেলাইট ছবি দেখা যায়। চার্টে দীর্ঘমেয়াদি বার্ষিক জলবায়ুর তথ্য আছে।")}</p>
      {signal ? <>
        <dl className="space-y-2">
          <div><dt className="font-medium text-ink">{t("Source", "উৎস")}</dt><dd>{signal.source}</dd></div>
          <div><dt className="font-medium text-ink">{t("What the number means", "সংখ্যার অর্থ")}</dt><dd>{temperature ? t("Annual surface-temperature anomaly relative to the long-term average.", "দীর্ঘমেয়াদি গড়ের তুলনায় বার্ষিক ভূপৃষ্ঠের তাপমাত্রার বিচ্যুতি।") : t("Annual rainfall total, averaged over the selected geography.", "নির্বাচিত এলাকার গড় বার্ষিক মোট বৃষ্টি।")}</dd></div>
          {signal.baseline && <div><dt className="font-medium text-ink">{t("Comparison", "তুলনা")}</dt><dd>{signal.baseline}</dd></div>}
          <div><dt className="font-medium text-ink">{t("Resolution", "রেজোলিউশন")}</dt><dd>{signal.gridDegrees}° {t("climate grid", "জলবায়ু গ্রিড")}{signal.cells !== null ? ` · ${signal.cells} ${t("intersecting land-grid cells", "ছেদ করা স্থলভাগের বর্গ")}` : ""}</dd></div>
          <div><dt className="font-medium text-ink">{t("Shown year / latest annual data", "দেখানো বছর / সর্বশেষ বার্ষিক তথ্য")}</dt><dd>{year} / {signal.years.at(-1)}</dd></div>
          {signal.trend && <div><dt className="font-medium text-ink">{t("Trend method", "প্রবণতার পদ্ধতি")}</dt><dd>Sen&apos;s slope: {formatSigned(signal.trend.slopePerDecade, 2)} {signal.unit}/decade; 95% CI: {formatSigned(signal.trend.lowerPerDecade, 2)} to {formatSigned(signal.trend.upperPerDecade, 2)}. Hamed–Rao corrected Mann–Kendall test, p = {signal.trend.p.toPrecision(3)}.</dd></div>}
        </dl>
        {latest && <p>{t(`The satellite map can show ${selectedYear} imagery. The annual research record ends in ${signal.years.at(-1)}; the latest available annual value is shown.`, `স্যাটেলাইট মানচিত্রে ${selectedYear} সালের ছবি আছে। বার্ষিক রেকর্ড ${signal.years.at(-1)} সালে শেষ; সর্বশেষ বার্ষিক মান দেখানো হচ্ছে।`)}</p>}
        <p>{place.type === "country" ? t("This is a coarse country-level estimate, not a city-level measurement.", "এটি দেশের আনুমানিক হিসাব, শহরের সরাসরি পরিমাপ নয়।") : t("This is a land-weighted regional estimate, not a city-level measurement.", "এটি স্থলভাগের ভারযুক্ত আঞ্চলিক হিসাব, শহরের সরাসরি পরিমাপ নয়।")}</p>
      </> : <p>{t("Country or regional statistics are not available for this layer. No numerical change is inferred from the satellite imagery.", "এই স্তরের দেশ বা অঞ্চলের পরিসংখ্যান নেই। স্যাটেলাইট ছবি থেকে সংখ্যাগত পরিবর্তন অনুমান করা হয়নি।")}</p>}
      <a href={layer.sourceUrl} target="_blank" rel="noreferrer" className="inline-block text-accent underline underline-offset-2">{t("Satellite data source", "স্যাটেলাইট তথ্যের উৎস")}</a>
    </div>
  </details>;
}

function AnnualGraph({ signal, activeIndex, title, placeName, temperature }: { signal: PlaceSignal; activeIndex: number; title: string; placeName: string; temperature: boolean }) {
  const values = signal.series.filter((v): v is number => v !== null);
  if (!values.length) return null;
  const low = Math.min(...values), high = Math.max(...values);
  const width = 300, height = 86;
  const point = (v: number, i: number) => ({ x: 4 + i / Math.max(1, signal.series.length - 1) * (width - 8), y: 5 + (high - v) / (high - low || 1) * (height - 16) });
  const path = signal.series.map((v, i) => { if (v === null) return ""; const p = point(v, i); const command = i === 0 || signal.series[i - 1] === null ? "M" : "L"; return `${command}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" ");
  const activeValue = signal.series[activeIndex];
  const active = activeValue !== undefined && activeValue !== null ? point(activeValue, activeIndex) : null;
  const first = signal.series[0] !== null ? point(signal.series[0], 0) : null;
  const lastIndex = signal.series.length - 1;
  const last = signal.series[lastIndex] !== null ? point(signal.series[lastIndex]!, lastIndex) : null;
  return <figure>
    <figcaption className="text-[11px] font-medium text-ink-3">{title}</figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 block h-20 w-full" role="img" aria-label={`${placeName}: ${title}, ${signal.years[0]} to ${signal.years.at(-1)}${active ? `, highlighted year ${signal.years[activeIndex]}` : ""}`}>
      <path d={path} fill="none" stroke={temperature ? "var(--warm-3)" : "var(--accent)"} strokeWidth="2" strokeLinecap="round" />
      {first && <circle cx={first.x} cy={first.y} r={2.5} fill="var(--card)" stroke="var(--ink-3)" />}
      {last && <circle cx={last.x} cy={last.y} r={2.5} fill="var(--ink-3)" />}
      {active && <><line x1={active.x} x2={active.x} y1={4} y2={height - 4} stroke="var(--accent)" strokeDasharray="3 3" /><circle cx={active.x} cy={active.y} r={3.5} fill="var(--accent)" /></>}
    </svg>
    <div className="flex justify-between text-[11px] text-ink-3"><span>{signal.years[0]}</span><span>{signal.years.at(-1)}</span></div>
  </figure>;
}
