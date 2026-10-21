// Helpers for study-session history and the missed-session flow
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

// The live plan's occupied time_slots per real date, for "this" or "next" week
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

// Stored sessions on `date` that the live/frozen item list doesn't already show
export function extraRecordsForDate(date, items, recordsByKey) {
  const shown = new Set(items.map((item) => sessionKey(date, item.task_id, item.time_slot)));
  return Object.values(recordsByKey).filter(
    (r) => r.date === date && !shown.has(recordKey(r)) && (r.source === "manual_reschedule" || r.status !== "pending")
  );
}

function slotRange(timeSlot) {
  const [start, end] = timeSlot.split("-").map((t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  });
  return [start, end];
}

export function slotsOverlap(a, b) {
  const [aStart, aEnd] = slotRange(a);
  const [bStart, bEnd] = slotRange(b);
  return aStart < bEnd && bStart < aEnd;
}

// One session per time slot.
export function dropOverlappingItems(date, items, recordsByKey) {
  const rank = (item) => {
    const record = recordsByKey[sessionKey(date, item.task_id, item.time_slot)];
    if (record?.status && record.status !== "pending") return 0;
    if (record?.source === "manual_reschedule") return 1;
    return 2;
  };
  const ordered = items.map((item, index) => ({ item, index, rank: rank(item) }));
  ordered.sort((a, b) => a.rank - b.rank || a.index - b.index);
  const kept = [];
  for (const { item, index } of ordered) {
    if (!kept.some((k) => slotsOverlap(k.item.time_slot, item.time_slot))) kept.push({ item, index });
  }
  return kept.sort((a, b) => a.index - b.index).map((k) => k.item);
}

export const DECISION_LABELS = {
  pending: "Needs a decision",
  this_week: "Moved (this week)",
  next_week: "Moved (next week)",
  declined: "Not rescheduled",
};
