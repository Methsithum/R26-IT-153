// Shared by WeekGrid, DayView, MonthGrid and TodayTimeline so "today" and
// "this week" always agree on what a module study session looks like, where
// it lands, and (see resolveSessionDisplay below) what it's called.

export const MODULE_COLOR_HEX = { brand: "#7c3aed", teal: "#14b8a6", pink: "#ec4899", orange: "#fb923c" };

// Fixed accent for exam-prep session cards - deliberately distinct from
// every module color above so "this is exam prep" reads as its own visual
// category at a glance, regardless of which module it's for (PROJECT
// CONTEXT.md Section 8's exam-prep subsection / Part A of that work).
export const EXAM_PREP_ACCENT_HEX = "#2563eb";

/**
 * SINGLE source of truth for "what does this scheduled task session look
 * like" - title text, whether it's exam prep, and which module it's for -
 * used everywhere a real (non-suggested) session card is rendered
 * (WeekGrid, DayView, MonthGrid, TodayTimeline) instead of each component
 * re-deriving `title || moduleName(item.module)` and separately checking
 * task_type inline. taskType comes from schedule.tasks[taskId].task_type
 * (round-tripped by the backend - see PROJECT CONTEXT.md Section 5d) so
 * this works even without a matching local `assignments` entry, which is
 * exactly the case for exam-prep task_ids ("exam-<examId>") - they were
 * never real assignment documents, so `assignments.find(...)` would never
 * find them.
 */
export function resolveSessionDisplay(item, { tasksRegistry, assignments, moduleName }) {
  const registryEntry = tasksRegistry?.[item.task_id];
  const taskType = registryEntry?.task_type || "assignment";
  const resolvedModuleName = moduleName(item.module);

  if (taskType === "exam") {
    // No subtitle - the module name is already in the title itself
    // ("Exam Prep: X"), so repeating it on a second line would be redundant
    // (unlike the assignment case below, where the title is the assignment's
    // own name and the module is genuinely new information).
    return {
      title: `Exam Prep: ${resolvedModuleName}`,
      subtitle: null,
      isExamPrep: true,
      moduleName: resolvedModuleName,
    };
  }

  const assignmentTitle = assignments.find((a) => a.taskId === item.task_id)?.title || null;
  return {
    title: assignmentTitle || resolvedModuleName,
    subtitle: assignmentTitle ? resolvedModuleName : null,
    isExamPrep: false,
    moduleName: resolvedModuleName,
  };
}

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

// Time-of-day grouping for the Week view (Part 1) - a pure, testable
// classifier taking just a start time ("HH:MM", or a "HH:MM-HH:MM" range -
// only the start is used), independent of any specific day's session list,
// so it's reusable wherever sessions need grouping and unit-testable on its
// own. Order matches the display order sections render in.
export const TIME_OF_DAY_BAND_ORDER = ["Morning", "Afternoon", "Evening", "Night"];

export function getTimeOfDayBand(startTime) {
  const [startPart] = String(startTime || "0:0").split("-");
  const [h, m] = startPart.split(":").map(Number);
  const minutes = (h || 0) * 60 + (m || 0);
  if (minutes >= 6 * 60 && minutes < 12 * 60) return "Morning";
  if (minutes >= 12 * 60 && minutes < 17 * 60) return "Afternoon";
  if (minutes >= 17 * 60 && minutes < 20 * 60) return "Evening";
  // Night: 20:00-01:00, wrapping past midnight - covers 20:00-23:59 (falls
  // through to here) and 00:00-05:59 (the `< 6*60` catch above the Morning
  // check never triggers before this line, so it lands here too). No real
  // free-slot in this app currently starts between 01:00-05:59, but bucketing
  // it as Night rather than leaving it unclassified is the safer default for
  // an edge case this function should never silently mishandle.
  return "Night";
}
