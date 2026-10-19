// Exam days are kept completely free: nothing is scheduled on a date with an
// exam - not other modules' work, and not exam prep (prep has to be finished
// BEFORE the exam - see examPrepScheduling.js's hoursForWindow). The day
// instead shows the exam itself with a good-luck message, plus a mention
// (never a scheduled session) of any High-priority assignment due right
// around it, so the student knows it's coming without being asked to study
// for it on exam day.
import { addDays, toLocalDateStr } from "./dateHelpers";

// High-priority assignments due from the exam day up to this many days
// after it get a "heads up" mention on the exam day card.
export const EXAM_DAY_MENTION_WINDOW_DAYS = 3;

export function examsOnDate(exams, dateStr) {
  return (exams || []).filter((e) => e.date === dateStr);
}

/** Today's and future exam dates as full-day blocked ranges - sent with every schedule generation call. */
export function examDayBlockedSlots(exams, now = new Date()) {
  const today = toLocalDateStr(now);
  const dates = [...new Set((exams || []).map((e) => e.date).filter((d) => d && d >= today))];
  return dates.sort().map((date) => ({ date, start_time: "00:00", end_time: "23:59" }));
}

/**
 * True when a cached single-week scheduleResponse still has sessions on a
 * today/future exam date (generated before the exam was known, or before
 * exam days were blocked) - the caller regenerates it.
 */
export function scheduleHasExamDayItems(scheduleResponse, generatedDate, exams, now = new Date()) {
  if (!scheduleResponse?.schedule || !generatedDate) return false;
  const today = toLocalDateStr(now);
  const genDate = new Date(`${generatedDate}T00:00:00`);
  for (let offset = 0; offset < 7; offset++) {
    const day = addDays(genDate, offset);
    const dateStr = toLocalDateStr(day);
    if (dateStr < today || !examsOnDate(exams, dateStr).length) continue;
    if ((scheduleResponse.schedule[day.toLocaleDateString("en-US", { weekday: "long" })] || []).length) return true;
  }
  return false;
}

/** The live plan's occupied map with every exam date fully taken, for missed-session slot suggestions. */
export function withExamDaysOccupied(occupied, exams) {
  const next = { ...occupied };
  (exams || []).forEach((e) => {
    if (e.date) next[e.date] = ["00:00-23:59"];
  });
  return next;
}

/** Weekday names in the given week's dates that have an exam - their free time is removed for suggested study blocks. */
export function examWeekdays(weekDates, exams) {
  return new Set(
    weekDates
      .filter((d) => examsOnDate(exams, toLocalDateStr(d)).length > 0)
      .map((d) => d.toLocaleDateString("en-US", { weekday: "long" }))
  );
}

/**
 * High-priority assignments worth a mention on an exam day: pending, with
 * a deadline from the exam day through EXAM_DAY_MENTION_WINDOW_DAYS after.
 * Priority comes from the schedule's task registry (the same hybrid label
 * every other screen shows). Medium/Low tasks and exam prep are never
 * mentioned.
 */
export function highPriorityTasksNearExam(examDate, tasksRegistry, assignments) {
  const windowEnd = toLocalDateStr(addDays(new Date(`${examDate}T00:00:00`), EXAM_DAY_MENTION_WINDOW_DAYS));
  return Object.entries(tasksRegistry || {})
    .filter(
      ([, t]) =>
        t.priority_label === "High" &&
        (t.task_type || "assignment") === "assignment" &&
        t.deadline_date >= examDate &&
        t.deadline_date <= windowEnd
    )
    .map(([taskId, t]) => {
      const assignment = (assignments || []).find((a) => a.taskId === taskId);
      if (assignment && assignment.status !== "pending") return null;
      return { taskId, title: assignment?.title || t.module, deadlineDate: t.deadline_date };
    })
    .filter(Boolean)
    .sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate));
}

// --- Back-to-back exams: after-exam revision (asked, never assumed) -------
//
// The student only says whether an exam is in the morning or the afternoon;
// the actual times come from here. Revision for TOMORROW's exam may then
// start REVISION_BUFFER_MINUTES after today's last exam ends, inside the
// student's own free time (Settings), capped at MAX_REVISION_MINUTES - and
// only if they agreed to it (exam.afterExamRevision === true).
export const EXAM_SESSION_TIMES = {
  morning: { label: "Morning", start: "09:00", end: "12:00" },
  afternoon: { label: "Afternoon", start: "13:30", end: "16:30" },
};
export const REVISION_BUFFER_MINUTES = 60;
export const MAX_REVISION_MINUTES = 120;
const MIN_REVISION_MINUTES = 30;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const nextDateStr = (dateStr) => toLocalDateStr(addDays(new Date(`${dateStr}T00:00:00`), 1));

/**
 * Runs of today/future exam dates on CONSECUTIVE days (2+ days long) - the
 * only case where an exam day has no free day before the next exam. A gap
 * of even one free day leaves room for normal prep, so it's not a cluster.
 */
export function examClusters(exams, now = new Date()) {
  const today = toLocalDateStr(now);
  const dates = [...new Set((exams || []).map((e) => e.date).filter((d) => d && d >= today))].sort();
  const clusters = [];
  let run = [];
  dates.forEach((d) => {
    if (run.length && nextDateStr(run[run.length - 1]) === d) run.push(d);
    else {
      if (run.length > 1) clusters.push(run);
      run = [d];
    }
  });
  if (run.length > 1) clusters.push(run);
  return clusters.map((clusterDates) => ({
    dates: clusterDates,
    exams: (exams || []).filter((e) => clusterDates.includes(e.date)).sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

/** A cluster still needs the student's answers: an exam time, or the revision yes/no, is missing. */
export function clusterNeedsDecision(cluster) {
  return cluster.exams.some((e) => !e.examSession || e.afterExamRevision == null);
}

/**
 * The after-exam revision session for an exam day, or null. Only when:
 * another exam is the NEXT day, every exam today has a known time and was
 * agreed to (afterExamRevision === true), and the student's free time that
 * weekday has at least MIN_REVISION_MINUTES left after the buffer.
 * Shaped like a ScheduledItem (task_id "exam-<id>", same as single-week
 * exam prep) so it renders, and can be marked done/missed, like any session.
 */
export function revisionSessionForExamDay(dateStr, exams, weeklyFreeSlots) {
  const todays = examsOnDate(exams, dateStr);
  const nextExam = examsOnDate(exams, nextDateStr(dateStr)).sort((a, b) =>
    (a.examSession === "morning" ? 0 : 1) - (b.examSession === "morning" ? 0 : 1)
  )[0];
  if (!todays.length || !nextExam) return null;
  if (todays.some((e) => !e.examSession || e.afterExamRevision !== true)) return null;

  const lastEnd = Math.max(...todays.map((e) => toMinutes(EXAM_SESSION_TIMES[e.examSession].end)));
  const earliestStart = lastEnd + REVISION_BUFFER_MINUTES;
  const weekday = new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  const slot = (weeklyFreeSlots || [])
    .filter((s) => s.day === weekday)
    .map((s) => {
      const start = Math.max(toMinutes(s.start_time), earliestStart);
      const end = toMinutes(s.start_time) + s.duration_minutes;
      return { start, length: Math.min(end - start, MAX_REVISION_MINUTES) };
    })
    .filter((s) => s.length >= MIN_REVISION_MINUTES)
    .sort((a, b) => a.start - b.start)[0];
  if (!slot) return null;

  return {
    nextExam,
    item: {
      time_slot: `${toHHMM(slot.start)}-${toHHMM(slot.start + slot.length)}`,
      task_id: `exam-${nextExam.id}`,
      module: nextExam.module,
      duration_minutes: slot.length,
    },
    registryEntry: { task_type: "exam", deadline_date: nextExam.date, priority_label: "High", module: nextExam.module },
  };
}

/**
 * Hours each exam's prep will already get from agreed after-exam revision
 * the evening before it: [{ examId, date, hours }]. Subtracted from that
 * exam's prep task(s) before scheduling (applyRevisionCredit), so the same
 * hours aren't planned twice - once tonight, once crammed in days earlier.
 */
export function revisionCredits(exams, weeklyFreeSlots, now = new Date()) {
  const today = toLocalDateStr(now);
  const dates = [...new Set((exams || []).map((e) => e.date).filter((d) => d && d >= today))];
  return dates
    .map((date) => {
      const revision = revisionSessionForExamDay(date, exams, weeklyFreeSlots);
      return revision && { examId: revision.nextExam.id, date, hours: revision.item.duration_minutes / 60 };
    })
    .filter(Boolean);
}

/**
 * Reduces exam-prep tasks (from examPrepScheduling.js, still carrying
 * `_meta`) by revision credits - only the task whose own scheduling window
 * contains the revision date (single-week: today..+6; multi-week chunk w:
 * 7w..7w+6), since that's the window the evening-before hours were folded
 * into. A task reduced to nothing is dropped.
 */
export function applyRevisionCredit(tasks, credits, now = new Date()) {
  if (!credits.length) return tasks;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return tasks
    .map((task) => {
      const weekIdx = task._meta?.weekIdx ?? 0;
      const credit = credits
        .filter((c) => c.examId === task._meta?.examId)
        .filter((c) => {
          const offset = Math.round((new Date(`${c.date}T00:00:00`) - today) / 86400000);
          return offset >= weekIdx * 7 && offset <= weekIdx * 7 + 6;
        })
        .reduce((sum, c) => sum + c.hours, 0);
      if (!credit) return task;
      return { ...task, estimated_hours_needed: Math.round((task.estimated_hours_needed - credit) * 4) / 4 };
    })
    .filter((task) => task.estimated_hours_needed > 0);
}

const EXAM_TYPE_LABELS ={ mid: "Mid exam", final: "Final exam", lab: "Lab exam", quiz: "Quiz" };

export function examLabel(exam, moduleName) {
  const type = EXAM_TYPE_LABELS[String(exam.type || "").toLowerCase()] || exam.type || "Exam";
  const time = EXAM_SESSION_TIMES[exam.examSession];
  return `${exam.moduleName || moduleName(exam.module)} · ${type}${time ? ` · ${time.start}-${time.end}` : ""}`;
}
