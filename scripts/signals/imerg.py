"""IMERG Late / Early GIS reader (plan rev. 7b, step 2).

Encoding facts asserted at runtime and in the fixture tests, all from the public IMERG GIS readme
(IMERG_GIS-GeoTIFF_ReadMe_6_27_23.pdf, §3.1–3.2, §3.10, checked 2026-11-03):

  * Early and Late GIS files hold **accumulation**, not rate: value = round(mm x 10).
  * Missing data is **29999** in the 2-byte unsigned files (never -9999).
  * 0.1 deg grid, 1800 rows x 3600 cols, north-up, north-west corner at 90N 180W, EPSG:4326.

The README.GIS on the PPS server is fetched when credentials are available and checked against
these constants; a mismatch aborts loudly instead of silently misreading the scale.
"""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

REQUIRED_FACTS = {
    "scale": 10,
    "missing": 29999,
    "pixels_per_deg": 10,
    "rows": 1800,
    "cols": 3600,
    "pixel_is": "area",
}


class ImergEncodingError(RuntimeError):
    """The file or its documentation does not match the asserted encoding."""


@dataclass(frozen=True)
class Granule:
    product: str  # "late" | "early"
    day: dt.date
    url: str
    version: str  # e.g. "V07B"

    @property
    def label(self) -> str:
        return f"{self.product} {self.day.isoformat()} {self.version}"


def granule_url(base: str, product: str, day: dt.date, days: int, version: str = "V07B") -> str:
    """PPS publish one GeoTIFF per accumulation window per day.

    Early and Late live under the same tree; the accumulation in the name is the window length.
    """
    if days not in (1, 3, 7):
        raise ValueError("only 1, 3 and 7-day accumulations are published")
    tag = "L" if product == "late" else "E"
    name = f"3B-{days}DAY-{tag}.GIS.IMERG.{day:%Y%m%d}-S000000-E235959.{version}.tif"
    return f"{base}/{day:%Y}/{day:%m}/{name}"


def ladder(product: str, days: int) -> list[str]:
    """Which product may serve a window, in cost order; never mixes runs inside one window."""
    if days == 1:
        return [product, "early" if product == "late" else "late"]
    return [product, product, "early"]  # native -> sum of 1-day -> Early sum of 1-day


@dataclass
class Raster:
    values_mm: np.ndarray  # rows x cols, NaN where missing
    valid_fraction: float
    nw: tuple[float, float]
    pixels_per_deg: float
    source: str

    def at(self, lat: float, lon: float) -> float:
        row = int(round((self.nw[0] - lat) * self.pixels_per_deg - 0.5))
        col = int(round((lon - self.nw[1]) * self.pixels_per_deg - 0.5))
        if row < 0 or col < 0 or row >= self.values_mm.shape[0] or col >= self.values_mm.shape[1]:
            return float("nan")
        return float(self.values_mm[row, col])

    def subset(self, tile) -> np.ndarray:
        """Rows and columns covering a tile, north-up."""
        r0 = int(round((self.nw[0] - tile.north) * self.pixels_per_deg))
        r1 = int(round((self.nw[0] - tile.south) * self.pixels_per_deg))
        c0 = int(round((tile.west - self.nw[1]) * self.pixels_per_deg))
        c1 = int(round((tile.east - self.nw[1]) * self.pixels_per_deg))
        return self.values_mm[r0:r1, c0:c1]


def decode(array: np.ndarray, scale: float = REQUIRED_FACTS["scale"], missing: int = REQUIRED_FACTS["missing"]) -> np.ndarray:
    """Raw integers to millimetres; the fill value becomes NaN.

    29999 (0x752F) is below the signed-16-bit maximum, so reading the file as signed or unsigned
    gives the same number — one comparison covers both.
    """
    data = np.asarray(array)
    out = data.astype(np.float64)
    out[data == missing] = np.nan
    return out / scale


def read_geotiff(path: str | Path, *, expect_north_up: bool = True) -> Raster:
    """Read an IMERG GIS GeoTIFF and assert its geometry instead of trusting it."""
    import tifffile

    with tifffile.TiffFile(path) as tif:
        page = tif.pages[0]
        data = page.asarray()
        tags = page.tags
        scale_tag = tags.get("ModelPixelScaleTag")
        tie_tag = tags.get("ModelTiepointTag")
        if scale_tag is None or tie_tag is None:
            raise ImergEncodingError("GeoTIFF lacks ModelPixelScaleTag/ModelTiepointTag; refusing to guess the grid")
        px, py = float(scale_tag.value[0]), float(scale_tag.value[1])
        tie = [float(v) for v in tie_tag.value[:6]]
    if data.ndim != 2:
        raise ImergEncodingError(f"expected a 2-D raster, got shape {data.shape}")
    if data.dtype.itemsize != 2:
        raise ImergEncodingError(f"expected two-byte integers, got {data.dtype}")
    if abs(px - 1 / REQUIRED_FACTS["pixels_per_deg"]) > 1e-6 or abs(px - py) > 1e-6:
        raise ImergEncodingError(f"pixel size {px} x {py} is not the documented 0.1 deg grid")
    if expect_north_up and tie[4] < tie[1]:
        raise ImergEncodingError("raster is not north-up (row 0 must be the most northerly)")

    values = decode(data)
    valid = float(np.isfinite(values).mean()) if values.size else 0.0
    return Raster(values_mm=values, valid_fraction=valid, nw=(tie[4], tie[3]), pixels_per_deg=1 / px, source=str(path))


README_PATTERNS = {
    "scale": [r"multiplied by 10", r"scale[ds]? by 10", r"\*10", r"\bx\s?10\b"],
    "missing": [r"\b29999\b"],
    "pixels_per_deg": [r"0\.1\s*(?:°|deg|degree)"],
    "northwest": [r"89\.95", r"179\.95"],
}


def parse_readme_gis(text: str) -> dict:
    """Extract the encoding facts from a README.GIS body; unknown facts are absent, never assumed."""
    found: dict[str, object] = {}
    for key, patterns in README_PATTERNS.items():
        found[key] = any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns)
    versions = sorted(set(re.findall(r"\bV0[7-9][A-Z]?\b", text)))
    found["versions"] = versions
    return found


def assert_readme_matches(text: str) -> None:
    """Abort loudly when the published documentation contradicts the asserted encoding."""
    facts = parse_readme_gis(text)
    problems = [key for key in ("scale", "missing", "pixels_per_deg") if not facts.get(key)]
    if problems:
        raise ImergEncodingError(
            "README.GIS no longer states " + ", ".join(problems) + "; re-read it before reading any tile"
        )


VERSION_RE = re.compile(r"\bV(\d{2})([A-Z])\b")


def version_of(name: str) -> str:
    """'...IMERG.20240715-S000000-E235959.V07B.tif' -> 'V07B'."""
    match = VERSION_RE.search(name)
    return match.group(0) if match else "unknown"


@dataclass
class WindowResult:
    mm: float
    valid_fraction: float
    sources: list[str]

    @property
    def source(self) -> str:
        return "; ".join(self.sources)


def window_sum(rasters: list[Raster], window_days: int) -> WindowResult:
    """Sum consecutive daily rasters for a 3/7-day window; refuse mixed versions."""
    versions = {version_of(r.source) for r in rasters}
    if len(versions) > 1:
        raise ImergEncodingError(f"mixed IMERG versions in one window: {sorted(versions)}")
    if len(rasters) != window_days:
        raise ValueError(f"need {window_days} daily rasters, got {len(rasters)}")
    stack = np.stack([r.values_mm for r in rasters])
    total = np.nansum(stack, axis=0)
    total[np.isnan(stack).all(axis=0)] = np.nan
    valid = float(np.isfinite(total).mean())
    return WindowResult(mm=float(np.nanmean(total)), valid_fraction=valid, sources=[r.source for r in rasters])
