import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ListChecks } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import TaskFilters from "../../Components/academic/Tasks/TaskFilters";
import TaskCard from "../../Components/academic/Tasks/TaskCard";
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

  function handleComplete(taskId) {
    const task = assignments.find((a) => a.taskId === taskId);
    completeTask(taskId);
    bumpStreak();
    setCelebration({ priority: schedule?.tasks?.[taskId]?.priority_label, title: task?.title });
    runReschedule({ completedTaskIds: [taskId] }).catch(() => {});
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

        {loading ? (
          <SkeletonList rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ListChecks} title="No tasks here" subtitle="Try a different filter, or check back once new tasks appear." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((task, i) => (
                <TaskCard key={task.taskId} task={task} priority={task.priority} onComplete={handleComplete} index={i} />
              ))}
            </AnimatePresence>
          </div>
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
