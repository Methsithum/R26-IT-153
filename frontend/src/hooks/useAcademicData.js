import { useCallback, useEffect, useState } from "react";
import { useAcademicStore } from "../store/useAcademicStore";
import { createSchedule, createMultiWeekSchedule, rescheduleSchedule, getTodoList } from "../services/academicApi";
import { applyPriorityEngineToScheduleResult } from "../utils/priorityEngine";
import { buildExamPrepTasks, buildMultiWeekExamPrepTasks, toApiTaskInput } from "../utils/examPrepScheduling";

// How many weeks ahead useMultiWeekSchedule() requests by default - matches
// the backend's own MAX_WEEKS_AHEAD (schedule_engine.py) so a request never
// asks for more than the backend will ever generate; the backend still
// auto-derives a SHORTER range from the farthest real deadline when that's
// sooner, so this is a ceiling, not a guarantee every call generates 12
// full weeks.
const MULTI_WEEK_WEEKS_AHEAD = 12;

// The backend's /todo rejects a schedule whose `tasks` registry is empty
// (422 "schedule_result has no 'tasks' registry") instead of just returning
// an empty list — a real edge case for a student with zero pending tasks
// (e.g. a brand-new account, or right after completing their last one).
// Skip the call in that case rather than surfacing a spurious backend error.
async function fetchTodoSafely(scheduleResult) {
  if (!scheduleResult?.tasks || Object.keys(scheduleResult.tasks).length === 0) return [];
  return getTodoList(scheduleResult);
}

/**
 * Generates (or regenerates) the weekly schedule from the live /schedule
 * endpoint using the student's pending assignments + free slots, and stores
 * the response (including the per-task priority_label the backend derives)
 * in Zustand so every page reads the same source of truth.
 */
export function useWeeklySchedule() {
  const assignments = useAcademicStore((s) => s.assignments);
  const weeklyFreeSlots = useAcademicStore((s) => s.weeklyFreeSlots);
  const exams = useAcademicStore((s) => s.exams);
  const modules = useAcademicStore((s) => s.modules);
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
        task_type: a.taskType || "assignment",
      }));
      // Exam-prep pseudo-tasks (PROJECT CONTEXT.md Section 8) - built fresh
      // from real exam dates + real module performance every time a full
      // schedule is generated (not on every /reschedule call, which reuses
      // the DEPLETED remaining-free-slot pool from the previous generation -
      // recomputing escalating hours there would just manufacture spurious
      // overload warnings instead of actually finding more capacity). This
      // is also where the escalating curve actually "refreshes": each fresh
      // /schedule call reflects the CURRENT day, so an exam that's crept
      // from 10 days out to 6 gets recomputed into its heavier window here.
      const examPrepTasks = buildExamPrepTasks(exams, modules).map(toApiTaskInput);
      // Hybrid priority layer (PROJECT CONTEXT.md Section 5d) applied ONCE,
      // right at the API boundary, so every screen reading
      // schedule.tasks[taskId].priority_label downstream (Dashboard,
      // TodayTimeline, DayView, WeekGrid, MonthGrid, Tasks) already sees the
      // deadline-dominant final result instead of the raw ML label - no
      // per-screen reimplementation needed.
      const result = applyPriorityEngineToScheduleResult(
        await createSchedule(weeklyFreeSlots, [...tasks, ...examPrepTasks])
      );
      setSchedule(result);
      setRemainingFreeSlots(weeklyFreeSlots);
      setTodoList(await fetchTodoSafely(result));
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [assignments, weeklyFreeSlots, exams, modules, setSchedule, setRemainingFreeSlots, setTodoList]);

  useEffect(() => {
    if (!scheduleResponse) {
      generate().catch(() => {});
    }
    // Re-checks whenever `assignments` or `weeklyFreeSlots` changes (not
    // just on mount) so a schedule generated from stale/placeholder
    // assignments — e.g. before the gamified journal's real data has
    // finished syncing in — gets regenerated once syncFromJournal clears
    // scheduleResponse and swaps in the real list, instead of silently
    // keeping the wrong cached schedule. Same for weeklyFreeSlots: editing
    // "Preferred Study Time" in Settings clears scheduleResponse too, and
    // this dependency is what actually triggers the regenerate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, weeklyFreeSlots]);

  return { schedule: scheduleResponse, loading, error, regenerate: generate };
}

/**
 * Generates the real, ISO-date-keyed multi-week schedule (PROJECT
 * CONTEXT.md Section 8d) via /multi-week-schedule, ONCE (covering
 * MULTI_WEEK_WEEKS_AHEAD weeks) rather than once per Next/Previous click -
 * WeekGrid.jsx then slices out whichever 7-day window is currently being
 * viewed from this single response. Mirrors useWeeklySchedule()'s task-
 * building (same assignments + exam-prep sources), but sends exam-prep as
 * one task PER WEEK (buildMultiWeekExamPrepTasks) instead of one task
 * capped to "this week" only, and does NOT cap assignment hours to a single
 * week either - assignments already send their full remaining
 * estimated_hours_needed, letting the backend's rolling allocator (not this
 * hook) decide which week(s) they land in.
 */
export function useMultiWeekSchedule() {
  const assignments = useAcademicStore((s) => s.assignments);
  const weeklyFreeSlots = useAcademicStore((s) => s.weeklyFreeSlots);
  const exams = useAcademicStore((s) => s.exams);
  const modules = useAcademicStore((s) => s.modules);
  const multiWeekSchedule = useAcademicStore((s) => s.multiWeekSchedule);
  const setMultiWeekSchedule = useAcademicStore((s) => s.setMultiWeekSchedule);

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
        task_type: a.taskType || "assignment",
      }));
      const examPrepTasks = buildMultiWeekExamPrepTasks(exams, modules, MULTI_WEEK_WEEKS_AHEAD).map(toApiTaskInput);
      const result = applyPriorityEngineToScheduleResult(
        await createMultiWeekSchedule(weeklyFreeSlots, [...tasks, ...examPrepTasks], MULTI_WEEK_WEEKS_AHEAD)
      );
      setMultiWeekSchedule(result);
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [assignments, weeklyFreeSlots, exams, modules, setMultiWeekSchedule]);

  useEffect(() => {
    if (!multiWeekSchedule) {
      generate().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, weeklyFreeSlots]);

  return { multiWeekSchedule, loading, error, regenerate: generate };
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
        const result = applyPriorityEngineToScheduleResult(
          await rescheduleSchedule({
            previousSchedule: scheduleResponse,
            remainingFreeSlots,
            completedTaskIds,
            newTasks,
          })
        );
        setSchedule(result);
        setTodoList(await fetchTodoSafely(result));
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
