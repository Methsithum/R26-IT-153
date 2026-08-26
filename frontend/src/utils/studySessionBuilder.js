// Shared by WeekGrid and DayView so "today" and "this week" always agree on
// what a module study session looks like and where it lands.

export const MODULE_COLOR_HEX = { brand: "#7c3aed", teal: "#14b8a6", pink: "#ec4899", orange: "#fb923c" };

// Suggested self-study blocks — one per module that has real hours left
// this week (see utils/studyAllocation.js), dropped into the student's real
// free-time slots so every module with upcoming work gets a visible block,
// not just modules that already have an ML-scheduled task.
export function buildStudySessionsByDay(modules, weeklyFreeSlots) {
  const byDay = {};
  if (!weeklyFreeSlots?.length) return byDay;
  const candidates = [...modules]
    .filter((m) => (m.studyHoursThisWeek || 0) > 0)
    .sort((a, b) => b.studyHoursThisWeek - a.studyHoursThisWeek);

  candidates.forEach((m, i) => {
    const slot = weeklyFreeSlots[i % weeklyFreeSlots.length];
    if (!slot) return;
    byDay[slot.day] = byDay[slot.day] || [];
    byDay[slot.day].push({
      taskId: `study-${m.code}`,
      module: m.code,
      moduleName: m.name,
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
