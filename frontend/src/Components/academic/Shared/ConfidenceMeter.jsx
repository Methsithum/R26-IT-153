import { confidenceCopy } from "../../../utils/featureNameMap";

const TONE_COLOR = {
  confident: "bg-low-500",
  moderate: "bg-medium-500",
  low: "bg-slate-400",
};

export default function ConfidenceMeter({ confidence }) {
  if (confidence == null) return null;
  const { pct, tone, label } = confidenceCopy(confidence);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span>Model confidence</span>
        <span className="font-semibold text-slate-500 dark:text-slate-300">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full ${TONE_COLOR[tone]} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-400 mt-1">{label}</p>
    </div>
  );
}
