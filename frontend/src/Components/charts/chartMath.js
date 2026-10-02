export function buildScale(values, size, padding = 0) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usable = size - padding * 2;
  return (v) => padding + ((v - min) / range) * usable;
}

export function buildLinePath(points) {
  if (!points.length) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

export function niceNumber(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(decimals);
}
