"""Two planet-wide signals for the home page: September Arctic sea ice and global CO2, 1981-2025.

- Arctic sea ice: NSIDC Sea Ice Index v4 (G02135), September extent (the yearly minimum), million km2.
  The satellite record behind it is NASA's passive-microwave series (Nimbus-7 SMMR, DMSP SSM/I-SSMIS).
- CO2: NOAA Global Monitoring Laboratory, global monthly mean of marine surface sites, ppm; annual means.

Both are tested exactly like every other series on the site: Hamed-Rao modified Mann-Kendall for
significance and Sen's slope with a 95% confidence interval (stats.trend). Both files are small CSVs
served without a login; they are cached in raw/signals/ (gitignored).

Output: web/public/data/global/signals.json
"""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import numpy as np
import requests

from stats import trend

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw" / "signals"
OUT = ROOT.parent / "web" / "public" / "data" / "global" / "signals.json"
YEARS = list(range(1981, 2026))

SEA_ICE_URL = "https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_09_extent_v4.0.csv"
CO2_URL = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_gl.csv"


def fetch(url: str) -> str:
    """Return the file's text, downloading it once into raw/signals/."""
    path = RAW / url.rsplit("/", 1)[1]
    if not path.exists():
        RAW.mkdir(parents=True, exist_ok=True)
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        path.write_bytes(r.content)
    return path.read_text(encoding="utf-8")


def parse_sea_ice(text: str) -> dict[int, float]:
    """September extent by year from the NSIDC monthly CSV (missing values are negative)."""
    rows = csv.reader(io.StringIO(text), skipinitialspace=True)
    next(rows)
    out = {}
    for row in rows:
        if len(row) >= 5 and row[0].strip().isdigit():
            value = float(row[4])
            if value > 0:
                out[int(row[0])] = value
    return out


def parse_co2(text: str) -> dict[int, float]:
    """Annual mean CO2 for years with all 12 months, from NOAA's monthly global CSV."""
    months: dict[int, list[float]] = {}
    lines = [line for line in text.splitlines() if line and not line.startswith("#")]
    for row in csv.DictReader(lines):
        months.setdefault(int(row["year"]), []).append(float(row["average"]))
    return {y: float(np.mean(v)) for y, v in months.items() if len(v) == 12}


def summarise(series: dict[int, float], unit: str, decimals: int) -> dict:
    values = [series.get(y) for y in YEARS]
    if any(v is None for v in values):
        missing = [y for y, v in zip(YEARS, values) if v is None]
        raise SystemExit(f"Missing years {missing}")
    y = np.array(values)
    t = trend(y)
    first10 = float(y[:10].mean())
    return {
        "unit": unit,
        "years": [YEARS[0], YEARS[-1]],
        "values": [round(v, decimals) for v in values],
        "perDecade": round(t.slope * 10, 3),
        "perDecadeRange": [round(t.lower * 10, 3), round(t.upper * 10, 3)],
        "pctPerDecade": round(t.slope * 10 / first10 * 100, 1),
        "p": float(f"{t.p:.2g}"),
        "first": round(values[0], decimals),
        "last": round(values[-1], decimals),
    }


def main() -> None:
    ice = summarise(parse_sea_ice(fetch(SEA_ICE_URL)), "million km²", 2)
    co2 = summarise(parse_co2(fetch(CO2_URL)), "ppm", 1)
    payload = {
        "seaIce": {"source": "NSIDC Sea Ice Index v4 (G02135), September extent", "url": SEA_ICE_URL, **ice},
        "co2": {"source": "NOAA Global Monitoring Laboratory, global monthly mean", "url": CO2_URL, **co2},
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"Sea ice: {ice['first']} -> {ice['last']} million km2, {ice['pctPerDecade']}% per decade, p={ice['p']}")
    print(f"CO2: {co2['first']} -> {co2['last']} ppm, +{co2['perDecade']} ppm per decade, p={co2['p']}")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
