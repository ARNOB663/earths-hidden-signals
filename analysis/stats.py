"""Trend statistics: modified Mann-Kendall test, Sen's slope with confidence interval, and FDR.

- Significance: Hamed & Rao (1998) modified Mann-Kendall test. Plain Mann-Kendall assumes
  independent years; climate series are often autocorrelated, which inflates false
  "significant" results. The modification corrects the variance for that.
- Rate: Sen's slope (median of all pairwise slopes), robust to outliers, with a
  distribution-free 95% confidence interval (Gilbert 1987).
- Many grid cells: Benjamini-Hochberg false discovery rate. Following Wilks (2016), we use
  alpha_FDR = 0.10, which keeps the overall false-alarm rate near 5% for spatially
  correlated climate fields.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pymannkendall as mk
from scipy.stats import norm


@dataclass
class Trend:
    slope: float  # units per year
    lower: float  # 95% CI of slope
    upper: float
    p: float  # modified Mann-Kendall two-sided p-value
    tau: float


def sen_confidence_interval(y: np.ndarray, var_s: float, alpha: float = 0.05) -> tuple[float, float]:
    n = y.size
    i, j = np.triu_indices(n, k=1)
    slopes = np.sort((y[j] - y[i]) / (j - i))
    c = norm.ppf(1 - alpha / 2) * np.sqrt(var_s)
    m1 = int(np.floor((slopes.size - c) / 2))
    m2 = int(np.ceil((slopes.size + c) / 2))
    m1 = min(max(m1, 1), slopes.size)
    m2 = min(max(m2 + 1, 1), slopes.size)
    return float(slopes[m1 - 1]), float(slopes[m2 - 1])


def trend(y: np.ndarray) -> Trend | None:
    """Trend of an evenly spaced yearly series. Returns None if data is missing or flat."""
    y = np.asarray(y, dtype=float)
    if y.size < 10 or np.isnan(y).any() or np.ptp(y) == 0:
        return None
    res = mk.hamed_rao_modification_test(y)
    # The Hamed-Rao correction factor can come out negative for some series, giving an
    # invalid variance; the unmodified test is the standard fallback in that case.
    if not np.isfinite(res.var_s) or res.var_s <= 0 or not np.isfinite(res.p):
        res = mk.original_test(y)
    lower, upper = sen_confidence_interval(y, res.var_s)
    return Trend(slope=float(res.slope), lower=lower, upper=upper, p=float(res.p), tau=float(res.Tau))


def fdr_significant(p_values: np.ndarray, alpha_fdr: float = 0.10) -> np.ndarray:
    """Benjamini-Hochberg: boolean mask of p-values that stay significant across the whole map."""
    p = np.asarray(p_values, dtype=float)
    valid = ~np.isnan(p)
    result = np.zeros(p.shape, dtype=bool)
    pv = p[valid]
    if pv.size == 0:
        return result
    order = np.argsort(pv)
    ranked = pv[order]
    thresholds = alpha_fdr * np.arange(1, pv.size + 1) / pv.size
    passing = np.nonzero(ranked <= thresholds)[0]
    if passing.size:
        cutoff = ranked[passing[-1]]
        result[valid] = pv <= cutoff
    return result
