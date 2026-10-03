import { useRef } from "react";
import { motion } from "framer-motion";
import HowCalculatedPopover from "./HowCalculatedPopover";
import DownloadPngButton from "./DownloadPngButton";

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1a1530] px-4 py-4 shadow-[0_4px_14px_-4px_rgb(23_15_46_/_0.08)] animate-pulse">
      <div className="h-3 w-1/3 rounded bg-brand-100/60 dark:bg-white/10" />
      <div className="mt-2 h-2 w-2/3 rounded bg-brand-50 dark:bg-white/5" />
      <div className="mt-4 h-32 rounded-xl bg-brand-50/60 dark:bg-white/5" />
    </div>
  );
}

export default function ChartCard({
  title,
  subtitle,
  caption,
  howCalculated,
  ariaLabel,
  loading = false,
  emptyState = null,
  children,
}) {
  const chartRef = useRef(null);

  if (loading) return <SkeletonCard />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1a1530] px-4 py-4 shadow-[0_4px_14px_-4px_rgb(23_15_46_/_0.08)] hover:shadow-lg hover:shadow-brand-100/60 dark:hover:shadow-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</div>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {howCalculated && <HowCalculatedPopover>{howCalculated}</HowCalculatedPopover>}
          <DownloadPngButton targetRef={chartRef} fileName={`${(title || "chart").toLowerCase().replace(/\s+/g, "-")}.png`} />
        </div>
      </div>

      {emptyState ? (
        <div className="mt-3">{emptyState}</div>
      ) : (
        <div ref={chartRef} role="img" aria-label={ariaLabel || title} className="mt-3 focus:outline-none" tabIndex={0}>
          {children}
        </div>
      )}

      {caption && !emptyState && <p className="mt-2 text-[11px] text-slate-400">{caption}</p>}
    </motion.div>
  );
}
