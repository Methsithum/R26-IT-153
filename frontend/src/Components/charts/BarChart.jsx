import { useId, useState } from "react";
import { motion } from "framer-motion";
import { buildSmoothPath } from "./chartMath";
import { niceTicks, formatNumber } from "./chartHelpers";
import ChartTooltip from "./ChartTooltip";
import { NEUTRAL } from "./chartTheme";

/**
 * categories: string[]
 * series: [{ key, label, color, values: number[] }]   (values aligned to categories)
 * mode: "simple" (single series) | "grouped" | "stacked"
 * orientation: "vertical" | "horizontal"
 * overlayLine: optional number[] (aligned to categories) drawn as a line on
 * top of the bars, sharing the same value scale - e.g. a moving average.
 * showLegend: shows a label/color key below the chart when there's more
 * than one series, so a stacked/grouped chart doesn't look like an
 * unlabeled duplicate of another chart.
 */
export default function BarChart({
  categories = [],
  series = [],
  mode = "simple",
  orientation = "vertical",
  height = 160,
  valueLabels = true,
  sorted = false,
  emptyLabel = "No data yet",
  overlayLine = null,
  overlayLineLabel = "",
  overlayLineColor,
  showLegend = false,
}) {
  const gradientId = useId();
  const [hover, setHover] = useState(null);

  if (!categories.length || !series.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-xl bg-brand-50/40 dark:bg-white/5 text-xs text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  let order = categories.map((_, i) => i);
  if (sorted && mode === "simple") {
    order = [...order].sort((a, b) => (series[0].values[b] || 0) - (series[0].values[a] || 0));
  }

  const totals = order.map((i) => series.reduce((sum, s) => sum + (mode === "stacked" ? s.values[i] || 0 : 0), 0));
  const maxSimple = Math.max(...series.flatMap((s) => s.values), ...(overlayLine || []), 1);
  const max = mode === "stacked" ? Math.max(...totals, 1) : maxSimple;
  const ticks = niceTicks(0, max, 4);
  const axisMax = ticks[ticks.length - 1] || max;

  if (orientation === "horizontal") {
    return (
      <div className="space-y-2">
        {order.map((i) => {
          const label = categories[i];
          const value = series[0].values[i] || 0;
          const pct = Math.max(2, (value / axisMax) * 100);
          return (
            <div key={label} className="flex items-center gap-2 text-[11px]">
              <div className="w-24 shrink-0 truncate text-slate-500 dark:text-slate-300" title={label}>
                {label}
              </div>
              <div className="relative flex-1 h-5 rounded-lg bg-brand-50 dark:bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-lg"
                  style={{ background: `linear-gradient(90deg, ${series[0].color}, ${series[0].color}88)` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              {valueLabels && <div className="w-10 shrink-0 text-right font-semibold text-slate-600 dark:text-slate-200">{formatNumber(value)}</div>}
            </div>
          );
        })}
      </div>
    );
  }

  const width = 300;
  const padX = 10;
  const padTop = 14;
  const padBottom = 20;
  const plotHeight = height - padTop - padBottom;
  const gap = 6;
  const barWidth = (width - padX * 2 - gap * (order.length - 1)) / order.length;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0]?.color} stopOpacity={0.95} />
            <stop offset="100%" stopColor={series[0]?.color} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => {
          const y = padTop + plotHeight - (t / axisMax) * plotHeight;
          return <line key={i} x1={padX} x2={width - padX} y1={y} y2={y} stroke={NEUTRAL[200]} strokeWidth={0.5} strokeDasharray="2 3" />;
        })}

        {order.map((catIndex, pos) => {
          const x = padX + pos * (barWidth + gap);
          let cumulative = 0;
          return (
            <g
              key={catIndex}
              onMouseEnter={() => setHover(pos)}
              onMouseLeave={() => setHover((h) => (h === pos ? null : h))}
              tabIndex={0}
              role="button"
              aria-label={`${categories[catIndex]}: ${series.map((s) => `${s.label} ${s.values[catIndex]}`).join(", ")}`}
              onFocus={() => setHover(pos)}
              onBlur={() => setHover((h) => (h === pos ? null : h))}
            >
              {series.map((s, si) => {
                const v = s.values[catIndex] || 0;
                const barHeight = (v / axisMax) * plotHeight;
                const y = padTop + plotHeight - barHeight - cumulative;
                cumulative += mode === "stacked" ? barHeight : 0;
                const fill = series.length === 1 ? `url(#${gradientId})` : s.color;
                const segWidth = mode === "grouped" ? barWidth / series.length : barWidth;
                const segX = mode === "grouped" ? x + si * segWidth : x;
                return (
                  <motion.rect
                    key={s.key}
                    x={segX}
                    width={Math.max(1, segWidth - (mode === "grouped" ? 1 : 0))}
                    rx={2.5}
                    fill={fill}
                    initial={{ y: padTop + plotHeight, height: 0 }}
                    animate={{ y, height: Math.max(1, barHeight) }}
                    transition={{ duration: 0.5, delay: 0.03 * pos, ease: "easeOut" }}
                    opacity={hover === null || hover === pos ? 1 : 0.55}
                  />
                );
              })}
              {valueLabels && mode === "simple" && (
                <text x={x + barWidth / 2} y={padTop + plotHeight - (series[0].values[catIndex] || 0) / axisMax * plotHeight - 4} fontSize={8} textAnchor="middle" className="fill-slate-500 dark:fill-slate-300">
                  {series[0].values[catIndex] || 0}
                </text>
              )}
              <text x={x + barWidth / 2} y={height - 6} fontSize={8} textAnchor="middle" className="fill-slate-400">
                {categories[catIndex]}
              </text>
            </g>
          );
        })}

        {overlayLine && (
          <motion.path
            d={buildSmoothPath(
              order.map((catIndex, pos) => ({
                x: padX + pos * (barWidth + gap) + barWidth / 2,
                y: padTop + plotHeight - ((overlayLine[catIndex] || 0) / axisMax) * plotHeight,
              }))
            )}
            fill="none"
            stroke={overlayLineColor || "#1e293b"}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        )}
      </svg>

      <ChartTooltip visible={hover !== null} xPct={hover !== null ? ((padX + hover * (barWidth + gap) + barWidth / 2) / width) * 100 : 0} yPct={20}>
        {hover !== null && (
          <div className="space-y-0.5">
            <div>{categories[order[hover]]}</div>
            {series.map((s) => (
              <div key={s.key} className="text-brand-300">
                {s.label}: {s.values[order[hover]] || 0}
              </div>
            ))}
            {overlayLine && (
              <div className="text-slate-300">
                {overlayLineLabel}: {Math.round(overlayLine[order[hover]] || 0)}
              </div>
            )}
          </div>
        )}
      </ChartTooltip>

      {(showLegend && series.length > 1) || overlayLine ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
          {showLegend &&
            series.length > 1 &&
            series.map((s) => (
              <span key={s.key} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          {overlayLine && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 rounded" style={{ background: overlayLineColor || "#1e293b" }} />
              {overlayLineLabel}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
