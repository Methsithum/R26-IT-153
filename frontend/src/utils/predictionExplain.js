/**
 * Human-readable explanations of how career_score and academic_risk are
 * derived, built from the same feature weights the trained models use
 * (see backend/ml_scripts/career-prediction-engine/dataset_preprocessing.py).
 * These are approximations for display purposes, not the literal model
 * coefficients - the real models are a Ridge regressor and an XGBoost
 * classifier, but both are trained to reproduce this weighting.
 */

/** Career score domain weights, out of 100. */
const CAREER_FACTORS = [
  { key: 'gpa_cumulative', label: 'Cumulative GPA', weight: 20, get: (f) => f.gpa_cumulative / 4.0 },
  { key: 'project_performance', label: 'Project performance', weight: 15, get: (f) => f.project_performance / 100 },
  { key: 'career_clarity_score', label: 'Career clarity', weight: 15, get: (f) => f.career_clarity_score / 100 },
  { key: 'attendance_rate', label: 'Attendance rate', weight: 10, get: (f) => f.attendance_rate },
  { key: 'weekly_study_hours', label: 'Weekly study hours', weight: 10, get: (f) => Math.min(1, f.weekly_study_hours / 40) },
  { key: 'assignment_completion_rate', label: 'Assignment completion', weight: 5, get: (f) => f.assignment_completion_rate },
  { key: 'part_time_work_hours', label: 'Part-time work load', weight: 5, get: (f) => 1 - Math.min(1, f.part_time_work_hours / 30) },
  { key: 'sleep_hours_avg', label: 'Sleep habits', weight: 5, get: (f) => Math.min(1, f.sleep_hours_avg / 8) },
  { key: 'stress_level', label: 'Stress level', weight: 5, get: (f) => 1 - f.stress_level / 100 },
  { key: 'mood_stability', label: 'Mood stability', weight: 5, get: (f) => f.mood_stability / 100 },
  { key: 'anxiety_score', label: 'Anxiety level', weight: 5, get: (f) => 1 - f.anxiety_score / 25 },
];

/** Academic risk rule weights - the features that actually move the Low/Medium/High label. */
const RISK_FACTORS = [
  {
    key: 'gpa_cumulative',
    label: 'Cumulative GPA',
    severity: (f) => (f.gpa_cumulative < 2.5 ? 3 : f.gpa_cumulative < 3.0 ? 2 : f.gpa_cumulative < 3.3 ? 1 : 0),
    describe: (f) => `GPA of ${f.gpa_cumulative.toFixed(2)}`,
  },
  {
    key: 'gpa_trend',
    label: 'GPA trend',
    severity: (f) => (f.gpa_trend < -0.3 ? 2 : f.gpa_trend < 0 ? 1 : 0),
    describe: (f) => (f.gpa_trend < 0 ? 'GPA trending downward' : 'GPA trending flat or upward'),
  },
  {
    key: 'resit_count',
    label: 'Resit count',
    severity: (f) => (f.resit_count >= 2 ? 3 : f.resit_count === 1 ? 1 : 0),
    describe: (f) => `${f.resit_count} resit${f.resit_count === 1 ? '' : 's'}`,
  },
  {
    key: 'attendance_rate',
    label: 'Attendance rate',
    severity: (f) => (f.attendance_rate < 0.6 ? 2 : f.attendance_rate < 0.75 ? 1 : 0),
    describe: (f) => `${Math.round(f.attendance_rate * 100)}% attendance`,
  },
  {
    key: 'assignment_completion_rate',
    label: 'Assignment completion',
    severity: (f) => (f.assignment_completion_rate < 0.5 ? 2 : f.assignment_completion_rate < 0.7 ? 1 : 0),
    describe: (f) => `${Math.round(f.assignment_completion_rate * 100)}% of assignments completed`,
  },
];

/**
 * Explain the career readiness score: which of the 15 features contributed
 * most, in plain language, ranked by contribution.
 * @param {object} studentData - the 15 raw feature values
 * @returns {{topDrivers: {label: string, contribution: number}[], summary: string}}
 */
export function explainCareerScore(studentData) {
  if (!studentData) return { topDrivers: [], summary: '' };

  const contributions = CAREER_FACTORS.map((factor) => ({
    label: factor.label,
    contribution: Math.round(factor.get(studentData) * factor.weight),
  })).sort((a, b) => b.contribution - a.contribution);

  const topDrivers = contributions.slice(0, 3);
  const summary =
    topDrivers.length > 0
      ? `Mostly driven by ${topDrivers.map((d) => d.label.toLowerCase()).join(', ')}.`
      : '';

  return { topDrivers, summary };
}

/**
 * Explain the academic risk classification: which academic factors pushed
 * the risk level up, in plain language.
 * @param {object} studentData - the 15 raw feature values
 * @returns {{flags: string[], summary: string}}
 */
export function explainAcademicRisk(studentData) {
  if (!studentData) return { flags: [], summary: '' };

  const flagged = RISK_FACTORS.filter((factor) => factor.severity(studentData) > 0).sort(
    (a, b) => b.severity(studentData) - a.severity(studentData),
  );

  const flags = flagged.map((factor) => factor.describe(studentData));

  const summary =
    flags.length === 0
      ? 'No academic warning signs detected (GPA, trend, resits, attendance, and assignment completion are all healthy).'
      : `Driven by: ${flags.join('; ')}.`;

  return { flags, summary };
}
