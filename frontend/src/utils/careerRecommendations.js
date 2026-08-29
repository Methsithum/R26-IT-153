/**
 * Career domain scoring rules. Each `score` function receives the student's
 * 15 feature values and returns a 0-100 match score for that domain.
 */
const CAREERS = [
  {
    label: 'Software Engineering',
    icon: '</>',
    score: (f) =>
      (f.project_performance / 100) * 35 +
      (f.gpa_cumulative / 4.0) * 25 +
      f.assignment_completion_rate * 20 +
      (1 - f.late_submission_rate) * 10 +
      (f.weekly_study_hours / 40) * 10,
  },
  {
    label: 'Data Science',
    icon: '📊',
    score: (f) =>
      (f.gpa_cumulative / 4.0) * 30 +
      (f.career_clarity_score / 100) * 25 +
      (f.weekly_study_hours / 40) * 20 +
      (f.project_performance / 100) * 15 +
      (1 - f.stress_level / 100) * 10,
  },
  {
    label: 'UX Research',
    icon: '🎨',
    score: (f) =>
      (f.mood_stability / 100) * 30 +
      f.attendance_rate * 25 +
      (1 - f.stress_level / 100) * 20 +
      (1 - f.anxiety_score / 25) * 15 +
      (f.career_clarity_score / 100) * 10,
  },
  {
    label: 'Cybersecurity',
    icon: '🔒',
    score: (f) =>
      (f.project_performance / 100) * 30 +
      (f.gpa_cumulative / 4.0) * 25 +
      (f.weekly_study_hours / 40) * 20 +
      f.sleep_consistency * 15 +
      (1 - f.late_submission_rate) * 10,
  },
  {
    label: 'Cloud Computing',
    icon: '☁️',
    score: (f) =>
      (f.gpa_trend > 0 ? 30 : 10) +
      (f.weekly_study_hours / 40) * 25 +
      (f.gpa_cumulative / 4.0) * 25 +
      (1 - f.part_time_work_hours / 40) * 10 +
      (f.project_performance / 100) * 10,
  },
  {
    label: 'AI & ML',
    icon: '🤖',
    score: (f) =>
      (f.gpa_cumulative / 4.0) * 35 +
      (f.project_performance / 100) * 30 +
      (f.career_clarity_score / 100) * 20 +
      (f.weekly_study_hours / 40) * 15,
  },
  {
    label: 'IT Management',
    icon: '📋',
    score: (f) =>
      f.attendance_rate * 30 +
      f.assignment_completion_rate * 25 +
      (1 - f.stress_level / 100) * 20 +
      (f.mood_stability / 100) * 15 +
      (f.career_clarity_score / 100) * 10,
  },
  {
    label: 'DevOps Engineering',
    icon: '⚙️',
    score: (f) =>
      (f.project_performance / 100) * 30 +
      f.assignment_completion_rate * 25 +
      (1 - f.late_submission_rate) * 20 +
      f.sleep_consistency * 15 +
      (f.gpa_cumulative / 4.0) * 10,
  },
  {
    label: 'QA & Test Engineering',
    icon: '🧪',
    score: (f) =>
      f.assignment_completion_rate * 30 +
      (1 - f.late_submission_rate) * 25 +
      f.attendance_rate * 20 +
      (f.project_performance / 100) * 15 +
      (1 - f.anxiety_score / 25) * 10,
  },
  {
    label: 'Mobile App Development',
    icon: '📱',
    score: (f) =>
      (f.project_performance / 100) * 35 +
      (f.gpa_cumulative / 4.0) * 20 +
      (f.weekly_study_hours / 40) * 20 +
      f.assignment_completion_rate * 15 +
      (f.career_clarity_score / 100) * 10,
  },
  {
    label: 'Database Administration',
    icon: '🗄️',
    score: (f) =>
      (f.gpa_cumulative / 4.0) * 30 +
      f.attendance_rate * 25 +
      (1 - f.late_submission_rate) * 20 +
      f.sleep_consistency * 15 +
      (f.project_performance / 100) * 10,
  },
  {
    label: 'Network Engineering',
    icon: '🌐',
    score: (f) =>
      (f.gpa_cumulative / 4.0) * 30 +
      f.attendance_rate * 25 +
      (f.project_performance / 100) * 20 +
      (1 - f.stress_level / 100) * 15 +
      (1 - f.resit_count / 5) * 10,
  },
  {
    label: 'Game Development',
    icon: '🎮',
    score: (f) =>
      (f.project_performance / 100) * 35 +
      (f.career_clarity_score / 100) * 25 +
      (f.weekly_study_hours / 40) * 20 +
      (f.mood_stability / 100) * 10 +
      (f.gpa_cumulative / 4.0) * 10,
  },
  {
    label: 'Business Analysis',
    icon: '📈',
    score: (f) =>
      f.attendance_rate * 25 +
      (f.career_clarity_score / 100) * 25 +
      (f.mood_stability / 100) * 20 +
      f.assignment_completion_rate * 20 +
      (1 - f.stress_level / 100) * 10,
  },
  {
    label: 'Technical Writing',
    icon: '📝',
    score: (f) =>
      f.assignment_completion_rate * 30 +
      (1 - f.late_submission_rate) * 25 +
      (f.mood_stability / 100) * 20 +
      f.attendance_rate * 15 +
      (1 - f.anxiety_score / 25) * 10,
  },
  {
    label: 'Blockchain Development',
    icon: '⛓️',
    score: (f) =>
      (f.gpa_cumulative / 4.0) * 35 +
      (f.project_performance / 100) * 30 +
      (f.weekly_study_hours / 40) * 20 +
      (f.career_clarity_score / 100) * 15,
  },
  {
    label: 'Full Stack Web Development',
    icon: '🖥️',
    score: (f) =>
      (f.project_performance / 100) * 35 +
      f.assignment_completion_rate * 25 +
      (f.gpa_cumulative / 4.0) * 20 +
      (f.weekly_study_hours / 40) * 10 +
      (1 - f.late_submission_rate) * 10,
  },
  {
    label: 'IT Support & Systems Admin',
    icon: '🛠️',
    score: (f) =>
      f.attendance_rate * 30 +
      (1 - f.stress_level / 100) * 25 +
      (f.mood_stability / 100) * 20 +
      f.assignment_completion_rate * 15 +
      (1 - f.resit_count / 5) * 10,
  },
  {
    label: 'Product Management',
    icon: '🧭',
    score: (f) =>
      (f.career_clarity_score / 100) * 30 +
      (f.mood_stability / 100) * 25 +
      f.attendance_rate * 20 +
      (1 - f.stress_level / 100) * 15 +
      (f.gpa_cumulative / 4.0) * 10,
  },
];

/** Fallback values used for any feature missing from `studentData`. */
const DEFAULTS = {
  gpa_cumulative: 0,
  gpa_trend: 0,
  assignment_completion_rate: 0,
  late_submission_rate: 0,
  resit_count: 0,
  project_performance: 0,
  attendance_rate: 0,
  weekly_study_hours: 0,
  sleep_hours_avg: 0,
  sleep_consistency: 0,
  part_time_work_hours: 0,
  stress_level: 0,
  anxiety_score: 0,
  mood_stability: 0,
  career_clarity_score: 0,
};

/**
 * Score all IT career domains against a student's feature values and
 * return the top 3 as { label, icon, match } sorted by match descending.
 * @param {object} studentData - the 15 model features
 * @returns {{label: string, icon: string, match: number}[]}
 */
export function getCareerRecommendations(studentData) {
  const f = { ...DEFAULTS, ...studentData };

  return CAREERS.map((career) => ({
    label: career.label,
    icon: career.icon,
    match: Math.round(Math.max(0, Math.min(100, career.score(f)))),
  }))
    .sort((a, b) => b.match - a.match)
    .slice(0, 3);
}
