import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { analyzeBehavior, fetchBehaviorLatest, fetchLearningPatterns } from "../../services/journalApi";
import { buildDemoBehaviorLatest, buildDemoLearningPatterns } from "../../Components/charts/demoData";
import BarChart from "../../Components/charts/BarChart";
import RadialGauge from "../../Components/charts/RadialGauge";
import { BRAND, PINK } from "../../Components/charts/chartTheme";

const ARCHETYPES = [
  { key: "Consistent Learner", icon: "🧭", tone: "low" },
  { key: "Highly Engaged Student", icon: "🌟", tone: "low" },
  { key: "Last-Minute Learner", icon: "⏰", tone: "medium" },
  { key: "Overloaded Student", icon: "😮‍💨", tone: "high" },
  { key: "Low Engagement Student", icon: "😴", tone: "high" },
];

const TONE_CLASSES = {
  low: "border-low-500/25 bg-low-50 dark:bg-low-500/10 text-low-600 dark:text-low-500",
  medium: "border-medium-500/25 bg-medium-50 dark:bg-medium-500/10 text-medium-600",
  high: "border-high-500/25 bg-high-50 dark:bg-high-500/10 text-high-600",
};

function snapshotRows(snap) {
  if (!snap) return [];
  const dp = snap.deadline_proximity || {};
  const tc = snap.task_completion_history || {};
  const ed = snap.engagement_distribution || {};
  const ap = snap.assignment_progress || {};
  return [
    {
      label: "Observation window",
      value:
        snap.account_age_days != null
          ? `${snap.observation_window_days} days (account is ${snap.account_age_days} days old)`
          : `${snap.observation_window_days} days`,
    },
    { label: "Avg study hours / day", value: `${snap.study_hours_avg_per_day ?? 0} h` },
    { label: "Total study hours (window)", value: `${snap.study_hours_last_14_days ?? 0} h` },
    { label: "Total journal sessions (window)", value: snap.total_sessions_last_14_days ?? 0 },
    { label: "Activity frequency", value: `${Math.round((snap.activity_frequency ?? 0) * 100)}% of window days` },
    { label: "Engagement trend", value: snap.engagement_trend || "insufficient_data" },
    { label: "Engagement (high / medium / low)", value: `${ed.high ?? 0} / ${ed.medium ?? 0} / ${ed.low ?? 0}` },
    {
      label: "Assignment progress",
      value: Object.keys(ap).length ? Object.entries(ap).map(([k, v]) => `${k}: ${v}`).join(", ") : "none recorded",
    },
    { label: "Tasks completed", value: `${tc.completed_tasks ?? 0} / ${tc.total_tasks ?? 0}` },
    {
      label: "Deadline proximity",
      value: `nearest ${dp.nearest_deadline_days ?? "—"}d · due≤3d: ${dp.due_within_3_days ?? 0} · due≤7d: ${dp.due_within_7_days ?? 0} · overdue: ${dp.overdue ?? 0}`,
    },
    { label: "Last activity", value: snap.last_activity_date ? new Date(snap.last_activity_date).toLocaleString() : "—" },
  ];
}

export default function BehaviorAnalysisSection({ userId, demoMode }) {
  const [latest, setLatest] = useState(null);
  const [latestStatus, setLatestStatus] = useState("loading");
  const [snapshot, setSnapshot] = useState(null);
  const [runStatus, setRunStatus] = useState("idle"); // idle | loading | ready | error

  useEffect(() => {
    if (demoMode) {
      setLatest(buildDemoBehaviorLatest());
      setSnapshot(buildDemoLearningPatterns(14));
      setLatestStatus("ready");
      return undefined;
    }
    let cancelled = false;
    setLatestStatus("loading");
    Promise.all([fetchBehaviorLatest(userId), fetchLearningPatterns(userId, 14)])
      .then(([latestResult, snapshotResult]) => {
        if (cancelled) return;
        setLatest(latestResult);
        setSnapshot(snapshotResult);
        setLatestStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setLatestStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, demoMode]);

  async function runAnalysis() {
    if (demoMode || runStatus === "loading") return;
    setRunStatus("loading");
    try {
      const result = await analyzeBehavior(userId);
      setLatest({
        available: true,
        behaviorCategory: result.behaviorCategory,
        reasoning: result.reasoning,
        created_at: result.generatedAt,
        generated_at: result.generatedAt,
        snapshotOfActivityData: result.snapshotOfActivityData,
      });
      setRunStatus("ready");
    } catch {
      setRunStatus("error");
    }
  }

  if (latestStatus === "loading") {
    return <div className="h-40 animate-pulse rounded-3xl bg-brand-50/50 dark:bg-white/5" />;
  }

  const current = latest?.available ? ARCHETYPES.find((a) => a.key === latest.behaviorCategory) : null;
  const noRecordedActivity = snapshot && snapshot.recordedness.study_minutes_recorded_share === 0 && !snapshot.engagement_distribution.any_recorded;

  return (
    <div className="space-y-4">
      {demoMode && (
        <span className="inline-block rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">DEMO DATA (synthetic)</span>
      )}

      {/* hero card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1a1530] px-5 py-5 shadow-[0_4px_14px_-4px_rgb(23_15_46_/_0.08)]"
      >
        {latest?.available ? (
          <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${TONE_CLASSES[current?.tone || "medium"]}`}>
            <span className="text-2xl leading-none">{current?.icon || "🧭"}</span>
            <div className="min-w-0">
              <div className="text-base font-bold">{latest.behaviorCategory}</div>
              <p className="mt-1 text-sm leading-snug opacity-90">{latest.reasoning}</p>
              <p className="mt-2 text-[11px] opacity-70">
                {latest.created_at && new Date(latest.created_at).toLocaleString()} - AI-generated pattern description based on your journal
                activity. It is not a diagnosis or a judgement.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No behaviour analysis has been run yet.</p>
        )}
      </motion.div>

      {/* variables used */}
      {latest?.available && latest.snapshotOfActivityData && (
        <div className="rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1a1530] px-4 py-4 shadow-[0_4px_14px_-4px_rgb(23_15_46_/_0.08)]">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Variables used for this verdict</div>
          <p className="mt-0.5 text-xs text-slate-400">
            Not compared against other students - the AI reads these numbers from your own activity and picks one of the 5 archetypes below.
          </p>
          <ul className="mt-3 space-y-1.5">
            {snapshotRows(latest.snapshotOfActivityData).map((row) => (
              <li key={row.label} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-slate-400">{row.label}</span>
                <span className="text-right font-medium text-slate-700 dark:text-slate-200">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* archetype row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {ARCHETYPES.map((a) => {
          const active = latest?.available && latest.behaviorCategory === a.key;
          return (
            <div
              key={a.key}
              className={`rounded-2xl border px-2.5 py-2.5 text-center text-[11px] ${
                active ? "border-brand-300 bg-brand-50 dark:bg-brand-500/15 font-semibold text-brand-700 dark:text-brand-200" : "border-slate-200 dark:border-white/10 text-slate-400"
              }`}
            >
              <div className="text-lg">{a.icon}</div>
              <div className="mt-0.5 leading-tight">{a.key}</div>
            </div>
          );
        })}
      </div>

      {/* what this is based on */}
      {snapshot && (
        <div className="rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1a1530] px-4 py-4 shadow-[0_4px_14px_-4px_rgb(23_15_46_/_0.08)]">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">What this is based on</div>
          <p className="mt-0.5 text-xs text-slate-400">Your last 14 journal dates</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-300">Minutes per day</div>
              <BarChart
                categories={snapshot.daily_series.map((d) => d.date.slice(5))}
                series={[{ key: "minutes", label: "Minutes", color: BRAND[500], values: snapshot.daily_series.map((d) => d.study_minutes) }]}
                height={110}
                valueLabels={false}
              />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-300">Engagement score per day</div>
              <BarChart
                categories={snapshot.daily_series.map((d) => d.date.slice(5))}
                series={[{ key: "engagement", label: "Engagement", color: PINK, values: snapshot.daily_series.map((d) => d.engagement_score || 0) }]}
                height={110}
                valueLabels={false}
              />
            </div>
            <div className="flex items-center justify-center">
              <RadialGauge
                value={snapshot.meta.n_active_days}
                max={snapshot.meta.effective_window_days || 14}
                label={`active days of ${snapshot.meta.effective_window_days || 14}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* analyze button */}
      <div className="rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1a1530] px-4 py-4 shadow-[0_4px_14px_-4px_rgb(23_15_46_/_0.08)]">
        {noRecordedActivity && (
          <p className="mb-2 text-xs text-slate-400">Little recorded activity data in the last 14 days, so the result may not be meaningful.</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">This sends a summary of your last 14 days of journal activity to the AI service.</p>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={demoMode || runStatus === "loading"}
            className="rounded-full bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {runStatus === "loading" ? "Analyzing…" : "Analyze my behaviour"}
          </button>
        </div>
        {runStatus === "error" && (
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-rose-600">
            <span>Couldn't run the analysis right now.</span>
            <button type="button" onClick={runAnalysis} className="rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-600">
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
