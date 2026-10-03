import { useState } from "react";
import { motion } from "framer-motion";
import { theilSenLineFromPoints } from "./chartMath";
import ChartTooltip from "./ChartTooltip";
import { BRAND } from "./chartTheme";

/** points: [{x, y, label}] */
export default function ScatterPlot({ points = [], xLabel = "x", yLabel = "y", height = 180, color = BRAND[500], emptyLabel }) {
  const [hover, setHover] = useState(null);

  if (!points.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-xl bg-brand-50/40 dark:bg-white/5 text-xs text-slate-400">
        {emptyLabel || "Not enough variation to plot."}
      </div>
    );
  }

  const width = 300;
  const pad = 20;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs, 0);
  const xMax = Math.max(...xs, 1);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 1);
  const toX = (v) => pad + ((v - xMin) / (xMax - xMin || 1)) * (width - pad * 2);
  const toY = (v) => height - pad - ((v - yMin) / (yMax - yMin || 1)) * (height - pad * 2);

  const trend = points.length >= 2 ? theilSenLineFromPoints(points) : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="currentColor" className="text-slate-200 dark:text-white/10" />
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="currentColor" className="text-slate-200 dark:text-white/10" />
        <text x={width / 2} y={height - 4} fontSize={9} textAnchor="middle" className="fill-slate-400">{xLabel}</text>
        <text x={6} y={pad} fontSize={9} textAnchor="start" className="fill-slate-400">{yLabel}</text>

        {trend && (
          <line
            x1={toX(xMin)}
            y1={toY(trend.slope * xMin + trend.intercept)}
            x2={toX(xMax)}
            y2={toY(trend.slope * xMax + trend.intercept)}
            stroke={color}
            strokeWidth={1.4}
            strokeDasharray="5 4"
            opacity={0.6}
          />
        )}

        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={toX(p.x)}
            cy={toY(p.y)}
            r={hover === i ? 5 : 3}
            fill={color}
            opacity={hover === null || hover === i ? 0.85 : 0.35}
            initial={{ opacity: 0 }}
            animate={{ opacity: hover === null || hover === i ? 0.85 : 0.35 }}
            transition={{ duration: 0.3, delay: 0.01 * i }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            tabIndex={0}
            role="img"
            aria-label={`${p.label || ""}: ${xLabel} ${p.x}, ${yLabel} ${p.y}`}
          />
        ))}
      </svg>
      <ChartTooltip visible={hover !== null} xPct={hover !== null ? (toX(points[hover].x) / width) * 100 : 0} yPct={hover !== null ? (toY(points[hover].y) / height) * 100 : 0}>
        {hover !== null && (
          <>
            <div>{points[hover].label}</div>
            <div className="text-brand-300">{xLabel}: {points[hover].x}, {yLabel}: {points[hover].y}</div>
          </>
        )}
      </ChartTooltip>
    </div>
  );
}
