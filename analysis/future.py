"""Future Outlook: how NASA's downscaled climate projections (NEX-GDDP-CMIP6) say each South Asian
hazard region changes by 2041-2060, relative to 1995-2014, under two emissions pathways.

Everything is computed per model against that model's own 1995-2014 run, so model bias cancels:
- Changes in averages (temperature, yearly and monsoon rain) and in extremes (very heavy rain days,
  wettest day, longest monsoon dry spell, days unusually hot for their calendar month), with the 6-model median, range and how
  many models agree on the direction.
- "Today's 1-in-10" events: the level a model reaches in only 2 of its 20 present-day years (its
  90th percentile; 10th for dry monsoons), and how often the same model crosses that level in
  2041-2060. This is the site's future-risk number: a count, not a black box.

Input: raw/cmip6/{model}/{scenario}/{pr,tas}_{year}.nc from cmip6_download.py.
Output: web/public/data/future/outlook.json

    python future.py             # all models that have complete files
"""

from __future__ import annotations

import json
import warnings
from datetime import date
from pathlib import Path

import netCDF4
import numpy as np

from cmip6_download import MODELS, PERIODS

ROOT = Path(__file__).parent
RAW = ROOT / "raw" / "cmip6"
OUT = ROOT.parent / "web" / "public" / "data" / "future"
SCENARIOS = {"ssp245": "Middle road (SSP2-4.5)", "ssp585": "High emissions (SSP5-8.5)"}
MONSOON = (6, 7, 8, 9)
WET_DAY = 1.0  # mm

METRICS = {
    # key: label, unit, kind ("abs" change or "pct" change), decimals
    "tMean": ("Average temperature", "°C", "abs", 1),
    "hotDays": ("Unusually hot days per year (for the time of year)", "days", "abs", 0),
    "annualRain": ("Yearly rain", "mm", "pct", 0),
    "monsoonRain": ("Monsoon rain (Jun–Sep)", "mm", "pct", 0),
    "heavyDays": ("Very heavy rain days per year", "days", "abs", 1),
    "wettestDay": ("Rain on the wettest day", "mm", "pct", 0),
    "drySpell": ("Longest monsoon dry spell", "days", "abs", 1),
}
# Today's 1-in-10 events: metric, which tail, plain name.
EXCEEDANCE = {
    "wetMonsoon": ("monsoonRain", "high", "A monsoon as wet as today's 1-in-10 wettest"),
    "dryMonsoon": ("monsoonRain", "low", "A monsoon as dry as today's 1-in-10 driest"),
    "heavyYear": ("heavyDays", "high", "A year with as many very heavy rain days as today's 1-in-10"),
    "hotYear": ("tMean", "high", "A year as hot as today's 1-in-10 hottest"),
}
HAZARD_FOCUS = {
    "flood": ["monsoonRain", "heavyDays", "wettestDay"],
    "landslide": ["heavyDays", "wettestDay", "monsoonRain"],
    "wildfire": ["hotDays", "drySpell", "tMean"],
    None: ["tMean", "monsoonRain", "heavyDays"],
}


def read_year(model: str, scenario: str, var: str, year: int):
    path = RAW / model / scenario / f"{var}_{year}.nc"
    with netCDF4.Dataset(path) as ds:
        lats, lons = ds["lat"][:].data, ds["lon"][:].data
        t = ds["time"]
        months = np.array([d.month for d in netCDF4.num2date(t[:], t.units, getattr(t, "calendar", "standard"))])
        data = np.ma.filled(ds[var][:].astype(float), np.nan)
    data = data * 86400.0 if var == "pr" else data - 273.15
    return lats, lons, months, data


def complete(model: str) -> bool:
    return all((RAW / model / s / f"{v}_{y}.nc").exists() for s, ys in PERIODS.items() for v in ("pr", "tas") for y in ys)


def longest_dry(days: np.ndarray) -> np.ndarray:
    run = np.zeros(days.shape[1:])
    best = np.zeros(days.shape[1:])
    for d in days:
        run = np.where(d < WET_DAY, run + 1, 0)
        best = np.maximum(best, run)
    return best


def zone_mask(bbox, lats, lons, land) -> np.ndarray:
    la0, la1, lo0, lo1 = bbox
    inside = ((lats >= la0) & (lats <= la1))[:, None] & ((lons >= lo0) & (lons <= lo1))[None, :]
    return np.where(inside & land, np.cos(np.deg2rad(lats))[:, None], 0.0)


def model_metrics(model: str, zones: list[dict]) -> dict:
    """{period: {zone_id: {metric: [values per year]}}} for one model."""
    lats, lons, _, first = read_year(model, "historical", "pr", PERIODS["historical"][0])
    land = np.isfinite(first).all(axis=0)
    weights = {z["id"]: zone_mask(z["bbox"], lats, lons, land) for z in zones}

    # Thresholds per grid cell from the model's own present-day run.
    hist_pr = [read_year(model, "historical", "pr", y)[3] for y in PERIODS["historical"]]
    hist = [read_year(model, "historical", "tas", y) for y in PERIODS["historical"]]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        allp = np.concatenate(hist_pr)
        heavy_thr = np.nanpercentile(np.where(allp >= WET_DAY, allp, np.nan), 95, axis=0)
        # Unusually hot for the time of year: each calendar month's own 95th percentile, so a warm
        # season does not count as "very hot" just because summer is hotter than winter.
        all_t = np.concatenate([h[3] for h in hist])
        all_m = np.concatenate([h[2] for h in hist])
        hot_thr = np.stack([np.nanpercentile(all_t[all_m == mo], 95, axis=0) for mo in range(1, 13)])
    del allp, all_t

    out: dict = {}
    for period, years in PERIODS.items():
        out[period] = {z["id"]: {k: [] for k in METRICS} for z in zones}
        for y in years:
            _, _, months, pr = read_year(model, period, "pr", y)
            _, _, _, tas = read_year(model, period, "tas", y)
            mon = np.isin(months, MONSOON)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                cell = {
                    "tMean": np.nanmean(tas, axis=0),
                    "hotDays": (tas > hot_thr[months - 1]).sum(axis=0).astype(float),
                    "annualRain": np.nansum(pr, axis=0),
                    "monsoonRain": np.nansum(pr[mon], axis=0),
                    "heavyDays": (pr > heavy_thr).sum(axis=0).astype(float),
                    "wettestDay": np.nanmax(pr, axis=0),
                    "drySpell": longest_dry(pr[mon]),
                }
            for zid, w in weights.items():
                tot = w.sum()
                for k, field in cell.items():
                    out[period][zid][k].append(float(np.nansum(np.where(w > 0, field, 0) * w) / tot) if tot else np.nan)
    return out


def summarise(per_model: dict[str, dict], zones: list[dict]) -> list[dict]:
    models = list(per_model)
    regions = []
    for z in zones:
        zid = z["id"]
        entry = {"id": zid, "name": z["name"], "hazard": z.get("hazard"), "focus": HAZARD_FOCUS[z.get("hazard")], "scenarios": {}}
        present = {k: {m: float(np.mean(per_model[m]["historical"][zid][k])) for m in models} for k in METRICS}
        entry["present"] = {k: round(float(np.median(list(v.values()))), METRICS[k][3]) for k, v in present.items()}
        for sc in SCENARIOS:
            res = {"metrics": {}, "exceedance": {}}
            for k, (_, _, kind, dec) in METRICS.items():
                changes = {}
                for m in models:
                    h = present[k][m]
                    f = float(np.mean(per_model[m][sc][zid][k]))
                    changes[m] = (f - h) / h * 100 if kind == "pct" and h else f - h
                vals = np.array(list(changes.values()))
                med = float(np.median(vals))
                agree = int((np.sign(vals) == np.sign(med)).sum()) if med != 0 else 0
                d = 1 if kind == "pct" else dec + 1
                res["metrics"][k] = {
                    "median": round(med, d), "min": round(float(vals.min()), d), "max": round(float(vals.max()), d),
                    "agree": agree, "perModel": {m: round(v, d) for m, v in changes.items()},
                }
            for key, (k, tail, _) in EXCEEDANCE.items():
                rates = {}
                for m in models:
                    hist = np.array(per_model[m]["historical"][zid][k])
                    fut = np.array(per_model[m][sc][zid][k])
                    if tail == "high":
                        thr = np.percentile(hist, 90)
                        rates[m] = float((fut > thr).mean())
                    else:
                        thr = np.percentile(hist, 10)
                        rates[m] = float((fut < thr).mean())
                r = np.array(list(rates.values()))
                res["exceedance"][key] = {
                    "today": 0.1, "median": round(float(np.median(r)), 3), "min": round(float(r.min()), 3),
                    "max": round(float(r.max()), 3), "perModel": {m: round(v, 3) for m, v in rates.items()},
                }
            entry["scenarios"][sc] = res
        regions.append(entry)
    return regions


def main() -> None:
    zones = json.loads((ROOT / "zones.json").read_text(encoding="utf-8"))["zones"]
    models = [m for m in MODELS if complete(m)]
    skipped = [m for m in MODELS if m not in models]
    if not models:
        raise SystemExit("No model has complete files yet; run cmip6_download.py first.")
    print(f"Models: {', '.join(models)}" + (f" (incomplete, skipped: {', '.join(skipped)})" if skipped else ""))
    per_model = {}
    for m in models:
        print(f"  {m}")
        per_model[m] = model_metrics(m, zones)
    OUT.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated": date.today().isoformat(),
        "dataset": "NASA NEX-GDDP-CMIP6 (Thrasher et al. 2022), daily, bias-corrected and downscaled to 0.25°, used at 1°",
        "datasetUrl": "https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6",
        "models": models,
        "present": [PERIODS["historical"][0], PERIODS["historical"][-1]],
        "future": [PERIODS["ssp245"][0], PERIODS["ssp245"][-1]],
        "scenarios": SCENARIOS,
        "metrics": {k: {"label": l, "unit": u, "kind": kd, "decimals": d} for k, (l, u, kd, d) in METRICS.items()},
        "exceedance": {k: {"metric": m, "tail": t, "label": l} for k, (m, t, l) in EXCEEDANCE.items()},
        "regions": summarise(per_model, zones),
    }
    (OUT / "outlook.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Wrote {OUT / 'outlook.json'}")
    for r in payload["regions"]:
        s = r["scenarios"]["ssp585"]
        print(f"  {r['id']:24s} T {s['metrics']['tMean']['median']:+.1f}°C  monsoon {s['metrics']['monsoonRain']['median']:+.0f}% "
              f"({s['metrics']['monsoonRain']['agree']}/{len(models)})  wet 1-in-10 -> {s['exceedance']['wetMonsoon']['median']:.0%}")


if __name__ == "__main__":
    main()
