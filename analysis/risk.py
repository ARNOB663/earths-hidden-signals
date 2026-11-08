"""Hazard risk model: can a year's climate tell a high-event year from an ordinary one, and if so,
how does NASA's projected climate shift the odds?

For each region we fit a small, explainable model (L2 logistic regression) on the climate drivers
the hazard pipeline already assigned to it (hazards/zones.json "drivers", fixed before this model
existed, so the drivers are not picked to make the score look good). Regions are modelled one by
one because their hazards work differently (the Bengal delta floods from rain far upstream, the
Indus plain from rain on the plain). Each model is judged only on years it never saw
(leave-one-year-out) against the honest baseline of always guessing the base rate (Brier skill
score), plus ROC AUC and a label-permutation test for "could this skill be luck?". Every region is
reported, skilful or not. Only a skilful model is used for the future: each observed year's drivers
are shifted by each climate model's projected change (future.py), and the mean predicted chance is
compared with today's.

Labels: hazards/zones.json "highEventYears" (years at or above a region's 75th-percentile event
count: GDACS floods 2000-2025, NASA Global Landslide Catalog 2007-2017, FIRMS fires 2003-2024).
Drivers: the same NASA GPCP / GISTEMP series as the trend pages (trends/zones.json).

    python risk.py            # after build_hazards.py and future.py
"""

from __future__ import annotations

import json
import warnings
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score

ROOT = Path(__file__).parent
DATA = ROOT.parent / "web" / "public" / "data"
OUT = DATA / "risk"
PERMUTATIONS = 200
SEED = 20261114

# driver key in trends/zones.json -> (label, future.py metric, how the projected change applies)
DRIVERS = {
    "rainfall_monsoon": ("Monsoon rain", "monsoonRain", "pct"),
    "heavy-rain_annual": ("Very heavy rain days", "heavyDays", "pct"),
    "wettest-day_annual": ("Rain on the wettest day", "wettestDay", "pct"),
    "temperature_pre-monsoon": ("Hot-season temperature", "preTemp", "abs"),
    "rainfall_pre-monsoon": ("Hot-season rain", "preRain", "pct"),
}
HAZARDS = ("flood", "landslide", "wildfire")
SKILL_RULE = {"bss": 0.0, "auc": 0.65, "p": 0.10}


def load() -> tuple[dict, dict, dict, dict]:
    hazards = {z["id"]: z for z in json.loads((DATA / "hazards" / "zones.json").read_text(encoding="utf-8"))["zones"]}
    trends = {z["id"]: z for z in json.loads((DATA / "trends" / "zones.json").read_text(encoding="utf-8"))["zones"]}
    manifest = json.loads((DATA / "trends" / "manifest.json").read_text(encoding="utf-8"))
    outlook = json.loads((DATA / "future" / "outlook.json").read_text(encoding="utf-8"))
    return hazards, trends, manifest, outlook


def driver_years(key: str, manifest: dict) -> list[int]:
    var = key.split("_")[0]
    return manifest["variables"][var].get("years") or manifest["years"]


def region_table(zid: str, keys: list[str], hazards: dict, trends: dict, manifest: dict):
    """Rows for one region: years, raw drivers [n, k], labels [n], plus each driver's record mean/sd."""
    hz = hazards[zid]
    years, raw = [], []
    stats = {}
    for k in keys:
        series = trends[zid]["results"][k]["series"]
        yrs = driver_years(k, manifest)
        vals = np.array([np.nan if v is None else v for v in series], dtype=float)
        stats[k] = (float(np.nanmean(vals)), float(np.nanstd(vals)), dict(zip(yrs, vals)))
    for y in hz["years"]:
        row = [stats[k][2].get(y, np.nan) for k in keys]
        if all(np.isfinite(row)):
            years.append(y)
            raw.append(row)
    labels = np.array([1 if y in hz["highEventYears"] else 0 for y in years])
    return np.array(years), np.array(raw), labels, {k: stats[k][:2] for k in keys}


def standardise(raw: np.ndarray, keys: list[str], stats: dict) -> np.ndarray:
    return np.column_stack([(raw[:, i] - stats[k][0]) / (stats[k][1] or 1) for i, k in enumerate(keys)])


def new_model() -> LogisticRegression:
    return LogisticRegression(C=0.5, max_iter=1000)


def loyo(X: np.ndarray, y: np.ndarray, years: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Leave-one-year-out predictions and the matching base-rate baseline."""
    pred = np.zeros(len(y))
    base = np.zeros(len(y))
    for yr in np.unique(years):
        test = years == yr
        train = ~test
        base[test] = y[train].mean()
        if y[train].min() == y[train].max():
            pred[test] = y[train].mean()
            continue
        m = new_model().fit(X[train], y[train])
        pred[test] = m.predict_proba(X[test])[:, 1]
    return pred, base


def lpo_auc(X: np.ndarray, y: np.ndarray) -> float:
    """Leave-pair-out AUC (Airola et al. 2011): for every (high, ordinary) pair, train without both
    and count how often the high year gets the higher chance. Pooled leave-one-out AUC is biased
    towards 0 on small samples (dropping a high year lowers the training base rate), this is not."""
    pos = np.nonzero(y == 1)[0]
    neg = np.nonzero(y == 0)[0]
    if len(pos) == 0 or len(neg) == 0:
        return float("nan")
    wins = 0.0
    for i in pos:
        for j in neg:
            train = np.ones(len(y), dtype=bool)
            train[[i, j]] = False
            if y[train].min() == y[train].max():
                wins += 0.5
                continue
            p = new_model().fit(X[train], y[train]).predict_proba(X[[i, j]])[:, 1]
            wins += 1.0 if p[0] > p[1] else 0.5 if p[0] == p[1] else 0.0
    return wins / (len(pos) * len(neg))


def scores(X, y, pred, base) -> dict:
    brier = brier_score_loss(y, pred)
    ref = brier_score_loss(y, base)
    return {"brier": brier, "brierBaseline": ref, "bss": 1 - brier / ref if ref > 0 else float("nan"), "auc": lpo_auc(X, y)}


def permutation_p(X, y, observed_auc, rng) -> float:
    """Share of label shuffles (same number of high-event years) whose leave-pair-out AUC is at least as high."""
    if not np.isfinite(observed_auc):
        return float("nan")
    hits = 0
    for _ in range(PERMUTATIONS):
        if lpo_auc(X, rng.permutation(y)) >= observed_auc:
            hits += 1
    return (hits + 1) / (PERMUTATIONS + 1)


def bh_adjust(p_values: list[float]) -> list[float]:
    """Benjamini-Hochberg adjusted p-values (monotone, capped at 1)."""
    p = np.asarray(p_values, dtype=float)
    order = np.argsort(p)
    ranked = p[order] * len(p) / (np.arange(len(p)) + 1)
    adj = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty_like(adj)
    out[order] = np.minimum(adj, 1.0)
    return [float(v) for v in out]


def shift(raw: np.ndarray, keys: list[str], metrics: dict, model: str, outlook: dict, present: dict) -> np.ndarray:
    """Observed drivers moved by one climate model's projected change (the delta method)."""
    out = raw.copy()
    for i, k in enumerate(keys):
        metric, how = DRIVERS[k][1], DRIVERS[k][2]
        change = metrics[metric]["perModel"][model]
        if how == "abs":
            out[:, i] = raw[:, i] + change
        elif outlook["metrics"][metric]["kind"] == "pct":
            out[:, i] = raw[:, i] * (1 + change / 100)
        else:  # an absolute model change applied as a relative one (e.g. heavy-rain days)
            out[:, i] = raw[:, i] * (1 + change / (present[metric] or 1))
    return out


def main() -> None:
    hazards, trends, manifest, outlook = load()
    future = {r["id"]: r for r in outlook["regions"]}
    rng = np.random.default_rng(SEED)
    fits = []
    for zid, hz in hazards.items():
        if hz["hazard"] not in HAZARDS or zid not in trends:
            continue
        keys = [d["key"] for d in hz["drivers"] if d["key"] in DRIVERS]
        years, raw, y, stats = region_table(zid, keys, hazards, trends, manifest)
        X = standardise(raw, keys, stats)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            pred, base = loyo(X, y, years)
            sc = scores(X, y, pred, base)
            p_perm = permutation_p(X, y, sc["auc"], rng)
        fits.append((zid, hz, keys, years, raw, y, stats, X, pred, sc, p_perm))

    # Eight regions are tested, so one could pass by luck: the same false-discovery-rate control the
    # trend map uses decides which p-values survive.
    p_adj = bh_adjust([f[10] for f in fits])
    regions_out = []
    for (zid, hz, keys, years, raw, y, stats, X, pred, sc, p_perm), pa in zip(fits, p_adj):
        skillful = bool(sc["bss"] > SKILL_RULE["bss"] and sc["auc"] >= SKILL_RULE["auc"] and pa <= SKILL_RULE["p"])
        final = new_model().fit(X, y)
        print(f"{zid:22s} {hz['hazard']:9s} n={len(y)} high={int(y.sum())} AUC={sc['auc']:.2f} "
              f"BSS={sc['bss']:+.2f} perm p={p_perm:.3f} adj={pa:.3f} -> {'SKILL' if skillful else 'no skill'}")
        entry = {
            "id": zid,
            "name": hz["name"],
            "hazard": hz["hazard"],
            "eventSource": hz.get("eventSource", ""),
            "drivers": [{"key": k, "label": DRIVERS[k][0], "coef": round(float(c), 3)} for k, c in zip(keys, final.coef_[0])],
            "n": int(len(y)),
            "events": int(y.sum()),
            "years": [int(years.min()), int(years.max())],
            "cv": {
                "auc": round(float(sc["auc"]), 3),
                "brier": round(float(sc["brier"]), 4),
                "brierBaseline": round(float(sc["brierBaseline"]), 4),
                "bss": round(float(sc["bss"]), 3),
                "permutationP": round(float(p_perm), 4),
                "adjustedP": round(float(pa), 4),
                "permutations": PERMUTATIONS,
            },
            "skillful": skillful,
            "backtest": [{"year": int(yr), "p": round(float(pr), 3), "high": int(lab)} for yr, pr, lab in zip(years, pred, y)],
            "future": None,
        }
        if skillful and zid in future:
            present_p = float(final.predict_proba(X)[:, 1].mean())
            observed_rate = float(y.mean())
            fut_out = {"observedRate": round(observed_rate, 3), "scenarios": {}}
            for sc_key in outlook["scenarios"]:
                metrics = future[zid]["scenarios"][sc_key]["metrics"]
                ratios = {}
                for model in outlook["models"]:
                    shifted = shift(raw, keys, metrics, model, outlook, future[zid]["present"])
                    fut = float(final.predict_proba(standardise(shifted, keys, stats))[:, 1].mean())
                    ratios[model] = fut / present_p if present_p > 0 else float("nan")
                r = np.array(list(ratios.values()))
                fut_out["scenarios"][sc_key] = {
                    "ratio": round(float(np.median(r)), 2),
                    "min": round(float(r.min()), 2),
                    "max": round(float(r.max()), 2),
                    "futureRate": round(min(0.95, observed_rate * float(np.median(r))), 3),
                    "perModel": {m: round(float(v), 2) for m, v in ratios.items()},
                }
            entry["future"] = fut_out
        regions_out.append(entry)

    OUT.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated": date.today().isoformat(),
        "method": "Per-region L2 logistic regression on the region's pre-assigned NASA GPCP/GISTEMP drivers; "
                  f"leave-one-year-out Brier skill vs base rate; leave-pair-out ROC AUC; {PERMUTATIONS}-shuffle permutation test, Benjamini-Hochberg across regions",
        "skillRule": SKILL_RULE,
        "models": outlook["models"],
        "future": outlook["future"],
        "regions": regions_out,
    }
    (OUT / "model.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Wrote {OUT / 'model.json'}")
    for r in regions_out:
        if r["future"]:
            s = r["future"]["scenarios"]["ssp585"]
            print(f"  {r['id']:22s} high-{r['hazard']}-year odds x{s['ratio']} ({s['min']}-{s['max']}), "
                  f"{r['future']['observedRate']:.0%} -> {s['futureRate']:.0%}")


if __name__ == "__main__":
    main()
