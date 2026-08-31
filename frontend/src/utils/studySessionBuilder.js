// Shared by WeekGrid and DayView so "today" and "this week" always agree on
// what a module study session looks like and where it lands.

export const MODULE_COLOR_HEX = { brand: "#7c3aed", teal: "#14b8a6", pink: "#ec4899", orange: "#fb923c" };

// Suggested self-study blocks — one per module that has real hours left
// this week (see utils/studyAllocation.js), dropped into the student's real
// free-time slots so every module with upcoming work gets a visible block,
// not just modules that already have an ML-scheduled task. Each block is
// named after the specific assignment actually driving that module's
// urgency (its nearest upcoming pending deadline) rather than just the
// module name, so "Study session" reads as "for what", not just "for which
// module".
// weeklyFreeSlots is stored day-major (every one of Monday's windows, then
// every one of Tuesday's, ...), so naively walking it in order front-loads
// the first day or two whenever there are fewer candidates than total
// slots. Re-flattening it round-robin across days first (one slot from
// each day in turn, then a second pass for any second window per day)
// spreads sessions across the whole week's real free time instead.
function spreadAcrossDays(weeklyFreeSlots) {
  const byDay = {};
  const dayOrder = [];
  weeklyFreeSlots.forEach((slot) => {
    if (!byDay[slot.day]) {
      byDay[slot.day] = [];
      dayOrder.push(slot.day);
    }
    byDay[slot.day].push(slot);
  });
  const maxPerDay = Math.max(...dayOrder.map((d) => byDay[d].length), 0);
  const spread = [];
  for (let round = 0; round < maxPerDay; round++) {
    dayOrder.forEach((day) => {
      if (byDay[day][round]) spread.push(byDay[day][round]);
    });
  }
  return spread;
}

function timeToMinutes(hhmm) {
  const [h, m] = (hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// A free-time slot is only a real candidate for a suggested study session if
// nothing from the real ML-scheduled plan already occupies that time on
// that day — otherwise a suggested session and a real task session could
// land on the exact same time_slot and visually overlap/conflict.
function isSlotFree(slot, scheduledItemsForDay) {
  const slotStart = timeToMinutes(slot.start_time);
  const slotEnd = timeToMinutes(slot.end_time);
  return !scheduledItemsForDay.some((item) => {
    const [itemStart, itemEnd] = (item.time_slot || "").split("-");
    if (!itemStart || !itemEnd) return false;
    return rangesOverlap(slotStart, slotEnd, timeToMinutes(itemStart), timeToMinutes(itemEnd));
  });
}

export function buildStudySessionsByDay(modules, weeklyFreeSlots, assignments = [], schedule = {}) {
  const byDay = {};
  if (!weeklyFreeSlots?.length) return byDay;
  const availableSlots = weeklyFreeSlots.filter((slot) => isSlotFree(slot, schedule[slot.day] || []));
  const candidates = [...modules]
    .filter((m) => (m.studyHoursThisWeek || 0) > 0)
    .sort((a, b) => b.studyHoursThisWeek - a.studyHoursThisWeek);
  const spreadSlots = spreadAcrossDays(availableSlots);

  candidates.forEach((m, i) => {
    const slot = spreadSlots[i % spreadSlots.length];
    if (!slot) return;
    const nearestAssignment = assignments
      .filter((a) => a.module === m.code && a.status === "pending")
      .sort((a, b) => (a.deadlineDate || "").localeCompare(b.deadlineDate || ""))[0];
    byDay[slot.day] = byDay[slot.day] || [];
    byDay[slot.day].push({
      taskId: `study-${m.code}`,
      module: m.code,
      moduleName: m.name,
      assignmentTitle: nearestAssignment?.title || null,
      color: m.color,
      timeSlot: `${slot.start_time}-${slot.end_time}`,
      durationMinutes: Math.min(Math.round(m.studyHoursThisWeek * 60), slot.duration_minutes),
    });
  });
  return byDay;
}

export function startMinutes(timeSlot) {
  const [start] = (timeSlot || "").split("-");
  const [h, m] = (start || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
