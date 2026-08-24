// Real, data-driven weekly study-hours-per-module allocation — built from
// each module's actual remaining assignment deadlines and exam dates (both
// real once synced from the journal), spread across the student's real
// weekly availability (profile.availableStudyHoursPerWeek). Not a logged
// record of hours actually studied (the journal doesn't track that) — it's
// a projection of how the available time *should* be split, weighted
// toward whatever's due soonest.
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

  const allDates = Object.values(focusPointsByModule).flat();
  const maxDate = allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : null;
  const daysUntilMax = maxDate ? Math.max(1, Math.round((new Date(`${maxDate}T00:00:00`) - today) / 86400000)) : 0;
  const numWeeks = Math.min(16, Math.max(4, Math.ceil(daysUntilMax / 7) || 4));

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
    const row = { week: `W${i + 1}` };
    modules.forEach((m) => {
      row[m.code] = totalWeight > 0 ? Math.round((weights[m.code] / totalWeight) * weeklyHours * 10) / 10 : 0;
    });
    weeks.push(row);
  }
  return weeks;
}
