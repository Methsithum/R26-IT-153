import axios from "axios";
import { withAuth } from "./apiClient";

// The FastAPI backend currently only exposes the 6 ML endpoints below
// (see backend/PROJECT CONTEXT.md, Section 9/10). Every other page in this
// app is intentionally backed by mock data (see src/mocks) until the
// corresponding CRUD/persistence endpoints exist.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: `${BASE_URL}/study-planner`,
  headers: { "Content-Type": "application/json" },
});
client.interceptors.request.use(withAuth);

function unwrap(promise) {
  return promise.then((res) => res.data).catch((err) => {
    const detail = err?.response?.data?.detail;
    const message = typeof detail === "string" ? detail : err.message || "Request failed";
    throw new Error(message);
  });
}

/** POST /predict-priority — { ...13 raw feature values } -> { priority_label, confidence } */
export function predictPriority(featureRow) {
  return unwrap(client.post("/predict-priority", featureRow));
}

/** POST /explain — same 13 features -> { predicted_priority, feature_contributions, explanation_sentence } */
export function explainTask(featureRow) {
  return unwrap(client.post("/explain", featureRow));
}

/** POST /predict-cluster — 7 behavioral features -> { cluster_id, cluster_label } */
export function predictCluster(behaviorFeatures) {
  return unwrap(client.post("/predict-cluster", behaviorFeatures));
}

/** POST /schedule — { weekly_free_slots, tasks } -> { schedule, overload_warning, tasks } */
// blockedSlots: manually rescheduled sessions ({ date, start_time, end_time })
// the generator must keep free - see fetchBlockedSlots() below.
export function createSchedule(weeklyFreeSlots, tasks, blockedSlots = []) {
  return unwrap(client.post("/schedule", { weekly_free_slots: weeklyFreeSlots, tasks, blocked_slots: blockedSlots }));
}

/**
 * POST /multi-week-schedule — { weekly_free_slots, tasks, weeks_ahead? } ->
 * { schedule (real ISO date -> sessions, spanning every generated week),
 *   overload_warning, tasks (+ weeks_allocated per task), weeks_generated,
 *   range_start, range_end }. Called ONCE to cover a forward range of weeks
 * (see useMultiWeekSchedule(), useAcademicData.js) rather than once per
 * "Next"/"Previous" click - the Week view then slices whichever 7-day
 * window is currently being viewed out of this single response.
 */
export function createMultiWeekSchedule(weeklyFreeSlots, tasks, weeksAhead, blockedSlots = []) {
  return unwrap(
    client.post("/multi-week-schedule", {
      weekly_free_slots: weeklyFreeSlots,
      tasks,
      weeks_ahead: weeksAhead ?? null,
      blocked_slots: blockedSlots,
    })
  );
}

/** POST /reschedule — previous schedule + remaining free slots + completed/new tasks -> same shape as /schedule */
export function rescheduleSchedule({ previousSchedule, remainingFreeSlots, completedTaskIds, newTasks, blockedSlots = [] }) {
  return unwrap(
    client.post("/reschedule", {
      previous_schedule: previousSchedule,
      remaining_free_slots: remainingFreeSlots,
      completed_task_ids: completedTaskIds,
      new_tasks: newTasks || [],
      blocked_slots: blockedSlots,
    })
  );
}

/** POST /todo — a /schedule or /reschedule response -> array of to-do entries */
export function getTodoList(scheduleResponse) {
  return unwrap(client.post("/todo", scheduleResponse));
}

/**
 * PATCH /tasks/{id}/weight — writes a real assignment weight back into the
 * journal's tasks collection, so /predict-priority stops getting a fixed
 * placeholder (weight: 20) for this task on every future prediction.
 */
export function updateTaskWeight(taskId, weight) {
  return unwrap(client.patch(`/tasks/${taskId}/weight`, { weight }));
}

/** PATCH /tasks/{id}/deadline — same real-write-back, for deadline edits (Month view). */
export function updateTaskDeadline(taskId, deadline) {
  return unwrap(client.patch(`/tasks/${taskId}/deadline`, { deadline }));
}

/** POST /tasks — creates a real assignment in the journal's tasks collection (Add Academic Data). */
export function createRealTask({ userId, subject, title, deadline, weight }) {
  return unwrap(client.post("/tasks", { user_id: userId, subject, title, deadline, weight }));
}

/**
 * PATCH /tasks/{id}/complete — writes real completion (progress_stage:
 * "completed" + completed_at) back into the journal's tasks collection, so
 * "Complete" in the UI actually persists past the next login/sync instead
 * of only living in this browser's Zustand state.
 */
export function completeTask(taskId) {
  return unwrap(client.patch(`/tasks/${taskId}/complete`));
}

/**
 * PATCH /exams/{id}/plan - records which half of the day an exam is in
 * ("morning" | "afternoon") and/or whether after-exam revision for the next
 * day's exam is allowed (exam_plan_routes.py).
 */
export function updateExamPlan(examId, userId, { examSession, afterExamRevision }) {
  return unwrap(
    client.patch(`/exams/${examId}/plan`, {
      user_id: userId,
      exam_session: examSession ?? null,
      after_exam_revision: afterExamRevision ?? null,
    })
  );
}

/**
 * POST /engagement-features - the priority model's 4 engagement features per
 * subject from the student's real journal study logs, measured against
 * plannedWeeklyMinutes ({ subjectName: minutes }). Subjects without a
 * completed week of history are omitted (keep neutral defaults for them).
 */
export function fetchEngagementFeatures(userId, plannedWeeklyMinutes) {
  return unwrap(
    client.post("/engagement-features", { user_id: userId, planned_weekly_minutes: plannedWeeklyMinutes })
  );
}

/** GET /semester-setup/{userId} - the saved Semester setup, or null if never filled in. */
export function fetchSemesterSetup(userId) {
  return unwrap(client.get(`/semester-setup/${userId}`));
}

/** PUT /semester-setup - { semester_start, semester_end, registered_on, subjects: { name: { credits, prev_attempts } } } */
export function saveSemesterSetup(userId, setup) {
  return unwrap(client.put("/semester-setup", { user_id: userId, ...setup }));
}

// --- Study-session history + permission-first missed-session flow ---
// (backend/app/routes/study_planner/session_routes.py). `session` is a
// SessionInput: { date, time_slot, task_id, module, duration_minutes,
// task_type, deadline_date } - see toSessionInput() in sessionTracking.js.

/** POST /sessions/snapshot - append-only save; already-stored sessions are left untouched. */
export function snapshotSessions(userId, sessions) {
  return unwrap(client.post("/sessions/snapshot", { user_id: userId, sessions }));
}

/** POST /sessions/mark - "done" | "missed". Marking missed only records it; nothing is moved. */
export function markSession(userId, session, status) {
  return unwrap(client.post("/sessions/mark", { user_id: userId, session, status }));
}

/** GET /sessions - stored sessions (with their status) between two ISO dates, inclusive. */
export function fetchSessionHistory(userId, startDate, endDate) {
  return unwrap(client.get("/sessions", { params: { user_id: userId, start_date: startDate, end_date: endDate } }));
}

/** GET /sessions/pending-decisions - missed sessions the student hasn't decided about yet. */
export function fetchPendingDecisions(userId) {
  return unwrap(client.get("/sessions/pending-decisions", { params: { user_id: userId } }));
}

/** GET /sessions/blocked - upcoming manually booked slots, for every schedule generation call. */
export function fetchBlockedSlots(userId) {
  return unwrap(client.get("/sessions/blocked", { params: { user_id: userId } }));
}

/** GET /sessions/stats - done/missed/pending counts + completion_rate. */
export function fetchSessionStats(userId) {
  return unwrap(client.get("/sessions/stats", { params: { user_id: userId } }));
}

/** POST /sessions/{id}/suggest-slots - free slots in "this" or "next" week, up to the deadline. */
export function suggestSlots(sessionId, { userId, week, weeklyFreeSlots, occupied }) {
  return unwrap(
    client.post(`/sessions/${sessionId}/suggest-slots`, {
      user_id: userId,
      week,
      weekly_free_slots: weeklyFreeSlots,
      occupied,
    })
  );
}

/** POST /sessions/{id}/reschedule-to - books the ONE slot the student picked (409 if it's no longer free). */
export function rescheduleSessionTo(sessionId, { userId, week, weeklyFreeSlots, occupied, date, timeSlot }) {
  return unwrap(
    client.post(`/sessions/${sessionId}/reschedule-to`, {
      user_id: userId,
      week,
      weekly_free_slots: weeklyFreeSlots,
      occupied,
      date,
      time_slot: timeSlot,
    })
  );
}

/** POST /sessions/{id}/decline - "don't reschedule": stays missed, schedule untouched. */
export function declineReschedule(sessionId, userId) {
  return unwrap(client.post(`/sessions/${sessionId}/decline`, { user_id: userId }));
}

export default client;
