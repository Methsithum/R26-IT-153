// MOCK DATA — clearly marked so it's easy to find and swap out later.
// Structured to mirror the shapes the real CRUD endpoints (Section 14 of
// PROJECT CONTEXT.md) are expected to return, so wiring a real API later
// should mostly mean replacing the import with a service call of the same
// shape rather than rewriting components.
import { CODE_MODULE_ENCODING, ASSESSMENT_TYPE_ENCODING, buildDateFeatureFromDeadline } from "../utils/featureNameMap";

// Placeholder shown only until the real registered user (from the Auth flow's
// useGameStore) is hydrated in — see useAcademicStore's syncProfileFromUser.
export const MOCK_STUDENT_PROFILE = {
  id: "stu-2026-0142",
  name: "Amaya Perera",
  studentId: "SUG2026-0142",
  university: "",
  degree: "BSc (Hons) Computer Science",
  year: 2,
  semester: 1,
  targetGpa: 3.7,
  currentGpa: 3.42,
  previousGpa: 3.31,
  availableStudyHoursPerWeek: 18,
  avatarColor: "brand",
};

export const MOCK_MODULES = [
  {
    code: "AAA",
    name: "Database Systems",
    color: "brand",
    currentGrade: 61,
    trend: -3,
    taskCount: 4,
    progress: 0.55,
    studyHoursThisWeek: 3.5,
    nextDeadline: "2026-08-27",
  },
  {
    code: "BBB",
    name: "Software Engineering",
    color: "teal",
    currentGrade: 78,
    trend: 4,
    taskCount: 3,
    progress: 0.7,
    studyHoursThisWeek: 2,
    nextDeadline: "2026-09-02",
  },
  {
    code: "CCC",
    name: "Operating Systems",
    color: "pink",
    currentGrade: 69,
    trend: 1,
    taskCount: 2,
    progress: 0.4,
    studyHoursThisWeek: 1.5,
    nextDeadline: "2026-09-05",
  },
  {
    code: "DDD",
    name: "Web Application Development",
    color: "orange",
    currentGrade: 84,
    trend: 6,
    taskCount: 2,
    progress: 0.85,
    studyHoursThisWeek: 1,
    nextDeadline: "2026-09-10",
  },
];

const MODULE_TREND = [
  { term: "Term 1", AAA: 58, BBB: 70, CCC: 65, DDD: 79 },
  { term: "Term 2", AAA: 63, BBB: 74, CCC: 66, DDD: 81 },
  { term: "Term 3", AAA: 61, BBB: 78, CCC: 69, DDD: 84 },
];
export const MOCK_MODULE_PERFORMANCE_TREND = MODULE_TREND;

// deadlineDate is the single source of truth — `date` is always derived
// from it (never passed separately), so a mock assignment's ML feature can
// never drift out of sync with its own real, displayed deadline the way a
// hardcoded "days until deadline" literal would (see bug report: it did,
// silently, as soon as "today" moved past when these mocks were authored).
function buildFeatureRow({ module, assessmentType, weight, deadlineDate, priorAvgScore, weeklyClicks, clicksTrend, activeWeeksRatio, hasVle, prevAttempts = 0, studiedCredits = 60 }) {
  return {
    date: buildDateFeatureFromDeadline(deadlineDate),
    weight,
    num_of_prev_attempts: prevAttempts,
    studied_credits: studiedCredits,
    module_presentation_length: 240,
    date_registration: -30,
    prior_avg_score: priorAvgScore,
    avg_weekly_clicks: weeklyClicks,
    clicks_trend: clicksTrend,
    active_weeks_ratio: activeWeeksRatio,
    has_vle_activity: hasVle,
    assessment_type_enc: ASSESSMENT_TYPE_ENCODING[assessmentType],
    code_module_enc: CODE_MODULE_ENCODING[module],
  };
}

// Mock assignments — each carries a real feature_row so pages can call the
// live /predict-priority, /explain, /schedule endpoints against them.
export const MOCK_ASSIGNMENTS = [
  {
    taskId: "task-aaa-tma3",
    module: "AAA",
    moduleName: "Database Systems",
    title: "TMA03 — Normalization & Indexing",
    taskType: "assignment", // see priorityEngine.js / PROJECT CONTEXT.md Section 5d
    assessmentType: "TMA",
    weight: 25,
    deadlineDate: "2026-08-27",
    estimatedHoursNeeded: 6,
    status: "pending",
    completedHours: 2,
    notes: "Cover 3NF proofs and index selection for the sample schema.",
    featureRow: buildFeatureRow({
      module: "AAA", assessmentType: "TMA", weight: 25, deadlineDate: "2026-08-27",
      priorAvgScore: 58, weeklyClicks: 12, clicksTrend: -4, activeWeeksRatio: 0.4, hasVle: 1,
    }),
  },
  {
    taskId: "task-bbb-cma2",
    module: "BBB",
    moduleName: "Software Engineering",
    title: "CMA02 — Requirements & UML",
    taskType: "assignment",
    assessmentType: "CMA",
    weight: 10,
    deadlineDate: "2026-09-02",
    estimatedHoursNeeded: 3,
    status: "pending",
    completedHours: 1,
    notes: "Quiz-style, covers use-case diagrams from week 4.",
    featureRow: buildFeatureRow({
      module: "BBB", assessmentType: "CMA", weight: 10, deadlineDate: "2026-09-02",
      priorAvgScore: 78, weeklyClicks: 30, clicksTrend: 5, activeWeeksRatio: 0.8, hasVle: 1,
    }),
  },
  {
    taskId: "task-ccc-tma1",
    module: "CCC",
    moduleName: "Operating Systems",
    title: "TMA01 — Scheduling Algorithms",
    taskType: "assignment",
    assessmentType: "TMA",
    weight: 20,
    deadlineDate: "2026-09-05",
    estimatedHoursNeeded: 5,
    status: "pending",
    completedHours: 0,
    notes: "Compare Round Robin vs. MLFQ with worked examples.",
    featureRow: buildFeatureRow({
      module: "CCC", assessmentType: "TMA", weight: 20, deadlineDate: "2026-09-05",
      priorAvgScore: 69, weeklyClicks: 18, clicksTrend: 1, activeWeeksRatio: 0.55, hasVle: 1,
    }),
  },
  {
    taskId: "task-ddd-exam",
    module: "DDD",
    moduleName: "Web Application Development",
    title: "Practical Exam — React & REST",
    // taskType (priorityEngine.js) != assessmentType (ML feature) below -
    // this is still an assignment-flow task (goes through /schedule like
    // the rest of MOCK_ASSIGNMENTS), just with assessment_type_enc="Exam".
    // Real calendar exams live in MOCK_EXAMS instead and never get a
    // taskType at all (see MonthGrid.jsx - they never get an ML priority).
    taskType: "assignment",
    assessmentType: "Exam",
    weight: 40,
    deadlineDate: "2026-09-10",
    estimatedHoursNeeded: 8,
    status: "pending",
    completedHours: 5,
    notes: "Timed practical: build a small CRUD app against a given API.",
    featureRow: buildFeatureRow({
      module: "DDD", assessmentType: "Exam", weight: 40, deadlineDate: "2026-09-10",
      priorAvgScore: 84, weeklyClicks: 22, clicksTrend: 2, activeWeeksRatio: 0.9, hasVle: 1,
    }),
  },
  {
    taskId: "task-aaa-cma2",
    module: "AAA",
    moduleName: "Database Systems",
    title: "CMA02 — SQL Query Practice",
    taskType: "assignment",
    assessmentType: "CMA",
    weight: 8,
    deadlineDate: "2026-08-24",
    estimatedHoursNeeded: 2,
    status: "completed",
    completedHours: 2,
    notes: "Auto-marked SQL exercises.",
    featureRow: buildFeatureRow({
      module: "AAA", assessmentType: "CMA", weight: 8, deadlineDate: "2026-08-24",
      priorAvgScore: 58, weeklyClicks: 12, clicksTrend: -4, activeWeeksRatio: 0.4, hasVle: 1,
    }),
  },
  {
    taskId: "task-bbb-tma1",
    module: "BBB",
    moduleName: "Software Engineering",
    title: "TMA01 — Agile Retrospective Report",
    taskType: "assignment",
    assessmentType: "TMA",
    weight: 15,
    deadlineDate: "2026-08-15",
    estimatedHoursNeeded: 4,
    status: "missed",
    completedHours: 1,
    notes: "Reflect on sprint 2 velocity and blockers.",
    featureRow: buildFeatureRow({
      module: "BBB", assessmentType: "TMA", weight: 15, deadlineDate: "2026-08-15",
      priorAvgScore: 78, weeklyClicks: 30, clicksTrend: 5, activeWeeksRatio: 0.8, hasVle: 1,
    }),
  },
];

export const MOCK_EXAMS = [
  { id: "exam-ddd", module: "DDD", moduleName: "Web Application Development", date: "2026-09-10", type: "Practical Exam" },
  { id: "exam-ccc", module: "CCC", moduleName: "Operating Systems", date: "2026-09-22", type: "Final Exam" },
  { id: "exam-aaa", module: "AAA", moduleName: "Database Systems", date: "2026-09-29", type: "Final Exam" },
];

export const MOCK_SETTINGS = {
  notifications: {
    assignmentReminders: true,
    examReminders: true,
    studySessionReminders: true,
    missedTaskAlerts: true,
  },
  studyPreferences: {
    preferredStudyTimes: ["evening"], // 1 or 2 of: morning | afternoon | evening | night
    maxDailyStudyHours: 4,
    breakDurationMinutes: 15,
  },
};


export const MOCK_WEEKLY_STUDY_HOURS = [
  { day: "Mon", hours: 2 },
  { day: "Tue", hours: 1.5 },
  { day: "Wed", hours: 3 },
  { day: "Thu", hours: 2 },
  { day: "Fri", hours: 1 },
  { day: "Sat", hours: 3.5 },
  { day: "Sun", hours: 1.5 },
];

export const MOCK_STUDY_STREAK = { days: 6, best: 14 };
export const MOCK_PRODUCTIVITY_SCORE = { score: 78, trend: 5 };
