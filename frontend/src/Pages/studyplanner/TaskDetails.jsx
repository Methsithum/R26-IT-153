import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Check, RefreshCw, Calendar, Percent, BookOpen, Pencil } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import PriorityBadge from "../../Components/academic/Shared/PriorityBadge";
import ExplanationPanel from "../../Components/academic/Shared/ExplanationPanel";
import CompletionCelebration from "../../Components/academic/Tasks/CompletionCelebration";
import { useAcademicStore } from "../../store/useAcademicStore";
import { useReschedule } from "../../hooks/useAcademicData";
import { predictPriority, explainTask } from "../../services/academicApi";
import { formatDeadlineCopy, daysRemaining } from "../../utils/dateHelpers";
import { computeFinalPriority, resolveExplanationDisplay } from "../../utils/priorityEngine";

export default function TaskDetails() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const task = useAcademicStore((s) => s.assignments.find((a) => a.taskId === taskId));
  const modules = useAcademicStore((s) => s.modules);
  const completeTask = useAcademicStore((s) => s.completeTask);
  const bumpStreak = useAcademicStore((s) => s.bumpStreak);
  const scheduleResponse = useAcademicStore((s) => s.scheduleResponse);
  const updateAssignmentWeight = useAcademicStore((s) => s.updateAssignmentWeight);
  const { runReschedule, loading: rescheduling } = useReschedule();

  const [editingWeight, setEditingWeight] = useState(false);
  const [weightDraft, setWeightDraft] = useState("");

  const [priorityResult, setPriorityResult] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [loadingExplain, setLoadingExplain] = useState(true);
  const [celebration, setCelebration] = useState(null);
  const [rescheduleInfo, setRescheduleInfo] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);

  const module = modules.find((m) => m.code === task?.module);

  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    setLoadingExplain(true);
    Promise.all([predictPriority(task.featureRow), explainTask(task.featureRow)])
      .then(([pr, ex]) => {
        if (cancelled) return;
        setPriorityResult(pr);
        setExplanation(ex);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingExplain(false));
    return () => {
      cancelled = true;
    };
  }, [task]);

  const days = task ? daysRemaining(task.deadlineDate) : 0;

  // TaskDetails calls /predict-priority directly (below) rather than reading
  // the /schedule response, so - unlike Dashboard/Tasks/MonthGrid, which all
  // get the hybrid layer for free via useWeeklySchedule/useReschedule (see
  // priorityEngine.js) - the raw ML label from that direct call needs to go
  // through computeFinalPriority here explicitly. The scheduleResponse
  // fallback already carries the hybrid result (applied at the API
  // boundary), so it's used as-is.
  const rawMlLabel = priorityResult?.priority_label;
  const finalPriorityResult = task && rawMlLabel
    ? computeFinalPriority(days, task.taskType || "assignment", rawMlLabel)
    : null;
  const priority = finalPriorityResult?.priorityLabel || scheduleResponse?.tasks?.[taskId]?.priority_label;

  // Decides which explanation (SHAP / deadline / blended) actually matches
  // `priority` above - see resolveExplanationDisplay()'s docstring. Passing
  // the raw /explain response straight to ExplanationPanel would risk
  // explaining `explanation.predicted_priority` instead of the final,
  // post-priorityEngine label the badge shows.
  const explanationDisplay = finalPriorityResult && explanation
    ? resolveExplanationDisplay(finalPriorityResult, days, explanation, {
        hasPriorScoreData: !!task?.hasPriorScoreData,
        hasRealWeight: !!task?.hasRealWeight,
      })
    : null;

  const remainingHours = task ? Math.max(task.estimatedHoursNeeded - task.completedHours, 0) : 0;

  async function handleReschedule() {
    const result = await runReschedule({}).catch(() => null);
    if (!result) return;
    const newSlot = Object.values(result.schedule).flat().find((item) => item.task_id === taskId);
    setRescheduleInfo({
      newSlot,
      reason: `This is a ${priority || "Medium"}-priority task${task?.weight ? ` (weight ${task.weight}%)` : ""} with a deadline in ${Math.max(days, 0)} day${days === 1 ? "" : "s"} — the planner moves tasks like this ahead of lower-urgency work when it rebuilds your plan.`,
    });
  }

  // Real database write FIRST (see useAcademicStore.js's completeTask) -
  // only on success do we celebrate/bump the streak/reschedule. On failure,
  // surface a retryable error rather than showing "completed" while the
  // database still shows the task open.
  async function handleComplete() {
    setCompleting(true);
    setCompleteError(null);
    try {
      await completeTask(taskId);
      bumpStreak();
      setCelebration({ priority, title: task.title });
      runReschedule({ completedTaskIds: [taskId] }).catch(() => {});
    } catch (e) {
      setCompleteError(e.message || "Could not mark this task complete.");
    } finally {
      setCompleting(false);
    }
  }

  if (!task) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Task not found.</p>
        <Link to="/tasks" className="text-brand-500 font-semibold text-sm">Back to My Tasks</Link>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Task Details" />
      <div className="px-4 sm:px-6 pb-10 max-w-3xl space-y-5">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-brand-600">
          <ArrowLeft size={15} /> Back
        </button>

        {task.status === "missed" && (
          <div className="card p-4 border-l-4 border-high-500 bg-high-50/60 dark:bg-high-500/10">
            <div className="flex items-center gap-1.5 text-sm font-bold text-high-600">
              <AlertTriangle size={15} /> Missed Study Session
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">This session's time slot has passed. You can reschedule it below.</p>
          </div>
        )}

        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">{task.moduleName}</p>
              <h2 className="font-display font-bold text-xl text-slate-800 dark:text-white mt-1">{task.title}</h2>
            </div>
            {priority && <PriorityBadge priority={priority} />}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <Stat icon={Calendar} label="Deadline" value={formatDeadlineCopy(task.deadlineDate)} />
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/10 flex items-center justify-center shrink-0">
                <Percent size={15} className="text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  Assignment Weight
                  {!task.hasRealWeight && (
                    <span
                      className="text-medium-600 dark:text-medium-500"
                      title="Not recorded in your journal yet — this is a neutral placeholder used for the ML prediction until you set the real value."
                    >
                      (estimate)
                    </span>
                  )}
                </p>
                {editingWeight ? (
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    max={100}
                    value={weightDraft}
                    onChange={(e) => setWeightDraft(e.target.value)}
                    onBlur={() => {
                      const n = Number(weightDraft);
                      if (weightDraft !== "" && !Number.isNaN(n)) updateAssignmentWeight(task.taskId, Math.min(100, Math.max(0, n)));
                      setEditingWeight(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    className="w-16 text-sm font-semibold text-slate-700 dark:text-white bg-transparent border-b border-brand-400 outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setWeightDraft(String(task.weight));
                      setEditingWeight(true);
                    }}
                    className="text-sm font-semibold text-slate-700 dark:text-white truncate inline-flex items-center gap-1 hover:text-brand-600"
                  >
                    {task.weight}% <Pencil size={11} className="text-slate-300" />
                  </button>
                )}
              </div>
            </div>
            <Stat
              icon={BookOpen}
              label="Module Grade"
              // hasGradeData=false means no marks recorded yet - the 0%
              // placeholder underneath must never display as if it were a
              // real grade (same honesty rule MonthGrid.jsx already applies
              // to this exact field; this stat had been missing it - Section 17).
              value={module ? (module.hasGradeData ? `${module.currentGrade}%` : "No data yet") : "—"}
            />
            <Stat icon={RefreshCw} label="Assessment Type" value={task.assessmentType} />
          </div>

          {task.notes && <p className="text-sm text-slate-500 dark:text-slate-300 mt-5 leading-relaxed">{task.notes}</p>}

          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-400 mb-2">Study Time Breakdown</p>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden flex">
                <div className="h-full bg-low-500" style={{ width: `${(task.completedHours / task.estimatedHoursNeeded) * 100}%` }} />
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1.5">
              <span>{task.completedHours}h completed</span>
              <span>{remainingHours}h remaining</span>
              <span>{task.estimatedHoursNeeded}h recommended</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            {task.status !== "completed" && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="inline-flex items-center gap-2 bg-low-500 hover:bg-low-600 text-white font-semibold rounded-2xl px-5 py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {completing ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                {completing ? "Saving…" : "Mark Complete"}
              </button>
            )}
            {task.status === "missed" && (
              <button
                onClick={handleReschedule}
                disabled={rescheduling}
                className="inline-flex items-center gap-2 bg-white dark:bg-white/10 border border-brand-200 dark:border-white/10 text-brand-600 font-semibold rounded-2xl px-5 py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw size={15} className={rescheduling ? "animate-spin" : ""} /> Reschedule
              </button>
            )}
          </div>

          {completeError && (
            <div className="mt-4 card p-4 border-l-4 border-high-500 bg-high-50/60 dark:bg-high-500/10">
              <p className="text-sm text-high-600">Couldn't mark this task complete — {completeError} The task is still open.</p>
            </div>
          )}

          {rescheduleInfo && (
            <div className="mt-4 card p-4 bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20">
              <p className="text-sm font-semibold text-brand-600">
                {rescheduleInfo.newSlot ? `New suggested time: ${rescheduleInfo.newSlot.time_slot}` : "No free slot found before the deadline yet."}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{rescheduleInfo.reason}</p>
            </div>
          )}
        </div>

        <ExplanationPanel
          display={explanationDisplay}
          confidence={priorityResult?.confidence}
          loading={loadingExplain}
        />
      </div>

      <CompletionCelebration active={!!celebration} priority={celebration?.priority} taskTitle={celebration?.title} onDone={() => setCelebration(null)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/10 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-700 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
}
