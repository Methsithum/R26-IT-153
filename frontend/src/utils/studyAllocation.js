// A full academic term's worth of weeks
export const SEMESTER_WEEKS = 14;

// Real, data-driven weekly study-hours-per-module allocation
export function buildWeeklyModuleAllocation({ modules, assignments, exams, weeklyHours, today = new Date() }) {
  const todayIso = today.toISOString().slice(0, 10);

  const focusPointsByModule = {};
  modules.forEach((m) => {
    focusPointsByModule[m.code] = [];
  });
  (assignments || []).forEach((a) => {
    if (a.status === "completed") return;
    if (a.deadlineDate && a.deadlineDate >= todayIso && focusPointsByModule[a.module]) {
      focusPointsByModule[a.module].push(a.deadlineDate);
    }
  });
  (exams || []).forEach((e) => {
    if (e.date && e.date >= todayIso && focusPointsByModule[e.module]) {
      focusPointsByModule[e.module].push(e.date);
    }
  });
  Object.values(focusPointsByModule).forEach((arr) => arr.sort());

  const numWeeks = SEMESTER_WEEKS;

  const weeks = [];
  for (let i = 0; i < numWeeks; i++) {
    const weekStart = new Date(today.getTime() + i * 7 * 86400000);
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const weights = {};
    let totalWeight = 0;
    modules.forEach((m) => {
      const nextFocus = focusPointsByModule[m.code].find((d) => d >= weekStartIso);
      if (!nextFocus) {
        weights[m.code] = 0;
        return;
      }
      const weeksUntil = Math.max(0, Math.round((new Date(`${nextFocus}T00:00:00`) - weekStart) / (7 * 86400000)));
      const w = 1 / (weeksUntil + 1);
      weights[m.code] = w;
      totalWeight += w;
    });
    // No module has any known upcoming deadline/exam this far out yet
    const fallbackEven = totalWeight <= 0 && modules.length > 0;
    const row = { week: `W${i + 1}` };
    modules.forEach((m) => {
      row[m.code] = fallbackEven
        ? Math.round((weeklyHours / modules.length) * 10) / 10
        : totalWeight > 0
        ? Math.round((weights[m.code] / totalWeight) * weeklyHours * 10) / 10
        : 0;
    });
    weeks.push(row);
  }
  return weeks;
}
