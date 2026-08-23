import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Check, RefreshCw, Calendar, Percent, BookOpen } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import PriorityBadge from "../../Components/academic/Shared/PriorityBadge";
import ExplanationPanel from "../../Components/academic/Shared/ExplanationPanel";
import CompletionCelebration from "../../Components/academic/Tasks/CompletionCelebration";
import { useAcademicStore } from "../../store/useAcademicStore";
import { useReschedule } from "../../hooks/useAcademicData";
import { predictPriority, explainTask } from "../../services/academicApi";
import { formatDeadlineCopy, daysRemaining } from "../../utils/dateHelpers";

export default function TaskDetails() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const task = useAcademicStore((s) => s.assignments.find((a) => a.taskId === taskId));
  const modules = useAcademicStore((s) => s.modules);
  const completeTask = useAcademicStore((s) => s.completeTask);
  const bumpStreak = useAcademicStore((s) => s.bumpStreak);
  const scheduleResponse = useAcademicStore((s) => s.scheduleResponse);
  const { runReschedule, loading: rescheduling } = useReschedule();

  const [priorityResult, setPriorityResult] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [loadingExplain, setLoadingExplain] = useState(true);
  const [celebration, setCelebration] = useState(null);
  const [rescheduleInfo, setRescheduleInfo] = useState(null);

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

  const priority = priorityResult?.priority_label || scheduleResponse?.tasks?.[taskId]?.priority_label;
  const days = task ? daysRemaining(task.deadlineDate) : 0;

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

  function handleComplete() {
    completeTask(taskId);
    bumpStreak();
    setCelebration({ priority, title: task.title });
    runReschedule({ completedTaskIds: [taskId] }).catch(() => {});
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
            <Stat icon={Percent} label="Assignment Weight" value={`${task.weight}%`} />
            <Stat icon={BookOpen} label="Module Grade" value={module ? `${module.currentGrade}%` : "—"} />
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
                className="inline-flex items-center gap-2 bg-low-500 hover:bg-low-600 text-white font-semibold rounded-2xl px-5 py-2.5 text-sm transition-colors"
              >
                <Check size={16} /> Mark Complete
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

          {rescheduleInfo && (
            <div className="mt-4 card p-4 bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20">
              <p className="text-sm font-semibold text-brand-600">
                {rescheduleInfo.newSlot ? `New suggested time: ${rescheduleInfo.newSlot.time_slot}` : "No free slot found before the deadline yet."}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{rescheduleInfo.reason}</p>
            </div>
          )}
        </div>

        <ExplanationPanel explanation={explanation} confidence={priorityResult?.confidence} loading={loadingExplain} />
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
