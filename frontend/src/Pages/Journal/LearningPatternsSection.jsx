import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fetchLearningPatterns } from "../../services/journalApi";
import { buildDemoLearningPatterns } from "../../Components/charts/demoData";
import { useCountUp } from "../../Components/charts/useCountUp";
import {
  formatMinutes,
  formatNumber,
  mostActiveWeekdayCaption,
  subjectCaption,
  trendCaption,
  correlationCaption,
  weekStartIso,
} from "../../Components/charts/chartHelpers";
import { BRAND, PINK } from "../../Components/charts/chartTheme";
import ChartCard from "../../Components/charts/ChartCard";
import BarChart from "../../Components/charts/BarChart";
import Histogram from "../../Components/charts/Histogram";
import LineAreaChart from "../../Components/charts/LineAreaChart";
import CalendarHeatmap from "../../Components/charts/CalendarHeatmap";
import ScatterPlot from "../../Components/charts/ScatterPlot";
import DonutChart from "../../Components/charts/DonutChart";
import Sparkline from "../../Components/charts/Sparkline";
import ProgressBar from "../../Components/charts/ProgressBar";

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

  const weeklyOnTimeVsCatchup = useMemo(() => {
    if (!data) return null;
    const buckets = {};
    for (const d of data.daily_series) {
      const wk = weekStartIso(d.date);
      buckets[wk] = buckets[wk] || { on_time: 0, catch_up: 0 };
      if (d.timing === "on_time") buckets[wk].on_time += d.sessions;
      else if (d.timing === "catch_up") buckets[wk].catch_up += d.sessions;
    }
    const weeks = Object.keys(buckets).sort();
    return {
      categories: weeks,
      series: [
        { key: "on_time", label: "On-time", color: BRAND[500], values: weeks.map((w) => buckets[w].on_time) },
        { key: "catch_up", label: "Catch-up", color: BRAND[300], values: weeks.map((w) => buckets[w].catch_up) },
      ],
    };
  }, [data]);

  const xpMovingAverage = useMemo(() => {
    if (!data) return [];
    const xps = data.daily_series.map((d) => d.xp);
    return xps.map((_, i) => {
      const slice = xps.slice(Math.max(0, i - 2), i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
  }, [data]);

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

  const minutesSeries = data.daily_series.map((d) => ({ date: d.date, value: d.study_minutes }));
  const anomalyDates = data.anomalies.items.map((a) => a.date);

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

      {/* weekly minutes */}
      <ChartCard
        title="Weekly study minutes"
        subtitle="Total minutes logged each week, with on-time vs catch-up journals below"
        caption={minutesRecorded ? `${formatMinutes(totalMinutes)} total over ${data.meta.n_active_days} active days.` : undefined}
        howCalculated="Sums study_duration_minutes across all completed journals in each calendar week (Monday start)."
        emptyState={!minutesRecorded ? <EmptyNote>Study time is not recorded in these journals (all values are 0). Trends need recorded study time.</EmptyNote> : null}
      >
        <BarChart
          categories={weeklyOnTimeVsCatchup.categories}
          series={[{ key: "minutes", label: "Minutes", color: BRAND[500], values: data.weekly_aggregates.map((w) => w.total_minutes) }]}
        />
        <div className="mt-3 border-t border-brand-50 dark:border-white/10 pt-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">On-time vs catch-up journals</p>
          <BarChart categories={weeklyOnTimeVsCatchup.categories} series={weeklyOnTimeVsCatchup.series} mode="stacked" height={70} valueLabels={false} showLegend />
        </div>
      </ChartCard>

      {/* daily minutes trend */}
      <ChartCard
        title="Daily study minutes"
        subtitle="Theil-Sen trend line, anomalies ringed"
        caption={minutesRecorded ? trendCaption(data.trends.study_minutes) : undefined}
        howCalculated={`Theil-Sen slope (median of pairwise slopes) + Mann-Kendall significance test, threshold |Z| >= ${data.trends.study_minutes.mann_kendall.threshold_z}. Needs at least 7 active days; you have ${data.meta.n_active_days}.`}
        emptyState={!minutesRecorded ? <EmptyNote>Study time is not recorded in these journals (all values are 0). Trends need recorded study time.</EmptyNote> : null}
      >
        <LineAreaChart series={minutesSeries} color={BRAND[500]} trendSlope={data.trends.study_minutes.slope_per_day} anomalyDates={anomalyDates} />
        {!data.anomalies.eligible && (
          <p className="mt-1 text-[10px] text-slate-400">
            Anomaly detection needs at least {data.anomalies.min_active_days_required} active days; you have {data.meta.n_active_days}.
          </p>
        )}
      </ChartCard>

      {/* calendar heatmap */}
      <ChartCard
        title="Journal calendar"
        subtitle="Journal date - catch-up journals are placed on the day they describe, so this calendar shows journal coverage, not the day you played."
        howCalculated="Each cell is a journal date in the window: on-time, catch-up (backfilled for a missed day), completed with unknown timing, or no journal."
      >
        <CalendarHeatmap cells={data.calendar.cells} />
      </ChartCard>

      {/* weekday pattern */}
      <ChartCard
        title="Weekday pattern"
        subtitle="Journals per weekday (hover for minutes)"
        caption={mostActiveWeekdayCaption(data.weekday_distribution.journals)}
        howCalculated={`Shannon entropy of the weekday counts, normalized 0..1. ${data.weekday_distribution.normalized_entropy === null ? "Not enough spread yet to show a consistency score." : `Consistency: ${Math.round(data.weekday_distribution.normalized_entropy * 100)}% evenly spread across weekdays.`}`}
      >
        <BarChart categories={data.weekday_distribution.labels} series={[{ key: "journals", label: "Journals", color: BRAND[500], values: data.weekday_distribution.journals }]} />
      </ChartCard>

      {/* XP per journal */}
      <ChartCard
        title="XP earned per journal (as stored)"
        subtitle="3-journal moving average shown as the dark line"
        howCalculated={data.meta.xp_note}
      >
        <BarChart
          categories={data.daily_series.map((d) => d.date.slice(5))}
          series={[{ key: "xp", label: "XP", color: PINK, values: data.daily_series.map((d) => d.xp) }]}
          overlayLine={xpMovingAverage}
          overlayLineLabel="3-journal avg"
          valueLabels={false}
        />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <ChartCard title="Subject share" howCalculated="Same subject totals as a share of the window.">
          <DonutChart segments={data.subject_effort.rows.map((r) => ({ label: r.subject, value: data.subject_effort.sorted_by === "minutes" ? r.minutes : r.journals }))} />
        </ChartCard>
      </div>

      {/* histogram + scatter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChartCard
          title="Study-minutes distribution"
          subtitle="Days with recorded minutes only"
          howCalculated={data.minutes_histogram.method}
          emptyState={!minutesRecorded ? <EmptyNote>Study time is not recorded in these journals (all values are 0).</EmptyNote> : null}
        >
          <Histogram bins={{ labels: data.minutes_histogram.bin_labels, counts: data.minutes_histogram.counts }} />
        </ChartCard>
        <ChartCard
          title="Study time vs XP"
          caption={correlationCaption(data.scatter.correlation)}
          howCalculated="Spearman rank correlation; null when either side never varies or n < 10."
          emptyState={data.scatter.correlation.rho === null ? <EmptyNote>Not enough variation to compute a correlation ({data.scatter.correlation.reason}).</EmptyNote> : null}
        >
          <ScatterPlot points={data.scatter.points.map((p) => ({ x: p.study_minutes, y: p.xp, label: p.date }))} xLabel="minutes" yLabel="XP" />
        </ChartCard>
      </div>

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

      {/* recorded-ness */}
      <ChartCard title="Recorded-ness" subtitle="How much of this window actually has each field filled in" howCalculated="Share of sessions in the window with a non-zero/non-empty value for each field.">
        <div className="space-y-3">
          <ProgressBar label="Study time recorded" fraction={data.recordedness.study_minutes_recorded_share} />
          <ProgressBar label="Engagement recorded" fraction={data.recordedness.engagement_recorded_share} color={PINK} />
          <ProgressBar label="Subjects recorded" fraction={data.recordedness.subjects_recorded_share} />
        </div>
      </ChartCard>

      <p className="text-[11px] text-slate-400 text-center">
        {formatNumber(data.meta.n_sessions)} sessions generated this view at {new Date(data.meta.generated_at).toLocaleString()}.
      </p>
    </div>
  );
}
