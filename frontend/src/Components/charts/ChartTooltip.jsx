import { AnimatePresence, motion } from "framer-motion";

// Shared floating tooltip for crosshair/hover interactions across charts.
// `xPct`/`yPct` position it relative to the chart's own bounding box.
export default function ChartTooltip({ visible, xPct = 0, yPct = 0, flip = false, children }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none absolute z-10 rounded-lg bg-slate-800 dark:bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-white dark:text-slate-800 shadow-lg"
          style={{
            left: `${xPct}%`,
            top: `${yPct}%`,
            transform: `translate(${flip ? "-100%" : "0%"}, -130%)`,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
