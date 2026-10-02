import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Database, Gamepad2, Siren, HelpCircle, Brain } from "lucide-react";
import { useGameStore } from "../../Game/state/GameStateManager";
import {
  fetchStudyInsights,
  fetchDataQuality,
  fetchAlertRuleCatalog,
  fetchAlertRulesForUser,
  fetchQuestionBank,
  simulateGamification,
} from "../../services/journalApi";
import LearningStyleCard from "./LearningStyleCard";
import { LineTrendChart, BarDistributionChart, RadialGauge } from "../../Components/charts/SvgCharts";

const SUB_TABS = [
  { id: "insights", label: "My Study Insights", icon: BarChart3 },
  { id: "quality", label: "My Data Quality", icon: Database },
  { id: "behavior", label: "Behaviour Analysis", icon: Brain },
  { id: "simulator", label: "Gamification Simulator", icon: Gamepad2 },
  { id: "alerts", label: "Alert Rules Explorer", icon: Siren },
  { id: "questions", label: "Question Bank Explorer", icon: HelpCircle },
];

function SectionCard({ title, subtitle, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-brand-100 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-4 shadow-sm hover:shadow-lg hover:shadow-brand-100/60 dark:hover:shadow-none"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</div>
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </motion.div>
  );
}

function StatCard({ icon, value, label, hint }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03, y: -2 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-2xl border border-brand-200/70 dark:border-brand-400/30 bg-gradient-to-br from-brand-50 to-pink-50 dark:from-brand-700/20 dark:to-pink-500/10 px-3.5 py-3.5 shadow-sm hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{icon}</span>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-500/80 dark:text-brand-300/80">{label}</div>
      </div>
      <motion.div
        key={String(value)}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        className="mt-1.5 text-2xl font-black tabular-nums text-brand-700 dark:text-brand-200"
      >
        {value}
      </motion.div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}
    </motion.div>
  );
}

function useFetch(fn, deps) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fn()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, status };
}

function StudyInsightsTab({ userId }) {
  const { data, status } = useFetch(() => fetchStudyInsights(userId), [userId]);

  if (status === "loading") return <p className="text-xs italic text-slate-400">Loading your study insights…</p>;
  if (status === "error" || !data) return <p className="text-xs text-slate-400">Insights aren't available right now.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          icon="📔"
          label="Journals"
          value={data.total_completed_journals}
          hint={`${data.on_time_journals} on-time · ${data.catchup_journals} catch-up`}
        />
        <StatCard icon="⏱️" label="Avg study / day" value={`${data.study_duration.average_minutes}m`} hint={`trend: ${data.study_duration.trend}`} />
        <StatCard icon="⚡" label="Avg XP / day" value={data.xp_earned.average_xp} hint={`trend: ${data.xp_earned.trend}`} />
      </div>

      <SectionCard title="Study duration over time" subtitle="Minutes per completed journal, in order">
        <LineTrendChart series={data.study_duration.series} valueKey="minutes" />
      </SectionCard>

      <SectionCard title="XP earned over time">
        <LineTrendChart series={data.xp_earned.series} valueKey="xp" color="#ec4899" />
      </SectionCard>

      <div className="grid grid-cols-2 gap-3">
        <SectionCard title="Engagement distribution" subtitle={`entropy: ${data.engagement_entropy_bits} bits`}>
          <BarDistributionChart data={data.engagement_distribution} />
        </SectionCard>
        <SectionCard title="Subject focus distribution" subtitle={`entropy: ${data.subject_focus_entropy_bits} bits`}>
          <BarDistributionChart data={data.subject_distribution} color="#ec4899" />
        </SectionCard>
      </div>

      <SectionCard title="Study time vs XP correlation" subtitle="Spearman rank correlation, -1 to 1">
        <div className="text-xl font-bold text-brand-600">{data.duration_vs_xp_correlation}</div>
      </SectionCard>
    </div>
  );
}

function DataQualityTab({ userId }) {
  const { data, status } = useFetch(() => fetchDataQuality(userId), [userId]);

  if (status === "loading") return <p className="text-xs italic text-slate-400">Checking your data quality…</p>;
  if (status === "error" || !data) return <p className="text-xs text-slate-400">Data quality isn't available right now.</p>;

  const c = data.completeness;

  return (
    <div className="space-y-4">
      <SectionCard title="Completeness" subtitle={`${c.completed_journals} journals over ${c.calendar_days_since_first_journal} calendar days`}>
        <div className="flex items-center gap-4">
          <RadialGauge value={c.completeness_ratio * 100} max={100} label="completeness" />
          <div className="text-xs text-slate-500 dark:text-slate-300">
            <div>{c.missed_days} missed day(s)</div>
            {c.missed_dates.length > 0 && (
              <div className="mt-1 text-slate-400">{c.missed_dates.slice(0, 6).join(", ")}{c.missed_dates.length > 6 ? "…" : ""}</div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Study-duration outliers" subtitle="Robust (MAD) z-score >= 3.5">
        {data.study_duration_outliers.length === 0 ? (
          <p className="text-xs text-slate-400">No unusual days found.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {data.study_duration_outliers.map((o) => (
              <li key={o.date}>
                {o.date}: {o.minutes}m (z={o.robust_zscore})
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Near-duplicate journal entries" subtitle="TF-IDF cosine similarity >= 0.85">
        {data.near_duplicate_entries.length === 0 ? (
          <p className="text-xs text-slate-400">No near-duplicates found.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {data.near_duplicate_entries.map((d, i) => (
              <li key={i}>
                {d.date_a} ↔ {d.date_b} (similarity {d.similarity})
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Sessions with unanswered questions">
        {data.incomplete_question_sessions.length === 0 ? (
          <p className="text-xs text-slate-400">Every journal answered its full question set.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {data.incomplete_question_sessions.map((s) => (
              <li key={s.date}>
                {s.date}: {s.questions_answered}/{s.max_questions} answered
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function BehaviorAnalysisTab() {
  return (
    <SectionCard title="Behaviour Analysis" subtitle="The same LLM-based learning-style analysis shown on Character Stats.">
      <LearningStyleCard />
    </SectionCard>
  );
}

const ENGAGEMENT_OPTIONS = ["low", "medium", "high"];

function GamificationSimulatorTab() {
  const [days, setDays] = useState(10);
  const [questionsPerDay, setQuestionsPerDay] = useState(5);
  const [engagement, setEngagement] = useState("high");
  const [missEveryNth, setMissEveryNth] = useState(0); // 0 = never miss
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");

  async function runSimulation() {
    setStatus("loading");
    const plan = Array.from({ length: days }, (_, i) => {
      const dayNumber = i + 1;
      const missed = missEveryNth > 0 && dayNumber % missEveryNth === 0;
      return {
        play: !missed,
        on_time: true,
        questions_count: questionsPerDay,
        engagement,
        has_at_risk: false,
      };
    });
    try {
      const data = await simulateGamification({ plan });
      setResult(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="What-if plan" subtitle="Uses the real XP/streak/badge formulas, but never touches your actual account.">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            Days to simulate
            <input
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
              className="rounded-lg border border-brand-100 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            Questions answered / day
            <input
              type="number"
              min={0}
              max={20}
              value={questionsPerDay}
              onChange={(e) => setQuestionsPerDay(Math.max(0, Number(e.target.value) || 0))}
              className="rounded-lg border border-brand-100 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            Engagement
            <select value={engagement} onChange={(e) => setEngagement(e.target.value)} className="rounded-lg border border-brand-100 px-2 py-1">
              {ENGAGEMENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Miss every Nth day (0 = never)
            <input
              type="number"
              min={0}
              max={30}
              value={missEveryNth}
              onChange={(e) => setMissEveryNth(Math.max(0, Number(e.target.value) || 0))}
              className="rounded-lg border border-brand-100 px-2 py-1"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={runSimulation}
          disabled={status === "loading"}
          className="mt-3 rounded-full bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {status === "loading" ? "Simulating…" : "Run simulation"}
        </button>
      </SectionCard>

      {status === "error" && <p className="text-xs text-rose-600">Simulation failed — try again.</p>}

      {status === "ready" && result && (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard icon="⚡" label="Final XP" value={result.final_total_xp} />
            <StatCard icon="🔥" label="Current streak" value={result.final_current_streak} />
            <StatCard icon="🏆" label="Longest streak" value={result.final_longest_streak} />
          </div>
          <SectionCard title="XP over the simulated plan">
            <LineTrendChart series={result.timeline} valueKey="total_xp" />
          </SectionCard>
          <SectionCard title="Badges earned">
            {result.final_badges.length === 0 ? (
              <p className="text-xs text-slate-400">No badges earned in this plan.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {result.final_badges.map((b) => (
                  <span key={b.key} className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                    {b.name}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

function AlertRulesExplorerTab({ userId }) {
  const [catalog, setCatalog] = useState(null);
  const [evaluated, setEvaluated] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([fetchAlertRuleCatalog(), fetchAlertRulesForUser(userId)])
      .then(([catalogData, evalData]) => {
        if (cancelled) return;
        setCatalog(catalogData);
        setEvaluated(evalData);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (status === "loading") return <p className="text-xs italic text-slate-400">Loading alert rules…</p>;
  if (status === "error" || !catalog) return <p className="text-xs text-slate-400">Alert rules aren't available right now.</p>;

  const activeKeys = new Set(evaluated?.active_rule_keys || []);

  return (
    <div className="space-y-3">
      {evaluated?.evaluated_against_date && (
        <p className="text-xs text-slate-400">Evaluated against your latest journal: {evaluated.evaluated_against_date}</p>
      )}
      {catalog.rules.map((rule) => {
        const active = activeKeys.has(rule.key);
        return (
          <div
            key={rule.key}
            className={`rounded-2xl border px-4 py-3 ${
              active ? "border-high-500/30 bg-high-50 dark:bg-high-500/10" : "border-brand-100 dark:border-white/10 bg-white dark:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{rule.name}</div>
              {active && <span className="rounded-full bg-high-500 px-2 py-0.5 text-[10px] font-bold text-white">ACTIVE NOW</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{rule.condition}</p>
          </div>
        );
      })}
      {evaluated?.generated_alert_messages?.length > 0 && (
        <SectionCard title="Messages this would currently generate">
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {evaluated.generated_alert_messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function QuestionBankExplorerTab() {
  const [category, setCategory] = useState("");
  const [activity, setActivity] = useState("");
  const { data, status } = useFetch(() => fetchQuestionBank({ category, activity }), [category, activity]);

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-brand-100 px-2 py-1">
              <option value="">All</option>
              {data.categories.map((c) => (
                <option key={c} value={c}>
                  {c} ({data.counts_by_category[c]})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Activity
            <select value={activity} onChange={(e) => setActivity(e.target.value)} className="rounded-lg border border-brand-100 px-2 py-1">
              <option value="">All</option>
              {data.activities.map((a) => (
                <option key={a} value={a}>
                  {a} ({data.counts_by_activity[a]})
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {status === "loading" && <p className="text-xs italic text-slate-400">Loading question bank…</p>}
      {status === "error" && <p className="text-xs text-slate-400">Question bank isn't available right now.</p>}

      {data && (
        <>
          <p className="text-xs text-slate-400">
            Showing {data.matched_questions} of {data.total_questions} questions
          </p>
          <div className="space-y-2">
            {data.questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-brand-100 dark:border-white/10 px-3 py-2.5 text-xs">
                <div className="font-semibold text-slate-700 dark:text-slate-200">{q.question}</div>
                <div className="mt-1 text-slate-400">
                  {q.category} · {(q.activities || []).join(", ")} · {q.answer_type}
                </div>
                {q.options && <div className="mt-1 text-slate-500 dark:text-slate-300">Options: {q.options.join(" / ")}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalyticsContent() {
  const userId = useGameStore((s) => s.userId);
  const [subTab, setSubTab] = useState("insights");

  return (
    <div>
      <h2 className="font-display text-xl font-bold mb-0.5 text-slate-800 dark:text-white">Analytics</h2>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        A read-only look at your own study patterns, data quality, and the rules behind your journal's alerts and badges.
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl bg-brand-50/60 dark:bg-white/5 p-1.5 ring-1 ring-brand-100/70 dark:ring-white/10">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-colors ${
                active ? "text-white shadow-playful" : "text-brand-600 hover:bg-white/70 dark:hover:bg-white/10"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="analytics-subtab-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon size={13} strokeWidth={2.3} className="relative z-10" />
              <span className="relative z-10">{t.label}</span>
            </motion.button>
          );
        })}
      </div>

      {!userId ? (
        <p className="text-xs text-slate-400">Sign in to see your analytics.</p>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {subTab === "insights" && <StudyInsightsTab userId={userId} />}
            {subTab === "quality" && <DataQualityTab userId={userId} />}
            {subTab === "behavior" && <BehaviorAnalysisTab />}
            {subTab === "simulator" && <GamificationSimulatorTab />}
            {subTab === "alerts" && <AlertRulesExplorerTab userId={userId} />}
            {subTab === "questions" && <QuestionBankExplorerTab />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
