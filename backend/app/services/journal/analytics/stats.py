"""
Pure stdlib statistics helpers for the read-only Analytics tab.

No scikit-learn / numpy / pandas: everything here is plain Python so the
Analytics feature stays outside the ML stack entirely.
"""

import math
from statistics import median
from typing import List, Sequence


def theil_sen_slope(xs: Sequence[float], ys: Sequence[float]) -> float:
    """Median of all pairwise slopes - a robust trend estimator that isn't
    thrown off by one or two outlier days the way a least-squares fit is."""
    n = len(xs)
    if n < 2:
        return 0.0
    slopes = []
    for i in range(n):
        for j in range(i + 1, n):
            dx = xs[j] - xs[i]
            if dx != 0:
                slopes.append((ys[j] - ys[i]) / dx)
    return median(slopes) if slopes else 0.0


def _two_sided_p_from_z(z: float) -> float:
    """Two-sided p-value from a z-score using the normal distribution's
    survival function (erfc-based), e.g. z=1.96 -> p~=0.05."""
    sf = 0.5 * math.erfc(abs(z) / math.sqrt(2))
    return min(1.0, round(2 * sf, 4))


MANN_KENDALL_Z_THRESHOLD = 1.96  # two-sided 95% significance cutoff


def mann_kendall_test(values: Sequence[float]) -> dict:
    """Non-parametric trend test: counts, over every pair of days, whether
    the later value is higher, lower, or equal (S), then turns that into a
    z-score and a two-sided p-value. |z| >= 1.96 (p <= 0.05) is the usual
    "the trend is statistically real" cutoff - it does NOT mean "the chart
    goes up/down a lot", it means "this direction is unlikely to be noise"."""
    n = len(values)
    if n < 3:
        return {"s": 0, "z": 0.0, "p": 1.0}
    s = 0
    for i in range(n - 1):
        for j in range(i + 1, n):
            diff = values[j] - values[i]
            s += (diff > 0) - (diff < 0)
    var_s = n * (n - 1) * (2 * n + 5) / 18
    if var_s <= 0:
        z = 0.0
    elif s > 0:
        z = (s - 1) / math.sqrt(var_s)
    elif s < 0:
        z = (s + 1) / math.sqrt(var_s)
    else:
        z = 0.0
    return {"s": s, "z": round(z, 3), "p": _two_sided_p_from_z(z)}


def mad_zscores(values: Sequence[float]) -> List[float]:
    """Robust z-scores using the median absolute deviation instead of the
    mean/stdev, so a single extreme day doesn't hide the other outliers."""
    if not values:
        return []
    m = median(values)
    deviations = [abs(v - m) for v in values]
    mad = median(deviations)
    if mad == 0:
        # More than half the values equal the median (e.g. several identical
        # days plus one outlier) - median absolute deviation collapses to 0,
        # so fall back to the mean absolute deviation as the scale estimate.
        mad = sum(deviations) / len(deviations)
        if mad == 0:
            return [0.0 for _ in values]
        return [round((v - m) / mad, 3) for v in values]
    # 0.6745 scales MAD to be comparable to a standard-deviation z-score.
    return [round(0.6745 * (v - m) / mad, 3) for v in values]


def spearman_corr(xs: Sequence[float], ys: Sequence[float]) -> float | None:
    """Rank correlation; -1..1, works for monotonic (not just linear) links.
    Returns None when undefined (fewer than 2 points, or either side has no
    variation at all - a correlation needs two things that both vary)."""
    n = len(xs)
    if n < 2 or n != len(ys):
        return None
    if len(set(xs)) < 2 or len(set(ys)) < 2:
        return None

    def ranks(values: Sequence[float]) -> List[float]:
        order = sorted(range(len(values)), key=lambda i: values[i])
        r = [0.0] * len(values)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
                j += 1
            avg_rank = (i + j) / 2 + 1
            for k in range(i, j + 1):
                r[order[k]] = avg_rank
            i = j + 1
        return r

    rx, ry = ranks(xs), ranks(ys)
    mean_rx, mean_ry = sum(rx) / n, sum(ry) / n
    cov = sum((rx[i] - mean_rx) * (ry[i] - mean_ry) for i in range(n))
    var_x = sum((v - mean_rx) ** 2 for v in rx)
    var_y = sum((v - mean_ry) ** 2 for v in ry)
    denom = math.sqrt(var_x * var_y)
    return round(cov / denom, 3) if denom else None


def spearman_p_value(rho: float, n: int) -> float:
    """Approximate two-sided p-value for a Spearman rho, via the standard
    large-sample normal approximation z = rho * sqrt(n - 1)."""
    if n < 2:
        return 1.0
    z = rho * math.sqrt(n - 1)
    return _two_sided_p_from_z(z)


def shannon_entropy(counts: Sequence[int]) -> float:
    """Entropy in bits of a categorical distribution; 0 = all one category,
    higher = more evenly spread across categories."""
    total = sum(counts)
    if total <= 0:
        return 0.0
    entropy = 0.0
    for c in counts:
        if c <= 0:
            continue
        p = c / total
        entropy -= p * math.log2(p)
    return round(entropy, 3)


def normalized_entropy(counts: Sequence[int]) -> float | None:
    """Entropy divided by its maximum possible value (log2 of the number of
    categories that actually have data), so it reads 0..1 regardless of how
    many categories exist. None when fewer than 2 categories have any data -
    "evenness" isn't meaningful with only one bucket."""
    categories_with_data = sum(1 for c in counts if c > 0)
    if categories_with_data < 2:
        return None
    max_entropy = math.log2(categories_with_data)
    if max_entropy == 0:
        return None
    return round(shannon_entropy(counts) / max_entropy, 3)


def safe_mean(values: Sequence[float]) -> float:
    return round(sum(values) / len(values), 3) if values else 0.0
