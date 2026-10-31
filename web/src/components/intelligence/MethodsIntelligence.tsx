// The /methods reference for the intelligence engine. Every rule and number here is read from
// thresholds.json, sources.json and evaluation.json (written by the Python pipeline); nothing
// is restated by hand, so the page cannot drift from the code.

import { FORECAST_FIELDS, FORECAST_GAP } from "@/lib/intelligence/forecast";
import type { Evaluation, Sources, Thresholds } from "@/lib/intelligence/types";

const th = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-ink-3";
const td = "px-4 py-2.5 align-top";
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="pt-2 text-[15px] font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ caption, head, rows, min = 560 }: { caption: string; head: string[]; rows: React.ReactNode[][]; min?: number }) {
  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm" style={{ minWidth: min }}>
          <thead className="bg-sunken">
            <tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line bg-card">
            {rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className={`${td} ${j === 0 ? "font-medium text-ink" : "text-ink-2"}`}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="text-xs leading-relaxed text-ink-3">{caption}</figcaption>
    </figure>
  );
}

export function MethodsIntelligence({ thresholds: t, sources, evaluation: e }: { thresholds: Thresholds; sources: Sources; evaluation: Evaluation }) {
  const m = e.metrics;
  return (
    <>
      <p>
        The intelligence engine (<code className="rounded bg-sunken px-1.5 text-ink">analysis/intel/</code>) turns the trend
        outputs into a screening report for every country, research region, the study area and {""}
        listed cities. It answers seven questions (what is happening, is it normal, how unusual, is it getting worse, what
        could happen, how reliable, what to do) from computed values only. The web app renders the result and never
        recomputes a class. Assessment of {sources.asOf}; thresholds <code className="rounded bg-sunken px-1.5 text-ink">{t.thresholdsId}</code>.
      </p>

      <Block title="Baselines and periods">
        <ul className="list-disc space-y-1 pl-5 marker:text-ink-3">
          <li>
            Baseline {t.baseline.id}: {t.baseline.length} years ({t.baseline.years[0]}–{t.baseline.years[1]} inclusive). Daily-derived
            indicators use {t.baseline.dailyId} ({t.baseline.dailyLength} years), because GPCP 1DD starts in October 1996.
          </li>
          <li>{t.baseline.comparison}</li>
          <li>
            Missing data: an anomaly needs at least {t.baseline.minValues} baseline values and at least {t.baseline.minCoveragePct}% of
            the location&apos;s weighted land cells with a value; otherwise the indicator is reported as unavailable with its reason.
          </li>
          <li>
            Real-time replays (history, backtest) classify a year only against baseline years before it, so no future value
            enters a past assessment.
          </li>
        </ul>
      </Block>

      <Block title="Classification">
        <Grid
          caption={`Classes (${t.thresholdsId}), evaluated from the top. Percentile is primary and sets the direction; z = (value − baseline mean) / baseline SD counts only when it points the same way. ${t.percentileMethod}`}
          head={["Class", "Rule", "Rationale"]}
          rows={[...t.classes].reverse().map((c) => [c.class, <code key="r" className="text-xs">{c.rule}</code>, c.rationale])}
        />
      </Block>

      <Block title="Composite rainfall">
        <p>{t.composite.rule}</p>
        <p className="text-sm text-ink-3">
          Components: seasonal or annual total (GPCP monthly), mean daily intensity (reported only), very heavy rain days and
          wettest day (GPCP 1DD, calendar year), and the longest monsoon dry spell (GPCP 1DD, June–September). Consecutive
          wet days and dry-day counts need the daily cache and are listed as unavailable on each report.
        </p>
      </Block>

      <Block title="Heat and heatwaves">
        <p>
          Heat screening compares seasonal mean surface temperature (GISTEMP, 2°) with the same season in 1991–2020.
          Heatwaves are not assessed: the project has no daily temperature record. Cards are titled &ldquo;Heat: seasonal
          warmth&rdquo; so they cannot be read as a heatwave forecast.
        </p>
      </Block>

      <Block title="Alert thresholds">
        <Grid
          caption={`${t.alerts.id}. Internal alerts are keyed by (location, hazard): re-detection extends the open alert, a change of severity closes it and opens a new one, and a quiet period expires it. Every internal alert begins “${t.alerts.prefixEn}” Official GDACS records are shown beside them, attributed and never re-scaled.`}
          head={["Hazard", "Severity", "Rule"]}
          rows={t.alerts.rules.map((r) => [r.hazard, r.severity, r.rule])}
        />
        <p className="text-sm text-ink-3">Overall level: {t.levels.rule}</p>
      </Block>

      <Block title="Confidence: four separate grades">
        <Grid
          caption={`${t.confidence.id}. Grades are never combined. Coverage between ${t.baseline.minCoveragePct}% and ${t.confidence.coverageFullPct}%, or an observation more than ${t.confidence.lateDaysDegraded} days past the dataset's usual delay, counts as one degradation. City reports are capped one grade below their source area.`}
          head={["Grade", "Observation quality", "Anomaly assessment", "Hazard screening", "Validation"]}
          min={760}
          rows={[
            ["High", "Full baseline, ≥ 75% coverage, on time", "≥ 1.5 rank steps from a class boundary, 30-year baseline", "Linked driver and event record", "An independent source agrees"],
            ["Moderate", "One degradation", "Adequate sample or modest margin", "Linked driver or event record", "A same-input-family source agrees"],
            ["Low", "Two degradations, or fallback geography", "Within one rank step of a boundary, or conflicting components", "Neither", "Sources disagree or none usable"],
            ["Insufficient", `< ${t.baseline.minValues} baseline values or coverage < ${t.baseline.minCoveragePct}%`, "Not computable", "Not computable", "No second source"],
          ]}
        />
      </Block>

      <Block title="Validation and independence">
        <Grid
          caption="Nothing is labelled independent unless the two records share no inputs. No independent rainfall source is available offline, so the validation grade can reach at most moderate."
          head={["Records", "Independence", "Why"]}
          rows={sources.lineage.map((l) => [l.pair.join(" vs "), l.independence, l.why])}
        />
      </Block>

      <Block title="Geography and resolution">
        <p>
          Countries use the country polygon area in each grid cell × cos(latitude); research regions and the study area use the
          share of each cell inside the box × cos(latitude), land cells only. Cities borrow the containing research region, else
          the containing country, else the whole study area, and every city report states which. GISTEMP is a 2° grid (about
          220 km), GPCP monthly 2.5° (about 280 km), GPCP 1DD 1° (about 110 km), CRU TS 0.5°. All values are grid averages,
          not point measurements.
        </p>
      </Block>

      <Block title="Freshness">
        <Grid
          caption={`Age is measured from the end of the observed period to the assessment date. A dataset is stale when it is more than ${t.freshness.staleAfterDays} days past its usual publication delay. These are climate-scale monthly and seasonal analyses published weeks to months later, never current weather.`}
          head={["Dataset", "Version", "Observed through", "Usual delay (days)", "Stale"]}
          rows={sources.datasets.map((d) => [d.name, d.version, d.products.map((p) => p.observedThrough).join(", "), d.expectedLagDays ?? "closed", d.stale ? "yes" : "no"])}
        />
        {sources.degraded.map((d) => (
          <p key={d} className="text-sm text-ink-3">{d}</p>
        ))}
      </Block>

      <Block title="Evaluation">
        <div id="evaluation" className="scroll-mt-24" />
        <p>{e.eventDefinition}</p>
        <Grid
          caption="All six metrics come from evaluation.json. A metric that cannot be computed is shown with its reason instead of a number."
          head={["Metric", "Value", "Definition or reason"]}
          min={700}
          rows={[
            ["Anomaly detection accuracy", m.anomalyDetectionAccuracy.value == null ? "—" : `${m.anomalyDetectionAccuracy.value}% (n = ${m.anomalyDetectionAccuracy.n}, ${m.anomalyDetectionAccuracy.window?.join("–") ?? ""})`, m.anomalyDetectionAccuracy.definition],
            ["False-alarm rate", `${pct(m.falseAlarmRate.value)} (${Object.entries(m.falseAlarmRate.byHazard).map(([h, v]) => `${h} ${pct(v)}`).join(", ")})`, m.falseAlarmRate.definition],
            ["Missed events", pct(m.missedEvents.value), m.missedEvents.definition],
            ["Lead time", "Not computable", m.leadTime.reason],
            ["Confidence calibration", Object.entries(m.confidenceCalibration.byGrade).map(([g, v]) => `${g} ${v.pct}% (n = ${v.n})`).join("; "), `${m.confidenceCalibration.definition}${m.confidenceCalibration.monotonic ? " Higher grades agreed more often." : ""}`],
            ["Geographic coverage", `${Object.values(m.geographicCoverage.value).every((v) => v.pct === 100) ? "100% for every variable" : Object.entries(m.geographicCoverage.value).map(([k, v]) => `${k} ${v.pct}%`).join(", ")}`, m.geographicCoverage.definition],
          ]}
        />
        <Grid
          caption="Backtest per hazard region over the years each real-time assessment was computable. Hits: flagged event years. Misses: event years without a flag. False alarms: flagged years that were not event years."
          head={["Region", "Hazard", "Years", "Hits", "Misses", "False alarms", "Note"]}
          min={700}
          rows={Object.values(e.backtest).map((b) => [
            b.regionId,
            b.hazard,
            b.window ? b.window.join("–") : "—",
            b.hits ?? "—",
            b.misses ?? "—",
            b.falseAlarms ?? "—",
            b.available ? "" : (b.reason ?? ""),
          ])}
        />
        <p>
          Reading: seasonal screening rarely flagged the years with the most recorded events, so it has little skill as an
          early warning for these hazards. That is consistent with the weak or absent driver links in the hazard analysis
          (section 6), and is why every page says screening, not forecast. A CI check fails if any false-alarm rate rises more
          than {Math.round(t.evaluation.falseAlarmTolerance * 100)} percentage points above the committed baseline.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-3 marker:text-ink-3">
          {e.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </Block>

      <Block title="Forecast contract">
        <p>{FORECAST_GAP.en}</p>
        <ul className="list-disc space-y-1 pl-5 marker:text-ink-3">
          {FORECAST_FIELDS.map((f) => <li key={f.key}>{f.en}</li>)}
        </ul>
      </Block>
    </>
  );
}
