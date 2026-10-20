import { useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { buildSmoothPath } from "./chartMath";
import ChartTooltip from "./ChartTooltip";
import { BRAND } from "./chartTheme";

/**
 * series: [{ date, value }]
 * trendSlope: optional number (value change per point) - drawn as a dashed
 * line through the series' own start point, purely illustrative.
 * anomalies: optional Set/array of dates to mark with a ring.
 */
export default function LineAreaChart({
  series = [],
  height = 170,
  color = BRAND[500],
  trendSlope = null,
  anomalyDates = [],
  emptyLabel = "Not enough data yet",
}) {
  const gradientId = useId();
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!series || series.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-xl bg-brand-50/40 dark:bg-white/5 text-xs text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  const width = 300;
  const padX = 14;
  const padTop = 16;
  const padBottom = 26;
  const plotHeight = height - padTop - padBottom;
  const values = series.map((p) => Number(p.value) || 0);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const stepX = (width - padX * 2) / (series.length - 1);
  const median = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

  const toY = (v) => padTop + plotHeight - ((v - min) / range) * plotHeight;
  const points = values.map((v, i) => ({ x: padX + i * stepX, y: toY(v) }));
  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(2)},${padTop + plotHeight} L${points[0].x.toFixed(2)},${padTop + plotHeight} Z`;

  const anomalySet = new Set(anomalyDates);
  const gridLines = [0, 0.5, 1].map((t) => padTop + plotHeight * t);

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
  const tooltipLeftPct = hovered ? (hovered.x / width) * 100 : 0;
  const tooltipFlip = tooltipLeftPct > 70;

  let trendLine = null;
  if (trendSlope !== null) {
    const trendStart = values[0];
    const trendEnd = trendStart + trendSlope * (values.length - 1);
    trendLine = {
      x1: points[0].x,
      y1: toY(trendStart),
      x2: points[points.length - 1].x,
      y2: toY(trendEnd),
    };
  }

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
        <text x={padX} y={padTop - 4} fontSize={9} className="fill-slate-400">{Math.round(max)}</text>
        <text x={padX} y={padTop + plotHeight + 3} fontSize={9} className="fill-slate-400">{Math.round(min)}</text>

        <motion.path d={areaPath} fill={`url(#${gradientId})`} stroke="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }} />
        <motion.path d={linePath} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />

        {trendLine && (
          <line x1={trendLine.x1} y1={trendLine.y1} x2={trendLine.x2} y2={trendLine.y2} stroke={color} strokeOpacity={0.5} strokeWidth={1.3} strokeDasharray="5 4" />
        )}

        {hovered && (
          <line x1={hovered.x} x2={hovered.x} y1={padTop} y2={padTop + plotHeight} stroke={color} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
        )}

        {points.map((p, i) => {
          const isAnomaly = anomalySet.has(series[i].date);
          return (
            <g key={i}>
              {isAnomaly && <circle cx={p.x} cy={p.y} r={6} fill="none" stroke={color} strokeWidth={1.4} opacity={0.6} />}
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={hoverIndex === i ? 4 : isAnomaly ? 3 : 1.6}
                fill="white"
                stroke={color}
                strokeWidth={hoverIndex === i ? 2.4 : 1.3}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.03 * i }}
              />
            </g>
          );
        })}

        <text x={points[0].x} y={height - 6} fontSize={9} textAnchor="start" className="fill-slate-400">{series[0].date}</text>
        <text x={points[points.length - 1].x} y={height - 6} fontSize={9} textAnchor="end" className="fill-slate-400">{series[series.length - 1].date}</text>
      </svg>

      <ChartTooltip visible={!!hovered} xPct={tooltipLeftPct} yPct={hovered ? (hovered.y / height) * 100 : 0} flip={tooltipFlip}>
        {hoverIndex != null && (
          <>
            <div className="whitespace-nowrap">{series[hoverIndex].date}</div>
            <div className="whitespace-nowrap text-brand-300">{Math.round(values[hoverIndex])}</div>
            <div className="whitespace-nowrap text-[10px] opacity-70">median: {Math.round(median)}</div>
          </>
        )}
      </ChartTooltip>
    </div>
  );
}
