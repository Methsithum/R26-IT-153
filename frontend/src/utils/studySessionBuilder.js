// Builds module study sessions shared by all calendar views

export const MODULE_COLOR_HEX = { brand: "#7c3aed", teal: "#14b8a6", pink: "#ec4899", orange: "#fb923c" };

// Fixed accent for exam-prep session cards
export const EXAM_PREP_ACCENT_HEX = "#2563eb";

// SINGLE source of truth for "what does this scheduled task session look like"
export function resolveSessionDisplay(item, { tasksRegistry, assignments, moduleName, exams }) {
  const registryEntry = tasksRegistry?.[item.task_id];
  const taskType = registryEntry?.task_type || "assignment";
  const resolvedModuleName = moduleName(item.module);

  if (taskType === "exam") {
    // Match the real exam to know if it's a lab
    const matchedExam = exams?.find((e) => e.module === item.module && e.date === registryEntry?.deadline_date);
    const isLab = (matchedExam?.type || "").toLowerCase() === "lab";
    // No subtitle - module name is already in the title
    return {
      title: `${isLab ? "Lab Preparation" : "Exam Prep"}: ${resolvedModuleName}`,
      subtitle: null,
      isExamPrep: true,
      isLabPrep: isLab,
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

// Suggested self-study blocks
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

function addClockMinutes(hhmm, minutes) {
  const [h, m] = (hhmm || "0:0").split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function timeToMinutes(hhmm) {
  const [h, m] = (hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// A free slot is usable only if no ML-scheduled session is already there
function isSlotFree(slot, scheduledItemsForDay) {
  const slotStart = timeToMinutes(slot.start_time);
  const slotEnd = timeToMinutes(slot.end_time);
  return !scheduledItemsForDay.some((item) => {
    const [itemStart, itemEnd] = (item.time_slot || "").split("-");
    if (!itemStart || !itemEnd) return false;
    return rangesOverlap(slotStart, slotEnd, timeToMinutes(itemStart), timeToMinutes(itemEnd));
  });
}

// moduleHoursOverride
export function buildStudySessionsByDay(modules, weeklyFreeSlots, assignments = [], schedule = {}, moduleHoursOverride = null) {
  const byDay = {};
  if (!weeklyFreeSlots?.length) return byDay;
  const availableSlots = weeklyFreeSlots.filter((slot) => isSlotFree(slot, schedule[slot.day] || []));
  const candidates = modules
    .map((m) => ({ ...m, studyHoursThisWeek: moduleHoursOverride ? moduleHoursOverride[m.code] || 0 : m.studyHoursThisWeek || 0 }))
    .filter((m) => m.studyHoursThisWeek > 0)
    .sort((a, b) => b.studyHoursThisWeek - a.studyHoursThisWeek);

  // Mutable remaining capacity, round-robin ordered
  const remaining = spreadAcrossDays(availableSlots).map((s) => ({ ...s }));
  const dayLoadMinutes = {};

  candidates.forEach((m) => {
    let minutesNeeded = Math.round(m.studyHoursThisWeek * 60);
    if (minutesNeeded <= 0) return;

    // Least-loaded day first, re-sorted before each module's turn
    remaining.sort((a, b) => (dayLoadMinutes[a.day] || 0) - (dayLoadMinutes[b.day] || 0));

    for (const slot of remaining) {
      if (minutesNeeded <= 0) break;
      if (slot.duration_minutes <= 0) continue;
      const take = Math.min(slot.duration_minutes, minutesNeeded);
      byDay[slot.day] = byDay[slot.day] || [];
      byDay[slot.day].push({
        taskId: `study-${m.code}-${slot.day}-${byDay[slot.day].length}`,
        module: m.code,
        moduleName: m.name,
        assignmentTitle: null,
        color: m.color,
        timeSlot: `${slot.start_time}-${addClockMinutes(slot.start_time, take)}`,
        durationMinutes: take,
      });
      slot.start_time = addClockMinutes(slot.start_time, take);
      slot.duration_minutes -= take;
      minutesNeeded -= take;
      dayLoadMinutes[slot.day] = (dayLoadMinutes[slot.day] || 0) + take;
    }
  });
  return byDay;
}

export function startMinutes(timeSlot) {
  const [start] = (timeSlot || "").split("-");
  const [h, m] = (start || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Time-of-day grouping for the Week view
export const TIME_OF_DAY_BAND_ORDER = ["Morning", "Afternoon", "Evening", "Night"];

export function getTimeOfDayBand(startTime) {
  const [startPart] = String(startTime || "0:0").split("-");
  const [h, m] = startPart.split(":").map(Number);
  const minutes = (h || 0) * 60 + (m || 0);
  if (minutes >= 6 * 60 && minutes < 12 * 60) return "Morning";
  if (minutes >= 12 * 60 && minutes < 17 * 60) return "Afternoon";
  if (minutes >= 17 * 60 && minutes < 20 * 60) return "Evening";
  // Night
  return "Night";
}
