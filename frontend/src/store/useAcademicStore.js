import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MOCK_STUDENT_PROFILE,
  MOCK_MODULES,
  MOCK_ASSIGNMENTS,
  MOCK_EXAMS,
  MOCK_SETTINGS,
} from "../mocks/academicMocks";
import { CODE_MODULE_ENCODING, ASSESSMENT_TYPE_ENCODING, buildDateFeatureFromDeadline } from "../utils/featureNameMap";
import { buildWeeklyModuleAllocation } from "../utils/studyAllocation";
import { buildWeeklyFreeSlots } from "../utils/freeSlotGenerator";
import { buildNotificationsFromRealData } from "../utils/notificationBuilder";
import { updateTaskWeight as apiUpdateTaskWeight, updateTaskDeadline as apiUpdateTaskDeadline } from "../services/academicApi";

const MODULE_COLORS = ["brand", "teal", "pink", "orange"];
// The trained model only knows 7 fixed OULAD module categories (AAA-GGG) —
// it has never seen a real subject name. Each real subject gets mapped
// positionally onto one of those categories so /predict-priority etc. still
// work; this is an approximation forced by the model's fixed training
// categories, not a claim that e.g. "Operating Systems" literally is "AAA".
const MODEL_MODULE_CODES = Object.keys(CODE_MODULE_ENCODING);

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
      const modelCodeIndex = subjectNames.indexOf(t.subject) % MODEL_MODULE_CODES.length;
      const modelCode = MODEL_MODULE_CODES[modelCodeIndex];
      const isCompleted = t.mark != null || String(t.progress_stage || "").toLowerCase() === "completed";
      const deadlineDate = t.deadline ? String(t.deadline).slice(0, 10) : null;
      const isMissed = !isCompleted && deadlineDate && deadlineDate < todayIso;
      const estimatedHoursNeeded = 4; // not tracked by the journal — neutral default
      const finalDeadlineDate = deadlineDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const hasRealWeight = t.weight != null;
      const weight = hasRealWeight ? Number(t.weight) : 20; // real once set via updateTaskWeight; 20 is a neutral placeholder until then

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
        notes: "",
        featureRow: {
          // Real deadline mapped onto the model's actual trained `date`
          // range (12-261) — see buildDateFeatureFromDeadline for why a raw
          // "days remaining" value is wrong here.
          date: buildDateFeatureFromDeadline(finalDeadlineDate),
          weight,
          num_of_prev_attempts: 0,
          studied_credits: 60,
          module_presentation_length: 240,
          date_registration: -30,
          prior_avg_score: module?.currentGrade || 65,
          avg_weekly_clicks: 15,
          clicks_trend: 0,
          active_weeks_ratio: 0.5,
          has_vle_activity: 1,
          assessment_type_enc: ASSESSMENT_TYPE_ENCODING.TMA,
          code_module_enc: CODE_MODULE_ENCODING[modelCode],
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
    }));

  return { modules, assignments, exams: mappedExams };
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
            assignments: built.assignments,
            exams: built.exams,
            ...(sameTasks ? {} : { scheduleResponse: null, todoList: [] }),
          };
        });
        get().recomputeSemesterAllocation();
        get().recomputeNotifications();
      },

      addAssignment: (assignment) => {
        set((s) => ({ assignments: [assignment, ...s.assignments] }));
        get().recomputeSemesterAllocation();
        get().recomputeNotifications();
      },

      completeTask: (taskId) => {
        set((s) => ({
          assignments: s.assignments.map((a) =>
            a.taskId === taskId ? { ...a, status: "completed", completedHours: a.estimatedHoursNeeded } : a
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
      todoList: [],
      setSchedule: (scheduleResponse) => set({ scheduleResponse }),
      setRemainingFreeSlots: (slots) => set({ remainingFreeSlots: slots }),
      setTodoList: (todoList) => set({ todoList }),

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
      updateStudyPreference: (key, value) =>
        set((s) => {
          const studyPreferences = { ...s.settings.studyPreferences, [key]: value };
          const patch = { settings: { ...s.settings, studyPreferences } };
          if (key === "preferredStudyTimes" || key === "maxDailyStudyHours") {
            // These directly define weeklyFreeSlots — regenerate it so the
            // change actually reaches /schedule, and drop the stale cached
            // schedule (built against the old slots) so it regenerates too.
            patch.weeklyFreeSlots = buildWeeklyFreeSlots(studyPreferences);
            patch.remainingFreeSlots = patch.weeklyFreeSlots;
            patch.scheduleResponse = null;
            patch.todoList = [];
          }
          return patch;
        }),

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
      version: 7,
      migrate: (persisted, version) => {
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
        return persisted;
      },
    }
  )
);
