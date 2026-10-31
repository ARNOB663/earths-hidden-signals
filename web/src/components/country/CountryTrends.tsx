"use client";

import { useMemo, useState } from "react";
import { SeriesChart } from "@/components/trends/SeriesChart";
import { Sureness, Segmented } from "@/components/ui";
import { DataActions } from "@/components/ui/DataActions";
import { COUNTRY_TREND_KEYS, type Country } from "@/lib/countries";
import { downloadCsv, slug } from "@/lib/download";
import { T, useT } from "@/lib/i18n";
import { DEFINITION_BN, unitBn } from "@/lib/names";
import { formatP, formatSigned } from "@/lib/trends";

type Variable = "temperature" | "rainfall" | "extremes";
type Period = "all" | "recent";
type View = "change" | "actual";

/** "1.5 °C above the baseline" and similar; the axis note for each measure. */
const AXIS: Record<string, { en: string; bn: string }> = {
  temperature: { en: "°C vs 1951–1980 average", bn: "°সে, ১৯৫১–১৯৮০ গড়ের তুলনায়" },
  rainfall: { en: "mm per year", bn: "মিমি প্রতি বছর" },
  "hot-months": { en: "months per year", bn: "মাস প্রতি বছর" },
  "dry-spell": { en: "days", bn: "দিন" },
  "heavy-rain": { en: "days per year", bn: "দিন প্রতি বছর" },
  "wettest-day": { en: "mm in one day", bn: "এক দিনে মিমি" },
};

const SEASON_LABEL: Record<string, { en: string; bn: string }> = {
  annual: { en: "Whole year", bn: "পুরো বছর" },
  "pre-monsoon": { en: "Pre-monsoon (Mar–May)", bn: "বর্ষা-পূর্ব (মার্চ–মে)" },
  monsoon: { en: "Monsoon (Jun–Sep)", bn: "বর্ষা (জুন–সেপ্টেম্বর)" },
};

const EXTREME_LABEL: Record<string, { en: string; bn: string }> = {
  "hot-months_annual": { en: "Very hot months", bn: "অতি গরম মাস" },
  "dry-spell_annual": { en: "Longest monsoon dry spell", bn: "বর্ষার দীর্ঘতম খরা" },
  "heavy-rain_annual": { en: "Very heavy rain days", bn: "অতি ভারী বৃষ্টির দিন" },
  "wettest-day_annual": { en: "Wettest day of the year", bn: "বছরের সবচেয়ে ভেজা দিন" },
};

export function CountryTrends({ country }: { country: Country }) {
  const t = useT();
  const [variable, setVariable] = useState<Variable>("temperature");
  const [season, setSeason] = useState<"annual" | "pre-monsoon" | "monsoon">("annual");
  const [extreme, setExtreme] = useState("hot-months_annual");
  const [period, setPeriod] = useState<Period>("all");
  const [view, setView] = useState<View>("change");

  const keys = COUNTRY_TREND_KEYS;
  const key = variable === "extremes" ? extreme : `${variable}_${season}`;
  const signal = country.signals[key] ?? null;

  // Period filter: "recent" compares the last 20 years with the full record.
  const windowed = useMemo(() => {
    if (!signal) return null;
    if (period === "all") return signal;
    const start = signal.years.at(-1)! - 19;
    const from = signal.years.indexOf(start);
    const years = signal.years.slice(from);
    const series = signal.series.slice(from);
    return { ...signal, years, series };
  }, [signal, period]);

  const recentTrend = useMemo(() => {
    if (!signal || period === "all") return null;
    return signal.trend;
  }, [signal, period]);

  const axis = AXIS[variable === "extremes" ? key.split("_")[0] : variable];
  const definition = key.split("_")[0] as "hot-months" | "dry-spell" | "heavy-rain" | "wettest-day";
  const unit = signal?.unit ?? "";

  const seasonOptions = keys.temperature.map((k) => {
    const s = k.split("_")[1];
    return { id: s as "annual" | "pre-monsoon" | "monsoon", label: <T en={SEASON_LABEL[s].en} bn={SEASON_LABEL[s].bn} /> };
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          options={[
            { id: "temperature", label: <T en="Temperature" bn="তাপমাত্রা" /> },
            { id: "rainfall", label: <T en="Rainfall" bn="বৃষ্টি" /> },
            { id: "extremes", label: <T en="Heat and dry spells" bn="গরম ও খরা" /> },
          ]}
          value={variable}
          onChange={setVariable}
          label={t("Measure", "পরিমাপ")}
        />
        <Segmented
          options={[
            { id: "all", label: <T en="Full record" bn="পুরো রেকর্ড" /> },
            { id: "recent", label: <T en="Last 20 years" bn="গত ২০ বছর" /> },
          ]}
          value={period}
          onChange={setPeriod}
          label={t("Period", "সময়কাল")}
        />
      </div>

      {variable !== "extremes" && (
        <div className="mt-3">
          <Segmented options={seasonOptions} value={season} onChange={setSeason} label={t("Season", "ঋতু")} />
        </div>
      )}

      {variable === "extremes" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {keys.extremes.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setExtreme(k)}
              aria-pressed={extreme === k}
              className={`rounded-full border px-3 py-1.5 text-sm ${extreme === k ? "border-accent bg-accent-soft font-medium text-ink" : "border-line text-ink-2 hover:text-ink"}`}
            >
              <T en={EXTREME_LABEL[k].en} bn={EXTREME_LABEL[k].bn} />
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-card p-4 sm:p-6">
        {!windowed?.trend ? (
          <EmptyTrend />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink">
                  {variable === "extremes" ? (
                    <T en={EXTREME_LABEL[key].en} bn={EXTREME_LABEL[key].bn} />
                  ) : (
                    <T en={`${variable === "temperature" ? "Temperature" : "Rainfall"}, ${SEASON_LABEL[season].en.toLowerCase()}`} bn={`${variable === "temperature" ? "তাপমাত্রা" : "বৃষ্টি"}, ${SEASON_LABEL[season].bn}`} />
                  )}
                </h3>
                <p className="mt-1 text-sm text-ink-2">
                  <span className="tabular-nums font-medium text-ink">
                    {formatSigned(windowed.trend.slopePerDecade, variable === "rainfall" ? 0 : 2)} {unit}
                  </span>{" "}
                  <T en="per decade" bn="প্রতি দশকে" /> · {formatP(windowed.trend.p)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Segmented
                  options={[
                    { id: "change", label: <T en="Year by year" bn="বছরভিত্তিক" /> },
                    { id: "actual", label: <T en="Range" bn="পরিসর" /> },
                  ]}
                  value={view}
                  onChange={setView}
                  label={t("View", "দৃশ্য")}
                />
              </div>
            </div>

            {view === "change" ? (
              <SeriesChart
                years={windowed.years}
                values={windowed.series}
                slopePerDecade={windowed.trend.slopePerDecade}
                lowerPerDecade={windowed.trend.lowerPerDecade}
                upperPerDecade={windowed.trend.upperPerDecade}
                unit={unit}
                decimals={variable === "rainfall" ? 0 : 1}
                axisLabel={axis.en}
                axisLabelBn={axis.bn}
                zeroLine={variable === "temperature"}
                title={`${country.name} ${key}`}
              />
            ) : (
              <RangeStrip years={windowed.years} series={windowed.series} unit={unit} />
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Sureness p={windowed.trend.p} />
              <p className="text-xs text-ink-3">
                {windowed.years[0]}–{windowed.years.at(-1)}
                {windowed.years[0] !== signal!.years[0] ? ` (of ${signal!.years[0]}–${signal!.years.at(-1)})` : ""}
              </p>
            </div>

            <DataActions
              onDownload={() =>
                downloadCsv(
                  `${slug(country.name)}-${key}`,
                  ["year", `${key} (${unit})`],
                  windowed.years.map((y, i) => [y, windowed.series[i]]),
                  `${country.name}, ${key}. Full-record trend: ${signal!.trend ? formatSigned(signal!.trend.slopePerDecade, 2) + " " + unit + "/decade, " + formatP(signal!.trend.p) : "no trend"}.`,
                )
              }
            >
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-sunken text-xs text-ink-3">
                  <tr>
                    <th className="px-3 py-2 font-medium"><T en="Year" bn="বছর" /></th>
                    <th className="px-3 py-2 font-medium"><T en={`Value (${unit})`} bn={`মান (${unitBn(unit)})`} /></th>
                  </tr>
                </thead>
                <tbody>
                  {windowed.years.map((y, i) => (
                    <tr key={y} className="border-t border-line">
                      <td className="px-3 py-1.5 tabular-nums">{y}</td>
                      <td className="px-3 py-1.5 tabular-nums">{windowed.series[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataActions>
          </>
        )}
      </div>

      {variable === "extremes" && (
        <p className="mt-3 max-w-[70ch] text-xs text-ink-3">
          <T en={definition ?? ""} bn={DEFINITION_BN[key.split("_")[0]] ?? ""} />
        </p>
      )}

      {recentTrend && (
        <p className="mt-3 text-sm text-ink-3">
          <T
            en={`Across the whole record the trend is ${formatSigned(recentTrend.slopePerDecade, variable === "rainfall" ? 0 : 2)} ${unit} per decade (${formatP(recentTrend.p)}); the chart shows only the most recent 20 years.`}
            bn={`পুরো রেকর্ডে প্রবণতা ${formatSigned(recentTrend.slopePerDecade, variable === "rainfall" ? 0 : 2)} ${unitBn(unit)} প্রতি দশকে (${formatP(recentTrend.p)}); চার্টে কেবল সাম্প্রতিক ২০ বছর।`}
          />
        </p>
      )}
    </div>
  );
}

function EmptyTrend() {
  return (
    <p className="py-10 text-center text-sm text-ink-3">
      <T en="This measure is not available for the selected country or years." bn="নির্বাচিত দেশ বা সময়ের জন্য এই পরিমাপ নেই।" />
    </p>
  );
}

/** The observed range: lowest to highest year, as a compact strip. */
function RangeStrip({ years, series, unit }: { years: number[]; series: number[]; unit: string }) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const minYear = years[series.indexOf(min)];
  const maxYear = years[series.indexOf(max)];
  return (
    <div className="py-4">
      <div className="relative h-10 rounded-lg bg-sunken">
        {series.map((v, i) => (
          <span
            key={years[i]}
            className="absolute top-0 h-full w-[3px] rounded bg-accent/50"
            style={{ left: `${((v - min) / span) * 100}%` }}
            title={`${years[i]}: ${v}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-3">
        <span>
          {min} {unit} <T en="in" bn="সালে" /> {minYear}
        </span>
        <span>
          {max} {unit} <T en="in" bn="সালে" /> {maxYear}
        </span>
      </div>
    </div>
  );
}
