import { useEffect, useState } from "react";
import { useGameStore } from "../../Game/state/GameStateManager";
import { formatCampusDate } from "../../services/localDate";
import { getPredictionHistory, getUpcomingAssessments, predictAssessment } from "../../services/journalApi";
import { clamp100 } from "./scoreForecastUtils";

const UPCOMING_TYPE_LABELS = { mid: "Mid", final: "Final", lab: "Lab", quiz: "Quiz" };
const HISTORY_TYPE_LABELS = { TMA: "Assignment", CMA: "Quiz", Exam: "Exam" };

function upcomingTypeLabel(item) {
  if (item.kind === "task") return "Assignment";
  return UPCOMING_TYPE_LABELS[item.exam_type] || item.exam_type || "Exam";
}

// History rows only have the coarse OULAD-mapped type (features.assessment_type),
// not the original mid/final/lab/quiz distinction - the stored prediction
// document doesn't keep that separately. Honest label from what's actually stored.
function historyTypeLabel(entry) {
  return HISTORY_TYPE_LABELS[entry.features?.assessment_type] || entry.assessmentKind || "";
}

function ScaleBar({ estimate, low, high }) {
  const clampedLow = clamp100(low);
  const clampedHigh = clamp100(high);
  const clampedEstimate = clamp100(estimate);
  return (
    <div
      role="img"
      aria-label={`Estimated mark ${clampedEstimate} out of 100, likely between ${clampedLow} and ${clampedHigh}`}
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-white/10"
    >
      <div
        className="absolute inset-y-0 rounded-full bg-brand-300/70 dark:bg-brand-400/40"
        style={{ left: `${clampedLow}%`, width: `${Math.max(0, clampedHigh - clampedLow)}%` }}
      />
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow dark:border-[#1a1530]"
        style={{ left: `${clampedEstimate}%` }}
      />
    </div>
  );
}

function EstimateResult({ result }) {
  return (
    <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-3 py-3 dark:border-white/10 dark:bg-white/5">
      <div className="text-sm font-semibold text-slate-800 dark:text-white">
        Estimated mark: ~{result.estimated_mark} (likely between {result.range_low} and {result.range_high})
      </div>
      <div className="mt-2.5">
        <ScaleBar estimate={result.estimated_mark} low={result.range_low} high={result.range_high} />
      </div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Based on {result.n_previous_marks} previous mark{result.n_previous_marks === 1 ? "" : "s"} in this subject.
      </div>
      {result.warning && (
        <div className="mt-2 rounded-xl bg-medium-50 px-2.5 py-1.5 text-xs text-medium-600 dark:bg-medium-500/10">
          Not enough previous marks in this subject, so this estimate is uncertain.
        </div>
      )}
    </div>
  );
}

function UpcomingCard({ item, userId }) {
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function runEstimate() {
    if (status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const data = await predictAssessment({
        user_id: userId,
        subject: item.subject,
        assessment_kind: item.kind,
        exam_type: item.kind === "exam" ? item.exam_type : null,
        task_id: item.kind === "task" ? item.task_id : null,
        assessment_date: item.date,
      });
      setResult(data);
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Could not estimate this assessment.");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.subject}</div>
          <div className="text-xs text-slate-400">
            {upcomingTypeLabel(item)} · {formatCampusDate(item.date, { month: "short", day: "numeric" })} · in{" "}
            {item.days_left} day{item.days_left === 1 ? "" : "s"}
          </div>
        </div>
        <button
          type="button"
          onClick={runEstimate}
          disabled={status === "loading"}
          aria-label={`Estimate score for ${item.subject}`}
          className="shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100 disabled:opacity-40 dark:bg-white/10 dark:text-brand-300"
        >
          {status === "loading" ? "Estimating…" : result ? "Re-estimate" : "Estimate"}
        </button>
      </div>
      {status === "error" && <p className="mt-2 text-xs text-rose-700 dark:text-rose-400">{error}</p>}
      {status === "ready" && result && <EstimateResult result={result} />}
    </div>
  );
}

function HistoryRow({ entry }) {
  const hasActual = entry.actualMark !== null && entry.actualMark !== undefined;
  const diff = hasActual ? Math.round((entry.actualMark - entry.estimated) * 10) / 10 : null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{entry.subject}</div>
        <div className="text-[11px] text-slate-400">
          {historyTypeLabel(entry)} · {entry.assessmentDate}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs">
        <div className="text-slate-600 dark:text-slate-300">
          Estimated ~{entry.estimated} ({entry.low}-{entry.high})
        </div>
        {hasActual && (
          <div className="text-slate-400">
            Actual: {entry.actualMark} ({diff >= 0 ? "+" : ""}
            {diff})
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScoreForecastPage() {
  const userId = useGameStore((s) => s.userId);
  const [upcoming, setUpcoming] = useState([]);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [showInfo, setShowInfo] = useState(false);

  async function loadAll() {
    if (!userId) return;
    setStatus("loading");
    try {
      const [up, hist] = await Promise.all([getUpcomingAssessments(userId), getPredictionHistory(userId, 20)]);
      setUpcoming(up?.items || []);
      setHistory(hist?.predictions || []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) return;
      setStatus("loading");
      try {
        const [up, hist] = await Promise.all([getUpcomingAssessments(userId), getPredictionHistory(userId, 20)]);
        if (cancelled) return;
        setUpcoming(up?.items || []);
        setHistory(hist?.predictions || []);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="font-display text-xl font-bold mb-1 text-slate-800 dark:text-white">Score Forecast</h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Experimental estimates for your upcoming exams and assignments.
      </p>

      <button
        type="button"
        onClick={() => setShowInfo((v) => !v)}
        aria-expanded={showInfo}
        className="mb-3 self-start text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300"
      >
        How is this estimated? {showInfo ? "▲" : "▼"}
      </button>
      {showInfo && (
        <p className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 px-3 py-2.5 text-xs leading-relaxed text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          Experimental. The estimate uses your previous marks in this subject and the type of
          assessment. The model was trained on a public university dataset (OULAD), not on this
          app's students, so the range is wide. It is not an official result or a guarantee.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {status === "loading" && <p className="text-sm italic text-slate-400">Loading your upcoming assessments…</p>}

        {status === "error" && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-400/30 dark:bg-rose-500/10">
            <p className="mb-2 text-sm text-rose-700 dark:text-rose-400">Couldn't load your Score Forecast right now.</p>
            <button
              type="button"
              onClick={loadAll}
              className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-400/30 dark:bg-white/10 dark:text-rose-300"
            >
              Retry
            </button>
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500 dark:text-brand-300">
              Upcoming
            </div>
            {upcoming.length === 0 ? (
              <p className="mb-6 text-sm italic text-slate-400">
                No upcoming exams or assignments with dates. Add dates in your daily journal and they will appear here.
              </p>
            ) : (
              <div className="mb-6 space-y-2.5">
                {upcoming.map((item) => (
                  <UpcomingCard
                    key={`${item.kind}-${item.task_id || item.exam_type}-${item.subject}-${item.date}`}
                    item={item}
                    userId={userId}
                  />
                ))}
              </div>
            )}

            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500 dark:text-brand-300">
              History
            </div>
            {history.length === 0 ? (
              <p className="text-sm italic text-slate-400">No estimates yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
