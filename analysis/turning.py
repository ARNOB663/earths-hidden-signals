"""Turning points: where does each region's record split most sharply into "before" and "after"?

Pettitt's test (Pettitt 1979), a rank-based change-point test that needs no assumption about the
shape of the data. For every region and every result in trends/zones.json it reports the most
likely split year, the averages before and after it, and the approximate p-value. A split is only
called clear at p < 0.05. A steady trend also produces a split near its middle, so the site words
this as "the record splits around YEAR", not "the change began in YEAR".

    python turning.py        # offline; reads web/public/data/trends/{zones,manifest}.json
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

DATA = Path(__file__).parent.parent / "web" / "public" / "data" / "trends"


def pettitt(x: np.ndarray) -> tuple[int, float, float]:
    """Returns (index of the first 'after' value, K statistic, approximate two-sided p)."""
    x = np.asarray(x, dtype=float)
    n = x.size
    sign = np.sign(x[None, :] - x[:, None])  # sign[i, j] = sign(x_j - x_i)
    u = np.array([sign[: t + 1, t + 1 :].sum() for t in range(n - 1)])
    t = int(np.argmax(np.abs(u)))
    k = float(np.abs(u[t]))
    p = min(1.0, 2.0 * np.exp(-6.0 * k**2 / (n**3 + n**2)))
    return t + 1, k, p


def main() -> None:
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    zones = json.loads((DATA / "zones.json").read_text(encoding="utf-8"))["zones"]
    out = {}
    for z in zones:
        out[z["id"]] = {}
        for key, res in z["results"].items():
            var = key.split("_")[0]
            years = manifest["variables"][var].get("years") or manifest["years"]
            series = np.array([np.nan if v is None else v for v in res["series"]], dtype=float)
            if np.isnan(series).any() or series.size < 15:
                continue
            idx, k, p = pettitt(series)
            out[z["id"]][key] = {
                "year": int(years[idx]),
                "before": round(float(series[:idx].mean()), 3),
                "after": round(float(series[idx:].mean()), 3),
                "p": round(float(p), 5),
            }
    (DATA / "turning.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    clear = sum(1 for z in out.values() for r in z.values() if r["p"] < 0.05)
    print(f"Wrote {DATA / 'turning.json'}: {clear} clear splits")
    for zid in ("study-area", "bengal-delta", "indus-plain"):
        for key in ("temperature_annual", "rainfall_monsoon"):
            r = out[zid].get(key)
            if r:
                print(f"  {zid:14s} {key:20s} split {r['year']}  {r['before']} -> {r['after']}  p={r['p']}")


if __name__ == "__main__":
    main()
