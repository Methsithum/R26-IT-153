import { useState } from "react";
import { useGameStore } from "../../Game/state/GameStateManager";
import { analyzeBehavior } from "../../services/journalApi";

const BEHAVIOR_META = {
  "Consistent Learner": { icon: "🧭", tone: "low" },
  "Highly Engaged Student": { icon: "🌟", tone: "low" },
  "Last-Minute Learner": { icon: "⏰", tone: "medium" },
  "Overloaded Student": { icon: "😮‍💨", tone: "high" },
  "Low Engagement Student": { icon: "😴", tone: "high" },
};

const BEHAVIOR_TONE_CLASSES = {
  low: "border-low-500/25 bg-low-50 dark:bg-low-500/10 text-low-600 dark:text-low-500",
  medium: "border-medium-500/25 bg-medium-50 dark:bg-medium-500/10 text-medium-600",
  high: "border-high-500/25 bg-high-50 dark:bg-high-500/10 text-high-600",
};

export default function LearningStyleCard() {
  const userId = useGameStore((s) => s.userId);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");

  async function runAnalysis() {
    if (!userId || status === "loading") return;
    setStatus("loading");
    try {
      const data = await analyzeBehavior(userId);
      setResult(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  const meta = result ? BEHAVIOR_META[result.behaviorCategory] : null;

  return (
    <div className="rounded-2xl border border-brand-100 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3.5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Learning Style</div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={status === "loading"}
          className="rounded-full bg-brand-50 dark:bg-white/10 px-3 py-1 text-[11px] font-semibold text-brand-600 dark:text-brand-300 transition-colors hover:bg-brand-100 disabled:opacity-40"
        >
          {status === "loading" ? "Analyzing…" : result ? "Re-analyze" : "Analyze"}
        </button>
      </div>
      {status === "idle" && (
        <p className="text-xs text-slate-400">See how the last 14 days of check-ins read as a study pattern.</p>
      )}
      {status === "error" && (
        <p className="text-xs text-rose-700 dark:text-rose-400">Couldn't run the analysis right now — try again in a moment.</p>
      )}
      {status === "ready" && result && meta && (
        <div className={`mt-2 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${BEHAVIOR_TONE_CLASSES[meta.tone]}`}>
          <span className="text-lg leading-none">{meta.icon}</span>
          <div className="min-w-0">
            <div className="text-sm font-bold">{result.behaviorCategory}</div>
            <p className="mt-0.5 text-xs leading-snug opacity-90">{result.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  );
}
