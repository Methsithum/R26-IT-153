// Turns the student's one-time Semester setup (backend
// semester_setup_routes.py) into four priority-model features that used to
// be fixed placeholders.
//
// The model was trained on the Open University's OULAD data, whose scales
// differ from a regular university's: an OU module runs ~9 months (median
// 261 days) and a typical OU load is 60 credits. So, like engagement
// (engagement_service.py), each scaled feature is anchored on "normal":
// a NORMAL semester here maps to the OULAD median, a heavier/longer one
// above it, a lighter/shorter one below it. Only date_registration is
// already in the same unit (days relative to the start) and is used as-is.
import { daysRemaining } from "./dateHelpers";

// What counts as "normal" at a regular university - the two constants a
// different university would adjust.
export const NORMAL_SEMESTER_CREDITS = 20;
export const NORMAL_SEMESTER_DAYS = 126; // 18 weeks

// OULAD training-set medians and ranges (oulad_task_level_leakage_free.csv).
const OULAD_MEDIAN_CREDITS = 60;
const OULAD_CREDITS_RANGE = [30, 240];
const OULAD_MEDIAN_LENGTH = 261;
const OULAD_LENGTH_RANGE = [234, 269];
const OULAD_REGISTRATION_RANGE = [-311, 167];

const clamp = (n, [lo, hi]) => Math.min(hi, Math.max(lo, n));

export function totalCredits(setup) {
  return Object.values(setup?.subjects || {}).reduce((sum, s) => sum + (Number(s.credits) || 0), 0);
}

/** The four model features for one subject, or null when there's no setup yet (keep neutral defaults). */
export function semesterFeaturesForSubject(setup, subjectName) {
  if (!setup?.semester_start || !setup?.semester_end) return null;
  const lengthDays = daysRemaining(setup.semester_end, new Date(`${setup.semester_start}T00:00:00`));
  const credits = totalCredits(setup);
  return {
    module_presentation_length: Math.round(clamp((OULAD_MEDIAN_LENGTH * lengthDays) / NORMAL_SEMESTER_DAYS, OULAD_LENGTH_RANGE)),
    // No credits entered at all -> keep the neutral median rather than reading "0 credits".
    studied_credits: credits > 0 ? Math.round(clamp((OULAD_MEDIAN_CREDITS * credits) / NORMAL_SEMESTER_CREDITS, OULAD_CREDITS_RANGE)) : OULAD_MEDIAN_CREDITS,
    // Negative = registered before the semester started, exactly OULAD's convention.
    date_registration: setup.registered_on
      ? clamp(daysRemaining(setup.registered_on, new Date(`${setup.semester_start}T00:00:00`)), OULAD_REGISTRATION_RANGE)
      : -53,
    num_of_prev_attempts: Math.min(6, Math.max(0, Number(setup.subjects?.[subjectName]?.prev_attempts) || 0)),
  };
}

const SETUP_KEYS = ["module_presentation_length", "studied_credits", "date_registration", "num_of_prev_attempts"];

/** Same shape/contract as applyEngagement (utils/engagement.js): writes the features in and flags hasSemesterData. */
export function applySemesterSetup(assignments, setup) {
  let changed = false;
  const next = (assignments || []).map((a) => {
    const features = semesterFeaturesForSubject(setup, a.moduleName);
    if (!features || !a.featureRow) return a;
    if (a.hasSemesterData && SETUP_KEYS.every((k) => a.featureRow[k] === features[k])) return a;
    changed = true;
    return { ...a, hasSemesterData: true, featureRow: { ...a.featureRow, ...features } };
  });
  return { assignments: next, changed };
}
