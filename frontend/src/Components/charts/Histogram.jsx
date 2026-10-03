import BarChart from "./BarChart";
import { binValues } from "./chartHelpers";
import { BRAND } from "./chartTheme";

/**
 * Either pass precomputed `bins={labels, counts}` (the real API's shape),
 * or `values` (raw per-day numbers) and this bins them client-side - used
 * for the synthetic demo-data path.
 */
export default function Histogram({ bins, values, binWidth = 30, height = 150, color = BRAND[500] }) {
  const resolved = bins || binValues(values || [], { binWidth });
  if (!resolved.labels?.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-xl bg-brand-50/40 dark:bg-white/5 text-xs text-slate-400">
        Study time is not recorded in these journals.
      </div>
    );
  }
  return (
    <BarChart
      categories={resolved.labels}
      series={[{ key: "count", label: "Days", color, values: resolved.counts }]}
      height={height}
    />
  );
}
