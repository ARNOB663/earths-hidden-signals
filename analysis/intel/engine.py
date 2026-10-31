"""Assessment engine: per-geography indicators, rainfall composites and hazard screening.

Inputs are yearly series per calendar period (seasons from the committed trend outputs, or
months from a --refresh run). Every year is classified "in real time": against the baseline
years strictly before it, so history replays never use future data. From 2021 on that is the
full 1991-2020 normal, identical to the current assessment.
"""

from __future__ import annotations

from datetime import date

import numpy as np

from . import alerts as rules
from . import confidence as conf
from .anomalies import classify, duration, signed_level
from .composite import combine
from .periods import days_in_period, period_end, period_start, realtime_baseline_years
from .thresholds import BASELINE_ID, DAILY_BASELINE_ID, EXPECTED_LAG_DAYS, MIN_COVERAGE_PCT, STALE_AFTER_DAYS, THRESHOLDS_ID

# variable -> metadata. `observed` is the part of the year the value describes (dry-spell is a
# Jun-Sep measure published as an annual series).
VARIABLES = {
    "temperature": {"dataset": "gistemp", "daily": False, "unit": "°C", "decimals": 2, "grid": "temperature",
                    "labelEn": "Surface temperature", "labelBn": "ভূপৃষ্ঠের তাপমাত্রা",
                    "valueNoteEn": "anomaly vs 1951–1980 (GISTEMP); classified against 1991–2020",
                    "valueNoteBn": "GISTEMP অনুযায়ী ১৯৫১–১৯৮০ সালের তুলনায় অস্বাভাবিকতা; শ্রেণি ১৯৯১–২০২০ সালের বিপরীতে"},
    "rainfall": {"dataset": "gpcp-monthly", "daily": False, "unit": "mm", "decimals": 0, "grid": "rainfall",
                 "labelEn": "Rainfall total", "labelBn": "মোট বৃষ্টিপাত", "valueNoteEn": "period total", "valueNoteBn": "সময়কালের মোট"},
    "hot-months": {"dataset": "gistemp", "daily": False, "unit": "months", "decimals": 1, "grid": "hot-months",
                   "labelEn": "Very hot months", "labelBn": "অতি গরম মাস",
                   "valueNoteEn": "months at least 1 °C above the 1951–1980 average",
                   "valueNoteBn": "১৯৫১–১৯৮০ সালের গড়ের চেয়ে অন্তত ১ °সে বেশি গরম মাস"},
    "heavy-rain": {"dataset": "gpcp-daily", "daily": True, "unit": "days", "decimals": 1, "grid": "heavy-rain",
                   "labelEn": "Very heavy rain days", "labelBn": "অতি ভারী বৃষ্টির দিন",
                   "valueNoteEn": "days above the local 95th percentile of rainy days",
                   "valueNoteBn": "স্থানীয় বৃষ্টির দিনের ৯৫তম পার্সেন্টাইলের চেয়ে বেশি বৃষ্টির দিন"},
    "dry-spell": {"dataset": "gpcp-daily", "daily": True, "unit": "days", "decimals": 1, "grid": "dry-spell",
                  "observed": "monsoon", "labelEn": "Longest monsoon dry spell", "labelBn": "বর্ষার দীর্ঘতম শুষ্ক সময়",
                  "valueNoteEn": "longest run of days under 1 mm in June–September",
                  "valueNoteBn": "জুন–সেপ্টেম্বরে ১ মিমির কম বৃষ্টির টানা দীর্ঘতম দিন"},
    "wettest-day": {"dataset": "gpcp-daily", "daily": True, "unit": "mm", "decimals": 1, "grid": "wettest-day",
                    "labelEn": "Wettest day", "labelBn": "সবচেয়ে বৃষ্টির দিন", "valueNoteEn": "most rain on one day", "valueNoteBn": "এক দিনে সর্বোচ্চ বৃষ্টি"},
}
PERIODS = {"temperature": ["annual", "pre-monsoon", "monsoon"], "rainfall": ["annual", "pre-monsoon", "monsoon"],
           "hot-months": ["annual"], "heavy-rain": ["annual"], "dry-spell": ["annual"], "wettest-day": ["annual"]}

DATASETS = {
    "gistemp": {"name": "NASA GISTEMP v4", "version": "v4 (GHCNv4 + ERSSTv5, 1200 km smoothing)", "grid": [2.0, 2.0],
                "url": "https://data.giss.nasa.gov/gistemp/"},
    "gpcp-monthly": {"name": "GPCP v2.3 monthly precipitation", "version": "v2.3", "grid": [2.5, 2.5],
                     "url": "https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-monthly"},
    "gpcp-daily": {"name": "GPCP 1DD daily precipitation", "version": "v1.3", "grid": [1.0, 1.0],
                   "url": "https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-daily"},
}


def observed_period(var: str, period: str) -> str:
    return VARIABLES[var].get("observed", period)


def classify_year(years: list[int], values: list, year: int, daily: bool) -> dict:
    """Real-time classification of `year` (baseline = baseline years strictly before it)."""
    idx = {y: i for i, y in enumerate(years)}
    if year not in idx:
        return {"available": False, "reason": "year-not-in-record", "n": 0}
    base = [values[idx[y]] for y in realtime_baseline_years(year, daily) if y in idx and values[idx[y]] is not None]
    value = values[idx[year]]
    return classify(None if value is None else float(value), np.array(base, dtype=float))


class GeoSeries:
    """All yearly series for one geography, with cached real-time classes."""

    def __init__(self, geo_id: str, series: dict[str, dict]):
        self.id = geo_id
        self.series = series  # key "var_period" -> {years, series}
        self._cache: dict[tuple[str, str, int], dict] = {}

    def has(self, var: str, period: str) -> bool:
        return f"{var}_{period}" in self.series

    def get(self, var: str, period: str, year: int) -> dict:
        key = (var, period, year)
        if key not in self._cache:
            s = self.series.get(f"{var}_{period}")
            self._cache[key] = (
                {"available": False, "reason": "not-in-record", "n": 0}
                if s is None else classify_year(s["years"], s["series"], year, VARIABLES[var]["daily"])
            )
        return self._cache[key]

    def years(self, var: str, period: str) -> list[int]:
        s = self.series.get(f"{var}_{period}")
        return [] if s is None else list(s["years"])

    def intensity(self, period: str) -> dict:
        """Mean daily intensity = total / days, as its own series (reported, never counted)."""
        s = self.series[f"rainfall_{period}"]
        vals = [None if v is None else v / days_in_period(y, period) for y, v in zip(s["years"], s["series"])]
        return {"years": s["years"], "series": vals}

    def get_intensity(self, period: str, year: int) -> dict:
        key = ("intensity", period, year)
        if key not in self._cache:
            s = self.intensity(period)
            self._cache[key] = classify_year(s["years"], s["series"], year, False)
        return self._cache[key]


# --- Rainfall composite ---------------------------------------------------------------------

UNAVAILABLE_DAILY = {
    "consecutive-wet-days": ("Consecutive wet days (runs of days with at least 1 mm)",
                             "Needs the GPCP 1DD daily cache (analysis/raw/gpcp_daily), which is not in the committed record."),
    "dry-days": ("Dry days (days under 1 mm)",
                 "Needs the GPCP 1DD daily cache (analysis/raw/gpcp_daily), which is not in the committed record."),
    "heavy-rain-days-in-period": ("Very heavy rain days within this season",
                                  "Only calendar-year counts are published; a seasonal count needs the daily cache."),
}


def composite_components(g: GeoSeries, period: str, year: int) -> tuple[list[dict], list[dict]]:
    comps = [{"id": "total", "variable": "rainfall", "period": period, "highSide": "wet", "counted": True,
              "result": g.get("rainfall", period, year)},
             {"id": "intensity", "variable": "rainfall-intensity", "period": period, "highSide": "wet", "counted": False,
              "result": g.get_intensity(period, year),
              "noteEn": "Total ÷ days: always the same percentile as the total, so never counted."}]
    missing = []
    if period == "annual":
        for var in ("heavy-rain", "wettest-day"):
            comps.append({"id": var, "variable": var, "period": "annual", "highSide": "wet", "counted": True,
                          "result": g.get(var, "annual", year)})
        missing = ["consecutive-wet-days", "dry-days"]
    elif period == "monsoon":
        comps.append({"id": "dry-spell", "variable": "dry-spell", "period": "annual", "highSide": "dry", "counted": True,
                      "result": g.get("dry-spell", "annual", year)})
        missing = ["heavy-rain-days-in-period", "consecutive-wet-days", "dry-days"]
    else:
        missing = ["heavy-rain-days-in-period", "consecutive-wet-days", "dry-days"]
    unavailable = [{"id": m, "labelEn": UNAVAILABLE_DAILY[m][0], "reasonEn": UNAVAILABLE_DAILY[m][1]} for m in missing]
    return comps, unavailable


def composite_signed(g: GeoSeries, period: str, year: int) -> int:
    comps, _ = composite_components(g, period, year)
    c = combine(comps)
    if not c.get("available") or not c["level"]:
        return 0
    return c["level"] if c["direction"] == "high" else -c["level"]


# --- Indicator records ----------------------------------------------------------------------

def _round(v, d):
    return None if v is None else round(float(v), d)


def freshness(dataset: str, observed_through: date, as_of: date) -> dict:
    age = (as_of - observed_through).days
    lag = EXPECTED_LAG_DAYS.get(dataset)
    late = None if lag is None else max(0, age - lag)
    return {"observedThrough": observed_through.isoformat(), "ageDays": age, "expectedLagDays": lag,
            "lateDays": late, "stale": bool(late is not None and late > STALE_AFTER_DAYS)}


def indicator_record(g: GeoSeries, var: str, period: str, year: int, *, as_of: date, retrieved: str,
                     cov: dict | None, inputs: list[dict], fallback_obs: bool = False) -> dict:
    meta = VARIABLES[var]
    r = g.get(var, period, year)
    obs_period = observed_period(var, period)
    start, end = period_start(year, obs_period), period_end(year, obs_period)
    fresh = freshness(meta["dataset"], end, as_of)
    full_n = 24 if meta["daily"] else 30
    signed_hist = [signed_level(g.get(var, period, y)) for y in g.years(var, period) if y <= year]
    run = duration(signed_hist)
    d = meta["decimals"]
    available = r.get("available", False) and (cov is None or cov["coveragePct"] >= MIN_COVERAGE_PCT)
    reason = r.get("reason") if not r.get("available") else (None if available else "coverage-too-low")
    obs_conf = conf.observation(baseline_n=r.get("n", 0), full_baseline_n=full_n,
                                coverage_pct=None if cov is None else cov["coveragePct"],
                                late_days=fresh["lateDays"], fallback=fallback_obs, available=available)
    rec = {
        "id": f"{g.id}/{var}/{period}",
        "schema": "indicator-v1",
        "geographyId": g.id,
        "variable": var,
        "labelEn": meta["labelEn"],
        "labelBn": meta["labelBn"],
        "valueNoteEn": meta["valueNoteEn"],
        "valueNoteBn": meta["valueNoteBn"],
        "period": period,
        "observedPeriod": obs_period,
        "year": year,
        "observedAt": {"start": start.isoformat(), "end": end.isoformat()},
        **fresh,
        "retrievedAt": retrieved,
        "source": DATASETS[meta["dataset"]]["name"],
        "datasetId": meta["dataset"],
        "baselineId": DAILY_BASELINE_ID if meta["daily"] else BASELINE_ID,
        "thresholdsId": THRESHOLDS_ID,
        "unit": meta["unit"],
        "available": available,
        "reason": reason,
        "coverage": cov,
        "inputs": inputs,
        "confidence": {"observation": obs_conf, "anomaly": conf.anomaly(result=r) if available else conf.anomaly(result={})},
    }
    if r.get("available"):
        rec.update({
            "value": _round(r["value"], d),
            "baseline": {"n": r["n"], "mean": _round(r["mean"], d), "sd": _round(r["sd"], d + 1)},
            "percentile": round(r["percentile"], 1),
            "rankHigh": r["rankHigh"],
            "rankOf": r["n"] + 1,
            "zScore": None if r["zScore"] is None else round(r["zScore"], 2),
            "difference": _round(r["difference"], d),
            "ratioPct": None if var != "rainfall" or not r["mean"] else round(r["value"] / r["mean"] * 100),
            "class": r["class"] if available else None,
            "direction": r["direction"],
            "level": r["level"] if available else 0,
            "trigger": r["trigger"],
            "boundaryMarginSteps": round(r["boundaryMarginSteps"], 2),
        })
    rec["duration"] = {"periods": run, "sinceYear": year - run + 1 if run else None,
                       "unitEn": f"consecutive {obs_period if obs_period != 'annual' else 'year'} periods"}
    return rec


def composite_record(g: GeoSeries, period: str, year: int, indicator_ids: dict[str, str]) -> dict:
    comps, unavailable = composite_components(g, period, year)
    c = combine(comps)
    years = [y for y in g.years("rainfall", period) if y <= year]
    run = duration([composite_signed(g, period, y) for y in years])
    used_daily = [x["id"] for x in comps if x["variable"] in ("heavy-rain", "wettest-day", "dry-spell") and x["result"].get("available")]
    return {
        "id": f"{g.id}/rainfall-composite/{period}",
        "schema": "composite-v1",
        "geographyId": g.id,
        "period": period,
        "year": year,
        **c,
        "components": [
            {"id": x["id"], "variable": x["variable"], "period": x["period"], "counted": x["counted"], "highSide": x["highSide"],
             "indicatorId": indicator_ids.get(f"{x['variable']}_{x['period']}"),
             "available": bool(x["result"].get("available")),
             "class": x["result"].get("class"), "level": x["result"].get("level", 0),
             "direction": x["result"].get("direction"),
             "percentile": None if not x["result"].get("available") else round(x["result"]["percentile"], 1),
             "noteEn": x.get("noteEn")}
            for x in comps
        ],
        "unavailableComponents": unavailable,
        "dailyComponents": "available" if used_daily else "unavailable",
        "dailyComponentsReason": None if used_daily else "No daily (GPCP 1DD) component exists for this period in the committed record.",
        "duration": {"periods": run, "sinceYear": year - run + 1 if run else None},
        "thresholdsId": THRESHOLDS_ID,
        "baselineId": BASELINE_ID,
    }


# --- Hazard screening -----------------------------------------------------------------------

SCREEN_LEVEL = {None: "quiet", "info": "notable", "watch": "elevated", "warning": "high"}


def screen(g: GeoSeries, hazard: str, year: int, *, exposure: list[dict], hazard_zones: dict, latest_seasons: list[tuple[int, str]],
           linked_override: bool | None = "use") -> dict:
    """One hazard for one location in `year`. Returns {severity, evidence, note, period, linked, hasRecord}."""
    regions = [hazard_zones[e["regionId"]] for e in exposure if e["hazard"] == hazard]
    linked = any(d["linked"] for z in regions for d in z["drivers"])
    has_record = any(sum(z["counts"]) > 0 for z in regions)
    if hazard == "heat":
        y, p = latest_seasons[-1]
        prev = latest_seasons[-2] if len(latest_seasons) > 1 else None
        out = rules.heat(g.get, y, p, prev)
        return {**out, "period": p, "year": y, "linked": False, "hasRecord": False}
    if hazard == "dry":
        return {**rules.dry(g.get, year), "period": "monsoon", "year": year, "linked": False, "hasRecord": False}
    if hazard in ("flood", "landslide"):
        return {**rules.wet(g.get, year), "period": "monsoon", "year": year, "linked": linked, "hasRecord": has_record}
    if hazard == "wildfire":
        use = linked if linked_override == "use" else linked_override
        return {**rules.wildfire(g.get, year, use), "period": "pre-monsoon", "year": year, "linked": linked, "hasRecord": has_record}
    if hazard == "cyclone":
        best = {"severity": None, "evidence": [], "note": "no-driver-value"}
        for z in regions:
            res = rules.cyclone(z["drivers"][0] if z["drivers"] else None, year)
            if res["severity"] or not best["evidence"]:
                best = res
        return {**best, "period": "annual", "year": year, "linked": linked, "hasRecord": has_record}
    raise ValueError(hazard)


def applicable_hazards(exposure: list[dict]) -> list[str]:
    exposed = {e["hazard"] for e in exposure}
    return ["heat", "dry", *[h for h in ("flood", "landslide", "wildfire", "cyclone") if h in exposed]]
