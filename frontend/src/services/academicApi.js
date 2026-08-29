import axios from "axios";

// The FastAPI backend currently only exposes the 6 ML endpoints below
// (see backend/PROJECT CONTEXT.md, Section 9/10). Every other page in this
// app is intentionally backed by mock data (see src/mocks) until the
// corresponding CRUD/persistence endpoints exist.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: `${BASE_URL}/study-planner`,
  headers: { "Content-Type": "application/json" },
});

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
export function createSchedule(weeklyFreeSlots, tasks) {
  return unwrap(client.post("/schedule", { weekly_free_slots: weeklyFreeSlots, tasks }));
}

/** POST /reschedule — previous schedule + remaining free slots + completed/new tasks -> same shape as /schedule */
export function rescheduleSchedule({ previousSchedule, remainingFreeSlots, completedTaskIds, newTasks }) {
  return unwrap(
    client.post("/reschedule", {
      previous_schedule: previousSchedule,
      remaining_free_slots: remainingFreeSlots,
      completed_task_ids: completedTaskIds,
      new_tasks: newTasks || [],
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

export default client;
