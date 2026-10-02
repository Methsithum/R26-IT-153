"""
Pure stdlib statistics helpers for the read-only Analytics tab.

No scikit-learn / numpy / pandas: everything here is plain Python so the
Analytics feature stays outside the ML stack entirely.
"""

import math
from statistics import median
from typing import List, Sequence, Tuple


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


def mann_kendall_test(values: Sequence[float]) -> dict:
    """Non-parametric trend test. Returns the trend direction and a z-score;
    |z| >= 1.96 is the usual "trend is significant at 95%" cutoff."""
    n = len(values)
    if n < 3:
        return {"trend": "insufficient_data", "z": 0.0, "s": 0}
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
    if z > 1.96:
        trend = "increasing"
    elif z < -1.96:
        trend = "decreasing"
    else:
        trend = "no_significant_trend"
    return {"trend": trend, "z": round(z, 3), "s": s}


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


def spearman_corr(xs: Sequence[float], ys: Sequence[float]) -> float:
    """Rank correlation; -1..1, works for monotonic (not just linear) links."""
    n = len(xs)
    if n < 2 or n != len(ys):
        return 0.0

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
    return round(cov / denom, 3) if denom else 0.0


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


def _tokenize(text: str) -> List[str]:
    return [tok for tok in "".join(c.lower() if c.isalnum() else " " for c in (text or "")).split() if tok]


def tfidf_cosine_similarity(text_a: str, text_b: str, corpus: Sequence[str] = ()) -> float:
    """Cosine similarity between two texts' TF-IDF vectors, IDF estimated
    from the given corpus (falls back to just the two texts)."""
    docs = list(corpus) if corpus else []
    if text_a not in docs:
        docs.append(text_a)
    if text_b not in docs:
        docs.append(text_b)
    tokenized_docs = [_tokenize(d) for d in docs]
    vocab = set()
    for toks in tokenized_docs:
        vocab.update(toks)
    if not vocab:
        return 0.0
    n_docs = len(tokenized_docs)
    doc_freq = {term: sum(1 for toks in tokenized_docs if term in toks) for term in vocab}
    idf = {term: math.log((1 + n_docs) / (1 + doc_freq[term])) + 1 for term in vocab}

    def tfidf_vector(text: str) -> dict:
        toks = _tokenize(text)
        if not toks:
            return {}
        counts: dict = {}
        for t in toks:
            counts[t] = counts.get(t, 0) + 1
        return {t: (c / len(toks)) * idf.get(t, 0.0) for t, c in counts.items()}

    va, vb = tfidf_vector(text_a), tfidf_vector(text_b)
    if not va or not vb:
        return 0.0
    dot = sum(v * vb.get(t, 0.0) for t, v in va.items())
    norm_a = math.sqrt(sum(v * v for v in va.values()))
    norm_b = math.sqrt(sum(v * v for v in vb.values()))
    denom = norm_a * norm_b
    return round(dot / denom, 3) if denom else 0.0


def safe_mean(values: Sequence[float]) -> float:
    return round(sum(values) / len(values), 3) if values else 0.0


def linear_trend_points(dated_values: Sequence[Tuple[str, float]]) -> dict:
    """Convenience wrapper: given [(iso_date, value), ...] sorted ascending,
    return the Theil-Sen slope (value change per day) and Mann-Kendall trend."""
    if len(dated_values) < 2:
        return {"slope_per_day": 0.0, "trend": "insufficient_data", "z": 0.0}
    xs = list(range(len(dated_values)))
    ys = [v for _, v in dated_values]
    slope = theil_sen_slope(xs, ys)
    mk = mann_kendall_test(ys)
    return {"slope_per_day": round(slope, 3), "trend": mk["trend"], "z": mk["z"]}
