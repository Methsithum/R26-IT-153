import { useState } from "react";
import { motion } from "framer-motion";
import { heatmapWeeks } from "./chartHelpers";
import { BRAND } from "./chartTheme";

const STATUS_COLOR = {
  none: "#e4d9ff33",
  on_time: BRAND[500],
  catch_up: BRAND[300],
  not_recorded: "#cbd5e1",
};
const STATUS_LABEL = {
  none: "No journal",
  on_time: "On-time",
  catch_up: "Catch-up",
  not_recorded: "Completed (timing unknown)",
};

export default function CalendarHeatmap({ cells = [] }) {
  const [hover, setHover] = useState(null);
  if (!cells.length) {
    return <div className="flex h-24 items-center justify-center text-xs text-slate-400">No calendar data yet.</div>;
  }
  const weeks = heatmapWeeks(cells);
  const cellSize = 13;
  const gap = 3;

  return (
    <div>
      <div className="relative overflow-x-auto pb-1">
        <svg width={weeks.length * (cellSize + gap)} height={7 * (cellSize + gap)}>
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              if (!cell) return null;
              const x = wi * (cellSize + gap);
              const y = di * (cellSize + gap);
              const isHover = hover === cell.date;
              return (
                <motion.rect
                  key={cell.date}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={3}
                  fill={STATUS_COLOR[cell.status] || STATUS_COLOR.none}
                  stroke={isHover ? BRAND[700] : "transparent"}
                  strokeWidth={1.5}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.004 * (wi * 7 + di) }}
                  onMouseEnter={() => setHover(cell.date)}
                  onMouseLeave={() => setHover(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${cell.date}: ${STATUS_LABEL[cell.status] || "no data"}`}
                />
              );
            })
          )}
        </svg>
      </div>
      {hover && (
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">
          {hover}: {STATUS_LABEL[cells.find((c) => c.date === hover)?.status] || "no data"}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
        {Object.entries(STATUS_LABEL).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: STATUS_COLOR[key] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
