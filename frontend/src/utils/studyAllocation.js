// A full academic term's worth of weeks - fixed, not derived from whatever
// deadlines happen to exist right now. Regular per-module revision (see
// buildStudySessionsByDay in studySessionBuilder.js) is meant to run for
// the whole semester, not just until the last currently-known deadline -
// a module with nothing due for the next 8 weeks still deserves ongoing
// study time in the meantime, and W12-14 need real rows to exist even
// though schedule_engine.py's own MAX_WEEKS_AHEAD (12) never reaches that
// far for real assignment/exam-prep scheduling.
export const SEMESTER_WEEKS = 14;

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
    // No module has any known upcoming deadline/exam this far out yet (common
    // for the later semester weeks, since real deadlines/exams are usually
    // only known a few weeks ahead) - fall back to splitting the week's hours
    // evenly across every module rather than giving everyone zero, so
    // "regular" revision keeps happening even before anything concrete is due.
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
