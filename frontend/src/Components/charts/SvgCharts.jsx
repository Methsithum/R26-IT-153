import { buildLinePath } from "./chartMath";

const BRAND = "#7c3aed";
const BRAND_SOFT = "rgba(124,58,237,0.15)";

export function LineTrendChart({
  series = [],
  valueKey = "value",
  height = 140,
  color = BRAND,
  emptyLabel = "Not enough data yet",
}) {
  if (!series || series.length < 2) {
    return (
      <div className="flex h-[140px] items-center justify-center text-xs text-slate-400">{emptyLabel}</div>
    );
  }
  const width = 100; // viewBox units; scales responsively via the SVG width=100%
  const padX = 4;
  const padY = 10;
  const values = series.map((p) => Number(p[valueKey]) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - padX * 2) / (series.length - 1);

  const points = values.map((v, i) => ({
    x: padX + i * stepX,
    y: height - padY - ((v - min) / range) * (height - padY * 2),
  }));
  const linePath = buildLinePath(points);
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(2)},${height - padY} L${points[0].x.toFixed(2)},${height - padY} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <path d={areaPath} fill={BRAND_SOFT} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.4} fill={color} />
      ))}
    </svg>
  );
}

export function BarDistributionChart({ data = {}, height = 130, color = BRAND, emptyLabel = "No data yet" }) {
  const entries = Object.entries(data || {});
  const barAreaHeight = height - 40;
  if (!entries.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-slate-400">{emptyLabel}</div>
    );
  }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div style={{ height }} className="flex items-end gap-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-300">{value}</div>
          <div
            className="w-full rounded-t-md"
            style={{
              height: `${Math.max(4, (value / max) * barAreaHeight)}px`,
              background: color,
              opacity: 0.85,
            }}
          />
          <div className="w-full truncate text-center text-[9px] text-slate-400" title={label}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values = [], width = 80, height = 24, color = BRAND }) {
  if (!values || values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * height,
  }));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <path d={buildLinePath(points)} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

export function RadialGauge({ value = 0, max = 100, size = 72, color = BRAND, label }) {
  const clamped = Math.max(0, Math.min(1, max ? value / max : 0));
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(124,58,237,0.15)"
          strokeWidth={5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="52%" textAnchor="middle" fontSize={size * 0.22} fontWeight={700} fill="#4c1d95">
          {Math.round(clamped * 100)}%
        </text>
      </svg>
      {label && <div className="text-[10px] text-slate-400">{label}</div>}
    </div>
  );
}
