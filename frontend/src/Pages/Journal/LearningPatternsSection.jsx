import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchLearningPatterns } from "../../services/journalApi";
import { buildDemoLearningPatterns } from "../../Components/charts/demoData";
import { useCountUp } from "../../Components/charts/useCountUp";
import {
  formatNumber,
  mostActiveWeekdayCaption,
  subjectCaption,
} from "../../Components/charts/chartHelpers";
import { BRAND, PINK } from "../../Components/charts/chartTheme";
import ChartCard from "../../Components/charts/ChartCard";
import BarChart from "../../Components/charts/BarChart";
import DonutChart from "../../Components/charts/DonutChart";
import Sparkline from "../../Components/charts/Sparkline";

function KpiTile({ icon, label, value, suffix = "", hint, sparkValues, color }) {
  const isNumeric = typeof value === "number";
  const animated = useCountUp(isNumeric ? value : 0);
  const display = isNumeric ? Math.round(animated) : value;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03, y: -2 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-2xl border border-brand-200/70 dark:border-brand-400/30 bg-gradient-to-br from-brand-50 to-pink-50 dark:from-brand-700/20 dark:to-pink-500/10 px-3.5 py-3.5 shadow-sm hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{icon}</span>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-500/80 dark:text-brand-300/80">{label}</div>
        </div>
        {sparkValues && sparkValues.length >= 2 && <Sparkline values={sparkValues} width={52} height={20} color={color} />}
      </div>
      <div className="mt-1.5 text-2xl font-black tabular-nums text-brand-700 dark:text-brand-200">
        {display}
        {suffix}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}
    </motion.div>
  );
}

function EmptyNote({ children }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-brand-50/50 dark:bg-white/5 px-3 py-6 text-center">
      <p className="w-full text-xs text-slate-400">{children}</p>
    </div>
  );
}

export default function LearningPatternsSection({ userId, windowDays, demoMode }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (demoMode) {
      setData(buildDemoLearningPatterns(windowDays));
      setStatus("ready");
      return undefined;
    }
    let cancelled = false;
    setStatus("loading");
    fetchLearningPatterns(userId, windowDays)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, windowDays, demoMode]);

  if (status === "loading") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-brand-50/50 dark:bg-white/5" />
        ))}
      </div>
    );
  }
  if (status === "error" || !data) {
    return <p className="text-xs text-slate-400">Learning patterns aren't available right now.</p>;
  }

  const totalMinutes = data.daily_series.reduce((sum, d) => sum + d.study_minutes, 0);
  const totalXp = data.daily_series.reduce((sum, d) => sum + d.xp, 0);
  const totalSessions = data.daily_series.reduce((sum, d) => sum + d.sessions, 0) || 1;
  const minutesRecorded = data.recordedness.study_minutes_recorded_share > 0;
  const engagementRecorded = data.engagement_distribution.any_recorded;

  return (
    <div className="space-y-4">
      {demoMode && (
        <span className="inline-block rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">DEMO DATA (synthetic)</span>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <KpiTile icon="📔" label="Journals" value={data.meta.n_sessions} color={BRAND[500]} sparkValues={data.daily_series.map((d) => d.sessions)} />
        <KpiTile icon="📅" label="Active days" value={data.meta.n_active_days} color={BRAND[500]} />
        <KpiTile
          icon="⏱️"
          label="Study minutes"
          value={minutesRecorded ? totalMinutes : "Not recorded"}
          color={PINK}
          sparkValues={minutesRecorded ? data.daily_series.map((d) => d.study_minutes) : null}
        />
        <KpiTile icon="⚡" label="Avg XP / journal" value={Math.round(totalXp / totalSessions)} color={PINK} sparkValues={data.daily_series.map((d) => d.xp)} />
        <KpiTile icon="🔥" label="Current streak" value={data.calendar.current_streak} hint="on-time days only" color={BRAND[500]} />
        <KpiTile icon="🏆" label="Longest streak" value={data.calendar.longest_streak} hint="on-time days only" color={BRAND[500]} />
      </div>

      {/* weekday pattern */}
      <ChartCard
        title="Weekday pattern"
        subtitle="Journals per weekday (hover for minutes)"
        caption={mostActiveWeekdayCaption(data.weekday_distribution.journals)}
        howCalculated={`Shannon entropy of the weekday counts, normalized 0..1. ${data.weekday_distribution.normalized_entropy === null ? "Not enough spread yet to show a consistency score." : `Consistency: ${Math.round(data.weekday_distribution.normalized_entropy * 100)}% evenly spread across weekdays.`}`}
      >
        <BarChart categories={data.weekday_distribution.labels} series={[{ key: "journals", label: "Journals", color: BRAND[500], values: data.weekday_distribution.journals }]} />
      </ChartCard>

      {/* engagement */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChartCard
          title="Engagement per week"
          emptyState={!engagementRecorded ? <EmptyNote>Engagement was not recorded for these journals.</EmptyNote> : null}
          howCalculated="Counts of low/medium/high engagement answers per calendar week."
        >
          <BarChart
            categories={(data.engagement_distribution.per_week || []).map((w) => w.week_start)}
            series={[
              { key: "low", label: "Low", color: "#fbcfe8", values: (data.engagement_distribution.per_week || []).map((w) => w.low) },
              { key: "medium", label: "Medium", color: BRAND[300], values: (data.engagement_distribution.per_week || []).map((w) => w.medium) },
              { key: "high", label: "High", color: BRAND[600], values: (data.engagement_distribution.per_week || []).map((w) => w.high) },
            ]}
            mode="stacked"
          />
        </ChartCard>
        <ChartCard
          title="Engagement overall"
          emptyState={!engagementRecorded ? <EmptyNote>Engagement was not recorded for these journals.</EmptyNote> : null}
          howCalculated="Same counts as a share of total; normalized entropy shows how evenly spread they are (null needs 2+ categories with data)."
        >
          <DonutChart
            segments={[
              { label: "Low", value: data.engagement_distribution.counts.low, color: "#fbcfe8" },
              { label: "Medium", value: data.engagement_distribution.counts.medium, color: BRAND[300] },
              { label: "High", value: data.engagement_distribution.counts.high, color: BRAND[600] },
            ]}
          />
        </ChartCard>
      </div>

      {/* subjects */}
      <ChartCard
        title={`Subjects by ${data.subject_effort.sorted_by}`}
        caption={subjectCaption(data.subject_effort.rows)}
        howCalculated={`Sorted by ${data.subject_effort.sorted_by} recorded per subject. Normalized entropy: ${data.subject_effort.normalized_entropy === null ? "not enough subjects with data" : Math.round(data.subject_effort.normalized_entropy * 100) + "%"}.`}
        emptyState={!data.subject_effort.rows.length ? <EmptyNote>No subjects recorded yet.</EmptyNote> : null}
      >
        <BarChart
          orientation="horizontal"
          categories={data.subject_effort.rows.map((r) => r.subject)}
          series={[{ key: "effort", label: data.subject_effort.sorted_by, color: BRAND[500], values: data.subject_effort.rows.map((r) => (data.subject_effort.sorted_by === "minutes" ? r.minutes : r.journals)) }]}
          sorted
        />
      </ChartCard>

      {/* hour of day */}
      {data.hour_of_day && (
        <ChartCard
          title="Hour of day"
          subtitle={`Based on ${data.hour_of_day.based_on}, ${data.hour_of_day.timezone} time`}
          howCalculated="Counts journal-session start times by local hour; there's no separate 'completed at' timestamp, so this uses session start time as the closest available proxy."
        >
          <BarChart categories={Array.from({ length: 24 }, (_, h) => String(h))} series={[{ key: "count", label: "Journals", color: BRAND[500], values: data.hour_of_day.counts }]} valueLabels={false} />
        </ChartCard>
      )}

      <p className="text-[11px] text-slate-400 text-center">
        {formatNumber(data.meta.n_sessions)} sessions generated this view at {new Date(data.meta.generated_at).toLocaleString()}.
      </p>
    </div>
  );
}
