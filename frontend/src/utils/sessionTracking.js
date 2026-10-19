// Pure helpers for study-session history + the permission-first missed-
// session flow (backend: app/routes/study_planner/session_routes.py).
// Generated sessions carry no id of their own, so a session is identified
// the same way the backend's unique index does: (date, task_id, time_slot).
import { addDays, getWeekStart, toLocalDateStr } from "./dateHelpers";

export function sessionKey(date, taskId, timeSlot) {
  return `${date}|${taskId}|${timeSlot}`;
}

export function recordKey(record) {
  return sessionKey(record.date, record.task_id, record.time_slot);
}

/** A real scheduled item (ScheduledItem) on a real date -> the backend's SessionInput shape. */
export function toSessionInput(date, item, tasksRegistry) {
  const entry = tasksRegistry?.[item.task_id];
  return {
    date,
    time_slot: item.time_slot,
    task_id: item.task_id,
    module: item.module,
    duration_minutes: item.duration_minutes,
    task_type: entry?.task_type || "assignment",
    deadline_date: entry?.deadline_date || null,
  };
}

/** Inclusive list of "YYYY-MM-DD" strings from startDate to endDate (Date objects). */
export function dateStrsBetween(startDate, endDate) {
  const out = [];
  for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) out.push(toLocalDateStr(d));
  return out;
}

/**
 * The live plan's occupied time_slots per real date, for "this" or "next"
 * week - read from the SAME sources WeekGrid renders from, so a suggestion
 * never lands on a session the student can already see: the current week's
 * remaining days come from the live single-week scheduleResponse (weekday-
 * keyed - see WeekGrid's realDayName note), every other date from the
 * real-ISO-date-keyed multiWeekSchedule. Stored manual sessions are added
 * on top of this server-side.
 */
export function buildOccupiedByDate(week, { scheduleResponse, multiWeekSchedule }, now = new Date()) {
  const thisMonday = getWeekStart(now);
  const start = week === "this" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : addDays(thisMonday, 7);
  const end = week === "this" ? addDays(thisMonday, 6) : addDays(thisMonday, 13);
  const occupied = {};
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const dateStr = toLocalDateStr(d);
    const items =
      week === "this"
        ? scheduleResponse?.schedule?.[d.toLocaleDateString("en-US", { weekday: "long" })] || []
        : multiWeekSchedule?.schedule?.[dateStr] || [];
    if (items.length) occupied[dateStr] = items.map((item) => item.time_slot);
  }
  return occupied;
}

/** Stored records shaped like ScheduledItems so the existing session cards can render them. */
export function recordToScheduledItem(record) {
  return {
    time_slot: record.time_slot,
    task_id: record.task_id,
    module: record.module,
    duration_minutes: record.duration_minutes,
    fromRecord: true,
  };
}

/**
 * Stored sessions on `date` that the live/frozen item list doesn't already
 * show: manually rescheduled ones (the generator never knows about them)
 * and already-marked ones whose slot a later regeneration moved - so a
 * student's own mark never silently disappears from the calendar.
 */
export function extraRecordsForDate(date, items, recordsByKey) {
  const shown = new Set(items.map((item) => sessionKey(date, item.task_id, item.time_slot)));
  return Object.values(recordsByKey).filter(
    (r) => r.date === date && !shown.has(recordKey(r)) && (r.source === "manual_reschedule" || r.status !== "pending")
  );
}

export const DECISION_LABELS = {
  pending: "Needs a decision",
  this_week: "Moved (this week)",
  next_week: "Moved (next week)",
  declined: "Not rescheduled",
};
