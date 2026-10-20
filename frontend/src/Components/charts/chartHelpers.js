// Pure helper functions for the chart kit - kept out of any .jsx file so
// react-refresh/only-export-components never flags them, and so they're
// trivially unit-testable without rendering anything.

export function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [0];
  }
  const range = max - min;
  const rawStep = range / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let step;
  if (residual > 5) step = 10 * magnitude;
  else if (residual > 2) step = 5 * magnitude;
  else if (residual > 1) step = 2 * magnitude;
  else step = magnitude;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function formatPercent(fraction) {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return "—";
  return `${Math.round(fraction * 100)}%`;
}

export function formatMinutes(mins) {
  const m = Math.round(Number(mins) || 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

// Generic fixed-width histogram binning over raw numeric values. Used for
// client-side (demo-data) histograms; the real API already returns
// precomputed bins, so this is the fallback/demo path.
export function binValues(values, { binWidth = 30, maxBins = 8 } = {}) {
  const nonZero = (values || []).filter((v) => v > 0);
  if (!nonZero.length) return { labels: [], counts: [] };
  const max = Math.max(...nonZero);
  const nBins = Math.min(maxBins, Math.max(1, Math.ceil(max / binWidth)));
  const counts = new Array(nBins).fill(0);
  for (const v of nonZero) {
    const idx = Math.min(nBins - 1, Math.floor(v / binWidth));
    counts[idx] += 1;
  }
  const labels = counts.map((_, i) =>
    i === nBins - 1 && (i + 1) * binWidth <= max ? `${i * binWidth}+` : `${i * binWidth}-${(i + 1) * binWidth}`
  );
  return { labels, counts };
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toIsoDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekStartIso(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - weekday);
  return toIsoDateLocal(d);
}

export function isoWeekday(dateStr) {
  // 0 = Monday ... 6 = Sunday, matching the backend's weekday() convention.
  const d = new Date(`${dateStr}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

export function weekdayLabel(index) {
  return WEEKDAY_LABELS[index] ?? "";
}

// Groups a flat list of {date, status} calendar cells into Monday-start
// week rows for a GitHub-style heatmap, padding the first/last week with
// null placeholders so every row has exactly 7 slots.
export function heatmapWeeks(cells) {
  if (!cells || !cells.length) return [];
  const weeks = [];
  let current = [];
  const firstWeekday = isoWeekday(cells[0].date);
  for (let i = 0; i < firstWeekday; i++) current.push(null);
  for (const cell of cells) {
    current.push(cell);
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }
  if (current.length) {
    while (current.length < 7) current.push(null);
    weeks.push(current);
  }
  return weeks;
}

export function mostActiveWeekdayCaption(weekdayJournals) {
  const max = Math.max(...weekdayJournals);
  if (max <= 0) return "No journals recorded yet in this window.";
  const idx = weekdayJournals.indexOf(max);
  return `You journaled most on ${weekdayLabelFull(idx)}s (${max} journal${max === 1 ? "" : "s"}).`;
}

const WEEKDAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function weekdayLabelFull(index) {
  return WEEKDAY_FULL[index] ?? "";
}

export function trendCaption(trend) {
  const { label, slope_per_day: slope } = trend;
  if (label === "insufficient data") return "Not enough active days yet to detect a trend.";
  if (label === "increasing") return `Trending up, about ${formatNumber(Math.abs(slope))} per day.`;
  if (label === "decreasing") return `Trending down, about ${formatNumber(Math.abs(slope))} per day.`;
  return "No significant trend (not enough evidence either way).";
}

export function subjectCaption(rows) {
  if (!rows || !rows.length) return "No subjects recorded yet.";
  const top = rows[0];
  return `Most time went to ${top.subject} (${top.minutes > 0 ? formatMinutes(top.minutes) : `${top.journals} journals`}).`;
}

export function correlationCaption(correlation) {
  if (correlation.rho === null) return `Not enough variation to compute a correlation (${correlation.reason}).`;
  const strength = Math.abs(correlation.rho) >= 0.6 ? "a strong" : Math.abs(correlation.rho) >= 0.3 ? "a moderate" : "a weak";
  const direction = correlation.rho >= 0 ? "positive" : "negative";
  return `${strength[0].toUpperCase()}${strength.slice(1)} ${direction} relationship (rho=${correlation.rho}).`;
}

// Deterministic export-canvas sizing for DownloadPngButton - pure so it can
// be unit-tested without a real <canvas>.
export function pngExportSize(svgWidth, svgHeight, scale = 2) {
  return { width: Math.round(svgWidth * scale), height: Math.round(svgHeight * scale) };
}
