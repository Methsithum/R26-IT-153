import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MOCK_STUDENT_PROFILE,
  MOCK_MODULES,
  MOCK_ASSIGNMENTS,
  MOCK_EXAMS,
  MOCK_SETTINGS,
} from "../mocks/academicMocks";
import {
  ASSESSMENT_TYPE_ENCODING,
  buildDateFeatureFromDeadline,
  DEFAULT_PRIOR_AVG_SCORE,
  DEFAULT_ASSIGNMENT_WEIGHT,
  NEUTRAL_FEATURE_DEFAULTS,
  UNKNOWN_MODULE_ENC,
} from "../utils/featureNameMap";
import { buildWeeklyModuleAllocation } from "../utils/studyAllocation";
import { buildWeeklyFreeSlots } from "../utils/freeSlotGenerator";
import { buildNotificationsFromRealData } from "../utils/notificationBuilder";
import { addDays, toLocalDateStr } from "../utils/dateHelpers";
import { recordKey, toSessionInput } from "../utils/sessionTracking";
import { applyEngagement, plannedWeeklyMinutesBySubject } from "../utils/engagement";
import { applySemesterSetup } from "../utils/semesterSetup";
import {
  updateTaskWeight as apiUpdateTaskWeight,
  updateTaskDeadline as apiUpdateTaskDeadline,
  completeTask as apiCompleteTask,
  snapshotSessions as apiSnapshotSessions,
  markSession as apiMarkSession,
  fetchSessionHistory as apiFetchSessionHistory,
  fetchPendingDecisions as apiFetchPendingDecisions,
  fetchBlockedSlots as apiFetchBlockedSlots,
  rescheduleSessionTo as apiRescheduleSessionTo,
  declineReschedule as apiDeclineReschedule,
  updateExamPlan as apiUpdateExamPlan,
  fetchEngagementFeatures as apiFetchEngagementFeatures,
  fetchSemesterSetup as apiFetchSemesterSetup,
  saveSemesterSetup as apiSaveSemesterSetup,
} from "../services/academicApi";

// How far back pushFrozenHistory() re-sends locally frozen days on login -
// the backend ignores already-stored sessions, so this is only a bound on
// request size, not a correctness concern.
const HISTORY_BACKFILL_DAYS = 30;

const MODULE_COLORS = ["brand", "teal", "pink", "orange"];

function slugifySubject(subject) {
  return String(subject || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "unknown";
}

function average(nums) {
  const valid = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!valid.length) return null;
  return valid.reduce((sum, n) => sum + n, 0) / valid.length;
}

/**
 * Builds real modules/assignments/exams from the gamified journal's data
 * (real subjects from registration + real tasks/exams from its MongoDB
 * collections) instead of the mock dataset. Called once real data exists —
 * see App.jsx's HydrateUser, right after loadUserWorld() resolves.
 */
function buildFromJournal({ tasks = [], exams = [], subjects = [] }) {
  const todayIso = new Date().toISOString().slice(0, 10);

  const bySubject = {};
  subjects.forEach((subject) => {
    bySubject[subject] = { tasks: [], exams: [] };
  });
  tasks.forEach((t) => {
    if (!t?.subject) return;
    bySubject[t.subject] = bySubject[t.subject] || { tasks: [], exams: [] };
    bySubject[t.subject].tasks.push(t);
  });
  exams.forEach((e) => {
    if (!e?.subject) return;
    bySubject[e.subject] = bySubject[e.subject] || { tasks: [], exams: [] };
    bySubject[e.subject].exams.push(e);
  });

  const subjectNames = Object.keys(bySubject);

  const modules = subjectNames.map((subject, i) => {
    const { tasks: subjTasks, exams: subjExams } = bySubject[subject];
    const marks = [...subjTasks, ...subjExams]
      .map((r) => (r.mark != null && r.mark !== "" ? Number(r.mark) : null))
      .filter((m) => m != null && !Number.isNaN(m));
    const avgMark = average(marks);
    const pendingTasks = subjTasks.filter((t) => t.mark == null && String(t.progress_stage || "").toLowerCase() !== "completed");
    const completedCount = subjTasks.length - pendingTasks.length;
    const deadlines = [
      ...subjTasks.map((t) => t.deadline).filter(Boolean),
      ...subjExams.map((e) => e.date).filter(Boolean),
    ].sort();

    return {
      code: slugifySubject(subject),
      name: subject,
      color: MODULE_COLORS[i % MODULE_COLORS.length],
      currentGrade: avgMark != null ? Math.round(avgMark) : 0,
      hasGradeData: avgMark != null, // false = no marks recorded yet, not a real 0%
      trend: 0, // no historical grade series from the journal yet
      taskCount: subjTasks.length,
      progress: subjTasks.length ? completedCount / subjTasks.length : 0,
      studyHoursThisWeek: 0, // journal doesn't track study hours per subject
      nextDeadline: deadlines.find((d) => d >= todayIso) || deadlines[deadlines.length - 1] || null,
    };
  });

  const assignments = tasks
    .filter((t) => t?.subject && (t.task_type === "assignment" || !t.task_type))
    .map((t) => {
      const module = modules.find((m) => m.name === t.subject);
      const isCompleted = t.mark != null || String(t.progress_stage || "").toLowerCase() === "completed";
      const deadlineDate = t.deadline ? String(t.deadline).slice(0, 10) : null;
      const isMissed = !isCompleted && deadlineDate && deadlineDate < todayIso;
      const estimatedHoursNeeded = 4; // not tracked by the journal — neutral default
      const finalDeadlineDate = deadlineDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      // The real external Task schema has NO weight field at all (see
      // DEFAULT_ASSIGNMENT_WEIGHT's doc comment) - `!= null` correctly
      // treats a genuinely-absent field the same as an explicit null.
      const hasRealWeight = t.weight != null;
      const weight = hasRealWeight ? Number(t.weight) : DEFAULT_ASSIGNMENT_WEIGHT; // real once set via updateTaskWeight

      return {
        taskId: t.id,
        module: module?.code || slugifySubject(t.subject),
        moduleName: t.subject,
        title: t.title || `${t.subject} assignment`,
        // Distinguishes assignment deadlines from exam deadlines for
        // priorityEngine.js's base-tier thresholds (PROJECT CONTEXT.md
        // Section 5d) — exams get a longer real-world lead time. The
        // journal's `tasks` collection only ever holds assignments (exams
        // are a separate `exams` collection, never sent through /predict-
        // priority — see MonthGrid.jsx), so this is always "assignment"
        // today; kept explicit rather than assumed so the priority engine
        // has a real field to read if/when that changes.
        taskType: "assignment",
        assessmentType: "TMA", // not tracked by the journal — neutral default
        weight,
        hasRealWeight,
        deadlineDate: finalDeadlineDate,
        estimatedHoursNeeded,
        status: isCompleted ? "completed" : isMissed ? "missed" : "pending",
        completedHours: isCompleted ? estimatedHoursNeeded : 0,
        // Real completion date (task_routes.py's PATCH /complete writes
        // this) - null when absent, e.g. a task marked "completed" via the
        // journal's own mark-entry flow instead of our Complete button,
        // which never went through that route. Never fabricated: the
        // completed-tasks list falls back to an undated "Completed" line
        // rather than guessing a date that was never actually recorded.
        completedAt: t.completed_at ? String(t.completed_at).slice(0, 10) : null,
        notes: "",
        // Cold-start flag (Section 17) mirroring the existing hasRealWeight
        // pattern - lets the explanation layer (priorityEngine.js's
        // resolveExplanationDisplay) know prior_avg_score below is a neutral
        // fallback, not a real recorded average, so it never gets cited as
        // "why" a prediction came out the way it did.
        hasPriorScoreData: !!module?.hasGradeData,
        featureRow: {
          // Real deadline mapped onto the model's actual trained `date`
          // range (12-261) — see buildDateFeatureFromDeadline for why a raw
          // "days remaining" value is wrong here.
          date: buildDateFeatureFromDeadline(finalDeadlineDate),
          weight,
          // Features the app doesn't measure yet: OULAD training medians,
          // so they stay neutral (see NEUTRAL_FEATURE_DEFAULTS).
          ...NEUTRAL_FEATURE_DEFAULTS,
          // See DEFAULT_PRIOR_AVG_SCORE's own doc comment (featureNameMap.js)
          // for why this is the OULAD dataset mean, not an arbitrary number.
          prior_avg_score: module?.hasGradeData ? module.currentGrade : DEFAULT_PRIOR_AVG_SCORE,
          assessment_type_enc: ASSESSMENT_TYPE_ENCODING.TMA,
          code_module_enc: UNKNOWN_MODULE_ENC,
        },
      };
    });

  const mappedExams = exams
    .filter((e) => e?.date)
    .map((e) => ({
      id: e.id,
      module: slugifySubject(e.subject),
      moduleName: e.subject,
      date: String(e.date).slice(0, 10),
      type: e.exam_type || "Exam",
      // Back-to-back exam planning (utils/examDay.js) - null until asked.
      examSession: e.exam_session || null,
      afterExamRevision: e.after_exam_revision ?? null,
    }));

  return { modules, assignments, exams: mappedExams };
}

// Extracted (not just inline in the `persist` config below) and exported
// specifically so it's independently unit-testable - see
// src/store/__tests__/useAcademicStore.migration.test.js - without it,
// verifying migration behavior would require driving the whole Zustand
// `persist` machinery instead of just calling a pure function with a mock
// pre-migration state. No behavior change from the pre-extraction version.
export function migrateAcademicStore(persisted, version) {
  if (!persisted) return persisted;
  delete persisted.monthSessionsByKey;
  const prefs = persisted.settings?.studyPreferences;
  if (prefs && !Array.isArray(prefs.preferredStudyTimes)) {
    prefs.preferredStudyTimes = prefs.preferredStudyTime ? [prefs.preferredStudyTime] : ["evening"];
    delete prefs.preferredStudyTime;
    persisted.weeklyFreeSlots = buildWeeklyFreeSlots(prefs);
    persisted.remainingFreeSlots = persisted.weeklyFreeSlots;
    persisted.scheduleResponse = null;
    persisted.todoList = [];
  }
  if (version < 6) persisted.notifications = [];
  if (version < 7) {
    if (Array.isArray(persisted.assignments)) {
      persisted.assignments = persisted.assignments.map((a) =>
        a.deadlineDate
          ? { ...a, featureRow: { ...a.featureRow, date: buildDateFeatureFromDeadline(a.deadlineDate) } }
          : a
      );
    }
    persisted.predictedPriorities = {};
    persisted.scheduleResponse = null;
    persisted.todoList = [];
  }
  if (version < 9) {
    // Neutral (training-median) fallbacks + module-agnostic prediction
    // replaced the old placeholder feature values. Rewrite persisted feature
    // rows and drop cached predictions. The cached schedule is NOT dropped
    // here (freezePastDates must still capture its past days first) - it's
    // only flagged, and useWeeklySchedule regenerates it through
    // setSchedule, which freezes before overwriting.
    if (Array.isArray(persisted.assignments)) {
      persisted.assignments = persisted.assignments.map((a) => {
        if (!a.featureRow) return a;
        // Only journal tasks explicitly flagged as having NO real weight
        // carried the old placeholder - a weight typed in by hand (or a
        // mock/manual entry without the flag) is real and kept.
        const placeholderWeight = a.hasRealWeight === false;
        return {
          ...a,
          weight: placeholderWeight ? DEFAULT_ASSIGNMENT_WEIGHT : a.weight,
          featureRow: {
            ...a.featureRow,
            ...NEUTRAL_FEATURE_DEFAULTS,
            weight: placeholderWeight ? DEFAULT_ASSIGNMENT_WEIGHT : a.featureRow.weight,
            code_module_enc: UNKNOWN_MODULE_ENC,
          },
        };
      });
    }
    persisted.predictedPriorities = {};
    persisted.scheduleStale = true;
  }
  return persisted;
}

// Why Zustand (not React Context) for this store:
// The schedule/task state here is written from many unrelated places (task
// completion in My Tasks, reschedule flow in Task Details, regenerate in
// Study Planner) and read from many others (Dashboard cards, Sidebar badge
// counts, Analytics). A Context provider re-renders every consumer on any
// state change; Zustand's selector-based subscriptions avoid that, and its
// `persist` middleware gives us the localStorage persistence the backend
// itself doesn't provide yet (Section 8 - StudyScheduler is stateless
// per-request, so the frontend is the only place schedule state survives
// a page reload).
export const useAcademicStore = create(
  persist(
    (set, get) => ({
      // --- UI ---
      darkMode: typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches,
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

      // --- Student profile. Seeded from MOCK_STUDENT_PROFILE (there's still
      // no profile CRUD backend), but overwritten with the real registered
      // account once available — see syncProfileFromUser, called from
      // App.jsx's HydrateUser after Register/Login/refresh. ---
      profile: MOCK_STUDENT_PROFILE,
      updateProfile: (patch) => {
        set((s) => ({ profile: { ...s.profile, ...patch } }));
        if ("availableStudyHoursPerWeek" in patch) get().recomputeSemesterAllocation();
      },
      // `gameState` is useGameStore's state (userId, playerName, universityName,
      // degreeName, campusYear, semester, gpa) — only real, non-empty fields
      // overwrite the current profile so an unhydrated/logged-out game store
      // never clobbers it with blanks.
      syncProfileFromUser: (gameState) => {
        if (!gameState?.userId) return;
        set((s) => ({
          // The real account id - the only id the study_sessions history
          // is keyed by. Stays null until a real login, which disables
          // session marking rather than writing history under a mock id.
          userId: gameState.userId,
          profile: {
            ...s.profile,
            id: gameState.userId,
            studentId: gameState.userId,
            name: gameState.playerName || s.profile.name,
            university: gameState.universityName || s.profile.university,
            degree: gameState.degreeName || s.profile.degree,
            year: gameState.campusYear ?? s.profile.year,
            semester: gameState.semester ?? s.profile.semester,
            currentGpa: gameState.gpa ?? s.profile.currentGpa,
            // Registration only collects a GPA past Year1/Sem1 — false here
            // means "no real GPA yet", so currentGpa is still the mock
            // placeholder and must not be shown as if it were a real number.
            hasGpaData: gameState.gpa != null,
          },
        }));
      },

      // --- Modules. Seeded from MOCK_MODULES, replaced with real subjects
      // (and their real tasks/exams) once the gamified journal's data is
      // available — see syncFromJournal. ---
      modules: MOCK_MODULES,

      // --- Assignments / tasks. Each carries a real `featureRow` for the ML
      // endpoints, plus `priorityLabel`/`confidence` once predicted. ---
      assignments: MOCK_ASSIGNMENTS,
      predictedPriorities: {}, // taskId -> { priority_label, confidence }
      setPredictedPriority: (taskId, result) =>
        set((s) => ({ predictedPriorities: { ...s.predictedPriorities, [taskId]: result } })),

      // --- Exams (mock until synced from the journal, same as modules) ---
      exams: MOCK_EXAMS,

      // Full-semester weekly study-hours-per-module projection — see
      // utils/studyAllocation.js. `semesterAllocation[i]` is one week's row
      // ({ week: "W1", [moduleCode]: hours, ... }); recomputed whenever the
      // real modules/assignments/exams or the student's weekly availability
      // change, so it never goes stale relative to what's actually due.
      semesterAllocation: [],
      recomputeSemesterAllocation: () =>
        set((s) => {
          if (!s.modules?.length) return {};
          const weeklyHours = s.profile.availableStudyHoursPerWeek || 15;
          const semesterAllocation = buildWeeklyModuleAllocation({
            modules: s.modules,
            assignments: s.assignments,
            exams: s.exams,
            weeklyHours,
          });
          const week1 = semesterAllocation[0] || {};
          return {
            semesterAllocation,
            modules: s.modules.map((m) => ({ ...m, studyHoursThisWeek: week1[m.code] ?? 0 })),
          };
        }),

      // Replaces modules/assignments/exams with real data built from the
      // journal's registered subjects + its tasks/exams collections. Called
      // once per login/refresh from App.jsx's HydrateUser, right after
      // loadUserWorld() resolves. No-ops if the user hasn't registered any
      // subjects yet (keeps the mock preview data visible until then).
      syncFromJournal: ({ tasks, exams, subjects }) => {
        if (!subjects || subjects.length === 0) return;
        const built = buildFromJournal({ tasks: tasks || [], exams: exams || [], subjects });
        // About to potentially discard scheduleResponse/multiWeekSchedule
        // below (when the task set changed) - freeze anything they hold for
        // already-past dates first, same as setSchedule/setMultiWeekSchedule.
        get().freezePastDates();
        set((s) => {
          // Only discard the cached /schedule response when the real task
          // set actually differs from what it was generated against (e.g.
          // this is the first sync, replacing mock/placeholder assignments,
          // or the journal's tasks changed) — a normal reload where nothing
          // changed should keep the valid cached schedule, not regenerate
          // it every time the app boots.
          const oldIds = new Set(s.assignments.map((a) => a.taskId));
          const newIds = new Set(built.assignments.map((a) => a.taskId));
          const sameTasks = oldIds.size === newIds.size && [...oldIds].every((id) => newIds.has(id));
          return {
            modules: built.modules,
            // Re-apply the last known real engagement, so a re-sync doesn't
            // drop back to neutral defaults until loadEngagement() returns.
            assignments: applySemesterSetup(
              applyEngagement(built.assignments, s.engagementBySubject).assignments,
              s.semesterSetup
            ).assignments,
            exams: built.exams,
            ...(sameTasks ? {} : { scheduleResponse: null, todoList: [], multiWeekSchedule: null }),
          };
        });
        get().recomputeSemesterAllocation();
        get().recomputeNotifications();
      },

      // Real engagement per subject from the journal's study logs (backend
      // engagement_service.py), measured against this planner's own weekly
      // allocation. Replaces the neutral defaults once a subject has a
      // completed week of history; changed values invalidate cached
      // predictions and the cached plan.
      engagementBySubject: {},
      loadEngagement: async () => {
        const { userId, modules, semesterAllocation } = get();
        if (!userId || !modules.length) return;
        const engagementBySubject = await apiFetchEngagementFeatures(
          userId,
          plannedWeeklyMinutesBySubject(modules, semesterAllocation)
        );
        const { assignments, changed } = applyEngagement(get().assignments, engagementBySubject);
        set(changed
          ? { engagementBySubject, assignments, predictedPriorities: {}, scheduleStale: true }
          : { engagementBySubject });
      },

      // One-time Semester setup (credits, repeat attempts, registration,
      // semester dates) - the real values behind four model features. Saved
      // on the user's own document; applied to every assignment's feature
      // row (utils/semesterSetup.js). A change invalidates cached
      // predictions and the cached plan, like engagement above.
      semesterSetup: null,
      _applySemesterSetup: (semesterSetup) => {
        const { assignments, changed } = applySemesterSetup(get().assignments, semesterSetup);
        set(changed
          ? { semesterSetup, assignments, predictedPriorities: {}, scheduleStale: true }
          : { semesterSetup });
      },
      loadSemesterSetup: async () => {
        const { userId } = get();
        if (!userId) return;
        const setup = await apiFetchSemesterSetup(userId);
        if (setup) get()._applySemesterSetup(setup);
      },
      saveSemesterSetup: async (setup) => {
        const { userId } = get();
        if (!userId) throw new Error("Log in to save your semester setup.");
        get()._applySemesterSetup(await apiSaveSemesterSetup(userId, setup));
      },

      addAssignment: (assignment) => {
        set((s) => ({ assignments: [assignment, ...s.assignments] }));
        get().recomputeSemesterAllocation();
        get().recomputeNotifications();
      },

      // Real database write FIRST (PATCH /tasks/{id}/complete - writes
      // progress_stage: "completed" into the journal's real `tasks`
      // collection), local Zustand state updated only after that succeeds.
      // Previously this only ever touched local state - a completion the
      // student saw on screen could vanish on the next login/sync because
      // nothing durable ever recorded it. Callers (Tasks.jsx, TaskDetails.jsx)
      // must await this and handle rejection (show an error/retry state)
      // rather than assuming success, since the UI must never show
      // "completed" while the database still disagrees.
      completeTask: async (taskId) => {
        await apiCompleteTask(taskId);
        // Matches task_routes.py's local_today_iso() (date-only, no time-of-
        // day - the real DB write this mirrors never captures clock time
        // either) so a reload's real completed_at from the journal agrees
        // with what was set optimistically here, instead of drifting by a
        // few hours of "time" that was never genuinely tracked.
        const completedAt = new Date().toISOString().slice(0, 10);
        set((s) => ({
          assignments: s.assignments.map((a) =>
            a.taskId === taskId ? { ...a, status: "completed", completedHours: a.estimatedHoursNeeded, completedAt } : a
          ),
        }));
        get().recomputeSemesterAllocation();
        get().recomputeNotifications();
      },

      updateAssignmentDeadline: (taskId, newDate) => {
        set((s) => ({
          assignments: s.assignments.map((a) =>
            a.taskId === taskId
              ? {
                  ...a,
                  deadlineDate: newDate,
                  // Recompute the ML feature too — deadlineDate (display)
                  // and featureRow.date (model input) must never drift
                  // apart, or /predict-priority silently keeps scoring
                  // against the OLD deadline after the student moves it.
                  featureRow: { ...a.featureRow, date: buildDateFeatureFromDeadline(newDate) },
                }
              : a
          ),
        }));
        get().recomputeSemesterAllocation();
        get().recomputeNotifications();
        // Writes back to the journal's real task doc so this edit survives
        // the next login instead of being overwritten by syncFromJournal.
        // Mock/manually-added assignments aren't real Mongo docs and will
        // 404 here — harmless, the local edit above already applied.
        apiUpdateTaskDeadline(taskId, newDate).catch(() => {});
      },

      // Real weight write-back so /predict-priority stops getting a fixed
      // placeholder for this task from now on — see task_routes.py.
      updateAssignmentWeight: (taskId, weight) => {
        set((s) => ({
          assignments: s.assignments.map((a) =>
            a.taskId === taskId
              ? { ...a, weight, hasRealWeight: true, featureRow: { ...a.featureRow, weight } }
              : a
          ),
        }));
        get().recomputeSemesterAllocation();
        get().recomputeNotifications();
        apiUpdateTaskWeight(taskId, weight).catch(() => {});
      },

      // Exam time (morning/afternoon) + after-exam revision answer for a
      // back-to-back exam cluster. Saved to the real exam documents first;
      // then the cached plans are dropped so prep hours are recomputed with
      // the revision credit (utils/examDay.js's applyRevisionCredit).
      examPlanCluster: null, // the cluster whose ExamPlanModal is open
      openExamPlan: (cluster) => set({ examPlanCluster: cluster }),
      closeExamPlan: () => set({ examPlanCluster: null }),
      saveExamPlans: async (plans) => {
        const { userId } = get();
        if (userId) {
          await Promise.all(plans.map((p) => apiUpdateExamPlan(p.examId, userId, p)));
        }
        get().freezePastDates();
        set((s) => ({
          exams: s.exams.map((e) => {
            const plan = plans.find((p) => p.examId === e.id);
            return plan ? { ...e, examSession: plan.examSession, afterExamRevision: plan.afterExamRevision } : e;
          }),
          examPlanCluster: null,
          scheduleResponse: null,
          todoList: [],
          multiWeekSchedule: null,
        }));
      },

      updateExamDate: (examId, newDate) => {
        set((s) => ({
          exams: s.exams.map((e) => (e.id === examId ? { ...e, date: newDate } : e)),
        }));
        get().recomputeSemesterAllocation();
        get().recomputeNotifications();
      },

      // --- Schedule (real /schedule + /reschedule responses persisted locally).
      // weeklyFreeSlots is generated from the student's real Settings
      // (preferredStudyTimes + maxDailyStudyHours) via buildWeeklyFreeSlots —
      // the actual input /schedule time-blocks tasks into, so those Settings
      // genuinely drive the generated plan. ---
      weeklyFreeSlots: buildWeeklyFreeSlots(MOCK_SETTINGS.studyPreferences),
      remainingFreeSlots: buildWeeklyFreeSlots(MOCK_SETTINGS.studyPreferences),
      scheduleResponse: null, // raw ScheduleResponse from the backend
      // The real calendar date "today" was when scheduleResponse was last
      // generated - scheduleResponse itself is keyed by WEEKDAY NAME (not
      // real date), so once that date has slipped into the past this is the
      // only way to know which real date its content actually belongs to.
      // Persisted alongside scheduleResponse specifically so freezePastDates()
      // can still resolve it correctly after a reload on a later day.
      scheduleGeneratedDate: null,
      // True when the cached scheduleResponse was generated with an older
      // feature definition (see migrateAcademicStore v9) - useWeeklySchedule
      // regenerates it.
      scheduleStale: false,
      todoList: [],
      setSchedule: (scheduleResponse) => {
        // Freeze whatever the OLD scheduleResponse/multiWeekSchedule held for
        // any date that has since become past, using their content as it was
        // immediately before this call overwrites it - see freezePastDates().
        get().freezePastDates();
        set({ scheduleResponse, scheduleGeneratedDate: toLocalDateStr(new Date()), scheduleStale: false });
      },
      setRemainingFreeSlots: (slots) => set({ remainingFreeSlots: slots }),
      setTodoList: (todoList) => set({ todoList }),
      // MultiWeekScheduleResponse (PROJECT CONTEXT.md Section 8d) - real,
      // ISO-date-keyed sessions spanning several weeks ahead, fetched ONCE
      // by useMultiWeekSchedule() and sliced per-viewed-week by WeekGrid.jsx,
      // rather than a fresh backend call every time the student clicks
      // Next/Previous week. Deliberately NOT persisted (not in `partialize`
      // below) - it must always be refetched fresh on reload so future/today
      // stay genuinely live (Section 8d/8e); only its already-past dates,
      // captured into historicalScheduleByDate before each overwrite, need
      // to survive a reload.
      multiWeekSchedule: null,
      setMultiWeekSchedule: (multiWeekSchedule) => {
        get().freezePastDates();
        set({ multiWeekSchedule });
      },

      // --- Historical (frozen) per-date schedule snapshots (Section 8e) ---
      // { "YYYY-MM-DD": { sessions: [...], tasksRegistry: {...}, frozenAt } }
      // Append-only: once a date is written here it is NEVER overwritten by
      // a later regeneration, even if the live allocation algorithm would
      // now produce something different for that same date. This is what
      // makes past days in the Week view immune to "the schedule looked
      // different an hour ago" - see freezePastDates() and PROJECT
      // CONTEXT.md Section 8e for the full design rationale.
      historicalScheduleByDate: {},
      // Called right before scheduleResponse/multiWeekSchedule get replaced
      // with fresh data (setSchedule/setMultiWeekSchedule above), plus once
      // on every app load (App.jsx's HydrateUser) so a date that quietly
      // became "yesterday" while the app was closed still gets captured
      // before anything regenerates. Idempotent and safe to call repeatedly -
      // a date already present in historicalScheduleByDate is never touched
      // again by either source below.
      freezePastDates: () => {
        const s = get();
        const today = toLocalDateStr(new Date());
        const historical = { ...s.historicalScheduleByDate };
        let changed = false;
        const newlyFrozen = [];

        // Source 1: scheduleResponse - the live, /reschedule-integrated
        // single-week response, keyed by WEEKDAY NAME relative to whatever
        // "today" was when it was generated (scheduleGeneratedDate). Only
        // one real date is ever recoverable from it (the date it was
        // generated for) - but it's the more authoritative source for that
        // one date, since it reflects any "mark complete"/"missed task"
        // adjustments the multi-week response never sees.
        if (s.scheduleResponse && s.scheduleGeneratedDate && s.scheduleGeneratedDate < today && !historical[s.scheduleGeneratedDate]) {
          const weekdayName = new Date(`${s.scheduleGeneratedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" });
          historical[s.scheduleGeneratedDate] = {
            sessions: s.scheduleResponse.schedule?.[weekdayName] || [],
            tasksRegistry: s.scheduleResponse.tasks || {},
            frozenAt: new Date().toISOString(),
            source: "scheduleResponse",
          };
          changed = true;
          newlyFrozen.push(s.scheduleGeneratedDate);
        }

        // Source 2: multiWeekSchedule - already real-ISO-date-keyed, covers
        // every date in its generated range (even ones with zero sessions -
        // frozen as a genuine "nothing was scheduled" record, distinct from
        // a date that was simply never captured at all). Only fills in
        // dates Source 1 didn't already claim, so scheduleResponse's more
        // authoritative version of "today at generation time" always wins.
        if (s.multiWeekSchedule?.schedule) {
          for (const [dateStr, sessions] of Object.entries(s.multiWeekSchedule.schedule)) {
            if (dateStr < today && !historical[dateStr]) {
              historical[dateStr] = {
                sessions,
                tasksRegistry: s.multiWeekSchedule.tasks || {},
                frozenAt: new Date().toISOString(),
                source: "multiWeekSchedule",
              };
              changed = true;
              newlyFrozen.push(dateStr);
            }
          }
        }

        // Source 3: the REST of scheduleResponse's window. It covers 7 real
        // dates (scheduleGeneratedDate .. +6, each weekday bucket resolving
        // to the next such date - schedule_engine.py's resolve_day_date), and
        // it's persisted while multiWeekSchedule is not - so after a reload
        // it's the only surviving record of what those days showed. Without
        // this, a plan generated Monday and next opened Thursday froze only
        // Monday, and Tuesday/Wednesday showed "Historical data not
        // available". Lowest priority: only fills dates still unclaimed.
        if (s.scheduleResponse?.schedule && s.scheduleGeneratedDate) {
          const genDate = new Date(`${s.scheduleGeneratedDate}T00:00:00`);
          for (let offset = 1; offset < 7; offset++) {
            const day = addDays(genDate, offset);
            const dateStr = toLocalDateStr(day);
            if (dateStr >= today) break;
            if (historical[dateStr]) continue;
            const weekdayName = day.toLocaleDateString("en-US", { weekday: "long" });
            historical[dateStr] = {
              sessions: s.scheduleResponse.schedule[weekdayName] || [],
              tasksRegistry: s.scheduleResponse.tasks || {},
              frozenAt: new Date().toISOString(),
              source: "scheduleResponse",
            };
            changed = true;
            newlyFrozen.push(dateStr);
          }
        }

        if (changed) {
          set({ historicalScheduleByDate: historical });
          get().pushFrozenHistory(newlyFrozen);
        }
      },

      // --- Permanent session history (MongoDB study_sessions) ---
      // localStorage above is only this browser's cache; the backend is the
      // durable record of what was planned and whether it was really done.
      userId: null,
      // recordKey(record) -> stored session (status, reschedule_decision, ...)
      sessionRecords: {},
      // Upcoming manually rescheduled slots - sent as blocked_slots with every
      // /schedule, /multi-week-schedule and /reschedule call so the generator
      // never puts another task on top of them.
      blockedSlots: [],
      // Missed sessions with no decision yet (popup closed without choosing).
      pendingDecisions: [],
      // The missed session whose "this week / next week / don't reschedule"
      // popup is open (MissedSessionModal), or null.
      rescheduleTarget: null,

      // Sends frozen days to the backend (append-only there). `dates`
      // defaults to every locally frozen day in the last HISTORY_BACKFILL_DAYS
      // - used once per login, since days frozen while logged out (or
      // before this feature existed) only ever reached localStorage.
      pushFrozenHistory: (dates) => {
        const { userId, historicalScheduleByDate } = get();
        if (!userId) return;
        const cutoff = toLocalDateStr(addDays(new Date(), -HISTORY_BACKFILL_DAYS));
        const targetDates = dates || Object.keys(historicalScheduleByDate).filter((d) => d >= cutoff);
        const sessions = targetDates.flatMap((date) => {
          const record = historicalScheduleByDate[date];
          return (record?.sessions || []).map((item) => toSessionInput(date, item, record.tasksRegistry));
        });
        if (sessions.length) apiSnapshotSessions(userId, sessions).catch(() => {});
      },

      loadSessionRecords: async (startDate, endDate) => {
        const { userId } = get();
        if (!userId) return;
        const records = await apiFetchSessionHistory(userId, startDate, endDate);
        set((s) => {
          const next = Object.fromEntries(
            Object.entries(s.sessionRecords).filter(([, r]) => r.date < startDate || r.date > endDate)
          );
          records.forEach((r) => (next[recordKey(r)] = r));
          return { sessionRecords: next };
        });
      },

      loadSessionMeta: async () => {
        const { userId } = get();
        if (!userId) return;
        const [blockedSlots, pendingDecisions] = await Promise.all([
          apiFetchBlockedSlots(userId),
          apiFetchPendingDecisions(userId),
        ]);
        set({ blockedSlots, pendingDecisions });
      },

      _storeRecord: (record) =>
        set((s) => ({
          sessionRecords: { ...s.sessionRecords, [recordKey(record)]: record },
          pendingDecisions:
            record.status === "missed" && record.reschedule_decision === "pending"
              ? [...s.pendingDecisions.filter((p) => p.id !== record.id), record]
              : s.pendingDecisions.filter((p) => p.id !== record.id),
        })),

      // "done" | "missed". Marking missed ONLY records it and opens the
      // permission popup - it never moves anything by itself.
      markSessionStatus: async (sessionInput, status) => {
        const { userId } = get();
        if (!userId) throw new Error("Log in to track your study sessions.");
        const record = await apiMarkSession(userId, sessionInput, status);
        get()._storeRecord(record);
        if (record.status === "missed" && record.reschedule_decision === "pending") set({ rescheduleTarget: record });
        return record;
      },

      openRescheduleModal: (record) => set({ rescheduleTarget: record }),
      closeRescheduleModal: () => set({ rescheduleTarget: null }),

      // Books the ONE slot the student picked. The backend re-checks it's
      // still free and before the deadline (409 otherwise).
      confirmReschedule: async (record, { week, weeklyFreeSlots, occupied, date, timeSlot }) => {
        const { userId } = get();
        const result = await apiRescheduleSessionTo(record.id, { userId, week, weeklyFreeSlots, occupied, date, timeSlot });
        get()._storeRecord(result.missed);
        get()._storeRecord(result.new_session);
        set((s) => ({
          blockedSlots: [
            ...s.blockedSlots,
            { date: result.new_session.date, start_time: result.new_session.start_time, end_time: result.new_session.end_time },
          ],
          rescheduleTarget: null,
        }));
        return result;
      },

      declineSessionReschedule: async (record) => {
        const { userId } = get();
        const updated = await apiDeclineReschedule(record.id, userId);
        get()._storeRecord(updated);
        set({ rescheduleTarget: null });
        return updated;
      },

      // --- Notifications (mock) ---
      // Real, derived from actual assignments/exams/modules — see
      // recomputeNotifications. No mock content: starts empty and is
      // populated the moment real data syncs in.
      notifications: [],
      markNotificationRead: (id) =>
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
      // Rebuilds the notification list from current real data, preserving
      // `read`/`time` for notifications that still apply (so marking one
      // read, or its "Xh ago" timestamp, doesn't reset every recompute) and
      // dropping ones that no longer apply (deadline passed, task no
      // longer missed, grade recovered, etc). Called whenever assignments/
      // exams/modules change — see syncFromJournal, completeTask,
      // updateAssignmentDeadline.
      recomputeNotifications: () =>
        set((s) => {
          const fresh = buildNotificationsFromRealData({ assignments: s.assignments, exams: s.exams, modules: s.modules });
          const existingById = Object.fromEntries(s.notifications.map((n) => [n.id, n]));
          const notifications = fresh.map((n) => ({
            ...n,
            time: existingById[n.id]?.time || new Date().toISOString(),
            read: existingById[n.id]?.read || false,
          }));
          return { notifications };
        }),

      // --- Settings (mock) ---
      settings: MOCK_SETTINGS,
      updateNotificationSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, notifications: { ...s.settings.notifications, [key]: value } } })),
      updateStudyPreference: (key, value) => {
        if (key === "preferredStudyTimes" || key === "maxDailyStudyHours" || key === "includeWeekends" || key === "fullStudyDays") {
          // About to null out scheduleResponse/multiWeekSchedule below -
          // freeze anything they hold for already-past dates first.
          get().freezePastDates();
        }
        set((s) => {
          const studyPreferences = { ...s.settings.studyPreferences, [key]: value };
          const patch = { settings: { ...s.settings, studyPreferences } };
          if (key === "preferredStudyTimes" || key === "maxDailyStudyHours" || key === "includeWeekends" || key === "fullStudyDays") {
            // These directly define weeklyFreeSlots — regenerate it so the
            // change actually reaches /schedule, and drop the stale cached
            // schedule (built against the old slots) so it regenerates too.
            patch.weeklyFreeSlots = buildWeeklyFreeSlots(studyPreferences);
            patch.remainingFreeSlots = patch.weeklyFreeSlots;
            patch.scheduleResponse = null;
            patch.todoList = [];
            patch.multiWeekSchedule = null;
          }
          return patch;
        });
      },

      // --- Streak / celebratory state ---
      streak: 6,
      bumpStreak: () => set((s) => ({ streak: s.streak + 1 })),

      // derived helper
      getAssignmentById: (taskId) => get().assignments.find((a) => a.taskId === taskId),
    }),
    {
      name: "smart-uni-guide-study-planner",
      partialize: (s) => ({
        darkMode: s.darkMode,
        profile: s.profile,
        modules: s.modules,
        assignments: s.assignments,
        exams: s.exams,
        semesterAllocation: s.semesterAllocation,
        predictedPriorities: s.predictedPriorities,
        weeklyFreeSlots: s.weeklyFreeSlots,
        remainingFreeSlots: s.remainingFreeSlots,
        scheduleResponse: s.scheduleResponse,
        scheduleGeneratedDate: s.scheduleGeneratedDate,
        scheduleStale: s.scheduleStale,
        historicalScheduleByDate: s.historicalScheduleByDate,
        semesterSetup: s.semesterSetup,
        todoList: s.todoList,
        notifications: s.notifications,
        settings: s.settings,
        streak: s.streak,
      }),
      // v7: featureRow.date used to be a raw "days until deadline" value
      // (out of the model's actual trained range, ~12-261 — see
      // buildDateFeatureFromDeadline) and, separately, editing a deadline
      // never recomputed it — so assignments persisted from before that fix
      // are stuck holding a stale/wrong date feature no matter how many
      // times syncFromJournal reruns (it only replaces `assignments` when
      // the *set* of task ids changes, not when a feature value inside an
      // unchanged task silently needed correcting). This migration
      // recomputes date for every persisted assignment from its real
      // deadlineDate, and clears every cache downstream of the old value
      // (predictedPriorities; scheduleResponse/todoList, since a schedule
      // generated before this fix baked in priority_labels predicted from
      // the wrong feature) so the next load calls /schedule fresh with
      // corrected inputs instead of serving stale cached output forever.
      // v8: introduces historicalScheduleByDate + scheduleGeneratedDate
      // (Section 8e) - new, additive fields with safe defaults ({} / null)
      // already set by the store initializer above, so no transform is
      // needed for existing persisted state; the version bump exists purely
      // as a changelog marker for this schema addition.
      // v9: neutral feature defaults + UNKNOWN_MODULE_ENC (see the v9 branch).
      version: 9,
      migrate: migrateAcademicStore,
    }
  )
);
