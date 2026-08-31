import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ListChecks } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import TaskFilters from "../../Components/academic/Tasks/TaskFilters";
import TaskCard from "../../Components/academic/Tasks/TaskCard";
import CompletedTaskList from "../../Components/academic/Tasks/CompletedTaskList";
import CompletionCelebration from "../../Components/academic/Tasks/CompletionCelebration";
import EmptyState from "../../Components/academic/Shared/EmptyState";
import { SkeletonList } from "../../Components/academic/Shared/Skeletons";
import { useAcademicStore } from "../../store/useAcademicStore";
import { useWeeklySchedule, useReschedule } from "../../hooks/useAcademicData";
import { daysRemaining } from "../../utils/dateHelpers";

export default function Tasks() {
  const assignments = useAcademicStore((s) => s.assignments);
  const modules = useAcademicStore((s) => s.modules);
  const completeTask = useAcademicStore((s) => s.completeTask);
  const bumpStreak = useAcademicStore((s) => s.bumpStreak);
  const { schedule, loading } = useWeeklySchedule();
  const { runReschedule } = useReschedule();

  const [tab, setTab] = useState("All");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [celebration, setCelebration] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [completeError, setCompleteError] = useState(null);

  // schedule.tasks[taskId].priority_label already reflects the hybrid
  // deadline+ML priority (priorityEngine.js, PROJECT CONTEXT.md Section 5d)
  // - applied once at the API boundary in useWeeklySchedule() - so no
  // separate computeFinalPriority call is needed here.
  const withPriority = useMemo(
    () => assignments.map((a) => ({ ...a, priority: schedule?.tasks?.[a.taskId]?.priority_label })),
    [assignments, schedule]
  );

  const filtered = withPriority.filter((a) => {
    if (tab === "Pending" && a.status !== "pending") return false;
    if (tab === "Completed" && a.status !== "completed") return false;
    if (tab === "Overdue" && !(a.status !== "completed" && daysRemaining(a.deadlineDate) < 0)) return false;
    if (moduleFilter !== "all" && a.module !== moduleFilter) return false;
    if (priorityFilter !== "all" && a.priority !== priorityFilter) return false;
    return true;
  });

  // Completed tasks never sit in the main card grid (see CompletedTaskList) -
  // once done, a full card competing for space with still-open work isn't
  // useful; the compact list below just needs the on-time/late outcome.
  const activeTasks = filtered.filter((a) => a.status !== "completed");
  const completedTasks = filtered.filter((a) => a.status === "completed");

  // completeTask() now writes to the real database FIRST (see
  // useAcademicStore.js) - only once that succeeds do we celebrate/bump the
  // streak/kick off a reschedule. On failure the UI must NOT show
  // "completed" while the database still disagrees, so this surfaces a
  // retryable error instead of updating anything optimistically.
  async function handleComplete(taskId) {
    const task = assignments.find((a) => a.taskId === taskId);
    setCompletingId(taskId);
    setCompleteError(null);
    try {
      await completeTask(taskId);
      bumpStreak();
      setCelebration({ priority: schedule?.tasks?.[taskId]?.priority_label, title: task?.title });
      runReschedule({ completedTaskIds: [taskId] }).catch(() => {});
    } catch (e) {
      setCompleteError({ taskId, title: task?.title, message: e.message || "Could not mark this task complete." });
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div>
      <Topbar title="My Tasks" subtitle="Everything the planner is tracking for you." />

      <div className="px-4 sm:px-6 pb-10 space-y-5">
        <TaskFilters
          tab={tab}
          onTab={setTab}
          moduleFilter={moduleFilter}
          onModuleFilter={setModuleFilter}
          priorityFilter={priorityFilter}
          onPriorityFilter={setPriorityFilter}
          modules={modules}
        />

        {completeError && (
          <div className="card p-3 border-l-4 border-high-500 bg-high-50/60 dark:bg-high-500/10 flex items-center justify-between gap-3">
            <p className="text-sm text-high-600">
              Couldn't mark "{completeError.title || "this task"}" complete — {completeError.message} The task is still
              open.
            </p>
            <button
              onClick={() => handleComplete(completeError.taskId)}
              className="shrink-0 text-xs font-semibold text-high-600 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <SkeletonList rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ListChecks} title="No tasks here" subtitle="Try a different filter, or check back once new tasks appear." />
        ) : (
          <>
            {activeTasks.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence>
                  {activeTasks.map((task, i) => (
                    <TaskCard
                      key={task.taskId}
                      task={task}
                      priority={task.priority}
                      onComplete={handleComplete}
                      completing={completingId === task.taskId}
                      index={i}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
            <CompletedTaskList tasks={completedTasks} />
          </>
        )}
      </div>

      <CompletionCelebration
        active={!!celebration}
        priority={celebration?.priority}
        taskTitle={celebration?.title}
        onDone={() => setCelebration(null)}
      />
    </div>
  );
}
