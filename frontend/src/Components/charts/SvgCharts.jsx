import { useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buildSmoothPath } from "./chartMath";

const BRAND = "#7c3aed";
const BRAND_LIGHT = "#a78bfa";

export function LineTrendChart({
  series = [],
  valueKey = "value",
  height = 160,
  color = BRAND,
  emptyLabel = "Not enough data yet",
}) {
  const gradientId = useId();
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!series || series.length < 2) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-xl bg-brand-50/40 dark:bg-white/5 text-xs text-slate-400"
      >
        {emptyLabel}
      </div>
    );
  }

  const width = 300;
  const padX = 14;
  const padTop = 16;
  const padBottom = 26;
  const plotHeight = height - padTop - padBottom;
  const values = series.map((p) => Number(p[valueKey]) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - padX * 2) / (series.length - 1);

  const points = values.map((v, i) => ({
    x: padX + i * stepX,
    y: padTop + plotHeight - ((v - min) / range) * plotHeight,
  }));
  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(2)},${padTop + plotHeight} L${points[0].x.toFixed(2)},${padTop + plotHeight} Z`;

  const gridLines = [0, 0.5, 1].map((t) => padTop + plotHeight * t);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];

  function handleMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  const hoveredValue = hoverIndex != null ? values[hoverIndex] : null;
  const hoveredLabel = hoverIndex != null ? series[hoverIndex].date : null;
  const tooltipLeftPct = hovered ? (hovered.x / width) * 100 : 0;
  const tooltipFlip = tooltipLeftPct > 70;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        className="cursor-crosshair"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {gridLines.map((y, i) => (
          <line key={i} x1={padX} x2={width - padX} y1={y} y2={y} stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeWidth={1} strokeDasharray="3 4" />
        ))}

        <text x={padX} y={padTop - 4} fontSize={9} className="fill-slate-400">
          {Math.round(max)}
        </text>
        <text x={padX} y={padTop + plotHeight + 3} fontSize={9} className="fill-slate-400">
          {Math.round(min)}
        </text>

        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />

        {hovered && (
          <motion.line
            x1={hovered.x}
            x2={hovered.x}
            y1={padTop}
            y2={padTop + plotHeight}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="2 3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
          />
        )}

        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoverIndex === i ? 4 : i === points.length - 1 ? 3 : 1.6}
            fill="white"
            stroke={color}
            strokeWidth={hoverIndex === i ? 2.4 : i === points.length - 1 ? 2 : 1.3}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 * i }}
          />
        ))}

        <text x={firstPoint.x} y={height - 6} fontSize={9} textAnchor="start" className="fill-slate-400">
          {series[0].date || ""}
        </text>
        <text x={lastPoint.x} y={height - 6} fontSize={9} textAnchor="end" className="fill-slate-400">
          {series[series.length - 1].date || ""}
        </text>
      </svg>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute z-10 -translate-y-full rounded-lg bg-slate-800 dark:bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-white dark:text-slate-800 shadow-lg"
            style={{
              left: `${tooltipLeftPct}%`,
              top: `${(hovered.y / height) * 100}%`,
              transform: `translate(${tooltipFlip ? "-100%" : "0%"}, -130%)`,
            }}
          >
            <div className="whitespace-nowrap">{hoveredLabel}</div>
            <div className="whitespace-nowrap text-brand-300">{Math.round(hoveredValue)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BarDistributionChart({ data = {}, height = 150, color = BRAND, emptyLabel = "No data yet" }) {
  const entries = Object.entries(data || {});
  const barAreaHeight = height - 48;
  const [hoverLabel, setHoverLabel] = useState(null);

  if (!entries.length) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-xl bg-brand-50/40 dark:bg-white/5 text-xs text-slate-400"
      >
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div style={{ height }} className="flex items-end gap-3">
      {entries.map(([label, value], i) => {
        const barHeight = Math.max(6, (value / max) * barAreaHeight);
        const isHovered = hoverLabel === label;
        return (
          <div
            key={label}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            onMouseEnter={() => setHoverLabel(label)}
            onMouseLeave={() => setHoverLabel(null)}
          >
            <motion.div
              className="text-[11px] font-bold text-slate-600 dark:text-slate-200"
              animate={{ scale: isHovered ? 1.15 : 1 }}
              transition={{ duration: 0.15 }}
            >
              {value}
            </motion.div>
            <motion.div
              className="w-full rounded-t-lg shadow-sm cursor-pointer"
              style={{ background: `linear-gradient(180deg, ${color}, ${color}88)` }}
              initial={{ height: 0 }}
              animate={{ height: barHeight, filter: isHovered ? "brightness(1.15)" : "brightness(1)" }}
              transition={{ height: { duration: 0.6, delay: 0.08 * i, ease: "easeOut" }, filter: { duration: 0.15 } }}
            />
            <div className="w-full truncate text-center text-[10px] font-medium text-slate-400" title={label}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Sparkline({ values = [], width = 90, height = 28, color = BRAND }) {
  if (!values || values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <motion.path
        d={buildSmoothPath(points)}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6 }}
      />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={1.8} fill={color} />
    </svg>
  );
}

export function RadialGauge({ value = 0, max = 100, size = 84, color = BRAND, label }) {
  const clamped = Math.max(0, Math.min(1, max ? value / max : 0));
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const gradientId = useId();

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={BRAND_LIGHT} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(124,58,237,0.12)" strokeWidth={6} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="52%" textAnchor="middle" fontSize={size * 0.22} fontWeight={800} fill="#4c1d95">
          {Math.round(clamped * 100)}%
        </text>
      </svg>
      {label && <div className="text-[10px] font-medium text-slate-400">{label}</div>}
    </div>
  );
}
