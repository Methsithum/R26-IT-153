// Real engagement features from the journal's study logs (backend:
// engagement_service.py) - replacing the neutral training-median defaults
// for a subject once the student has at least one completed week of history.
// Engagement is measured against the student's OWN plan, so this file's
// job is to say what that plan is per subject.

const ENGAGEMENT_KEYS = ["avg_weekly_clicks", "clicks_trend", "active_weeks_ratio", "has_vle_activity"];
// How many upcoming weeks of the semester allocation describe "the plan" -
// the near-term weeks, not a whole-semester average diluted by empty weeks
// after a module's work is done.
const PLAN_WEEKS = 4;

/**
 * Subject name -> planned study minutes per week, from the planner's own
 * semester allocation (studyAllocation.js). A subject with no allocation is
 * left out and the backend uses its default (3h/week).
 */
export function plannedWeeklyMinutesBySubject(modules, semesterAllocation) {
  const weeks = (semesterAllocation || []).slice(0, PLAN_WEEKS);
  const result = {};
  (modules || []).forEach((m) => {
    const hours = weeks.map((row) => row?.[m.code] || 0);
    const avg = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
    result[m.name] = Math.round(avg * 60);
  });
  return result;
}

/**
 * Writes real engagement features into each assignment's feature row (by
 * subject = moduleName) and flags hasEngagementData so the explanation
 * layer may cite them. `changed` tells the caller whether cached
 * predictions/schedules are now stale.
 */
export function applyEngagement(assignments, engagementBySubject) {
  let changed = false;
  const next = (assignments || []).map((a) => {
    const engagement = engagementBySubject?.[a.moduleName];
    if (!engagement || !a.featureRow) return a;
    const differs = ENGAGEMENT_KEYS.some((k) => a.featureRow[k] !== engagement[k]) || !a.hasEngagementData;
    if (!differs) return a;
    changed = true;
    return {
      ...a,
      hasEngagementData: true,
      featureRow: { ...a.featureRow, ...Object.fromEntries(ENGAGEMENT_KEYS.map((k) => [k, engagement[k]])) },
    };
  });
  return { assignments: next, changed };
}
