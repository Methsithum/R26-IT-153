import { useCallback, useEffect, useState } from "react";
import { useAcademicStore } from "../store/useAcademicStore";
import { createSchedule, rescheduleSchedule, getTodoList } from "../services/academicApi";

/**
 * Generates (or regenerates) the weekly schedule from the live /schedule
 * endpoint using the student's pending assignments + free slots, and stores
 * the response (including the per-task priority_label the backend derives)
 * in Zustand so every page reads the same source of truth.
 */
export function useWeeklySchedule() {
  const assignments = useAcademicStore((s) => s.assignments);
  const weeklyFreeSlots = useAcademicStore((s) => s.weeklyFreeSlots);
  const scheduleResponse = useAcademicStore((s) => s.scheduleResponse);
  const setSchedule = useAcademicStore((s) => s.setSchedule);
  const setRemainingFreeSlots = useAcademicStore((s) => s.setRemainingFreeSlots);
  const setTodoList = useAcademicStore((s) => s.setTodoList);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pending = assignments.filter((a) => a.status === "pending");
      const tasks = pending.map((a) => ({
        task_id: a.taskId,
        module: a.module,
        deadline_date: a.deadlineDate,
        weight: a.weight,
        estimated_hours_needed: Math.max(a.estimatedHoursNeeded - a.completedHours, 0.5),
        feature_row: a.featureRow,
      }));
      const result = await createSchedule(weeklyFreeSlots, tasks);
      setSchedule(result);
      setRemainingFreeSlots(weeklyFreeSlots);
      const todo = await getTodoList(result);
      setTodoList(todo);
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [assignments, weeklyFreeSlots, setSchedule, setRemainingFreeSlots, setTodoList]);

  useEffect(() => {
    if (!scheduleResponse) {
      generate().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { schedule: scheduleResponse, loading, error, regenerate: generate };
}

/** Wraps /reschedule for the "mark complete" / "missed task" flows. */
export function useReschedule() {
  const scheduleResponse = useAcademicStore((s) => s.scheduleResponse);
  const remainingFreeSlots = useAcademicStore((s) => s.remainingFreeSlots);
  const setSchedule = useAcademicStore((s) => s.setSchedule);
  const setTodoList = useAcademicStore((s) => s.setTodoList);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runReschedule = useCallback(
    async ({ completedTaskIds = [], newTasks = [] }) => {
      if (!scheduleResponse) return null;
      setLoading(true);
      setError(null);
      try {
        const result = await rescheduleSchedule({
          previousSchedule: scheduleResponse,
          remainingFreeSlots,
          completedTaskIds,
          newTasks,
        });
        setSchedule(result);
        const todo = await getTodoList(result);
        setTodoList(todo);
        return result;
      } catch (e) {
        setError(e.message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [scheduleResponse, remainingFreeSlots, setSchedule, setTodoList]
  );

  return { runReschedule, loading, error };
}
