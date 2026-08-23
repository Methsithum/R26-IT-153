import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MOCK_STUDENT_PROFILE,
  MOCK_MODULES,
  MOCK_ASSIGNMENTS,
  MOCK_NOTIFICATIONS,
  MOCK_SETTINGS,
  MOCK_WEEKLY_FREE_SLOTS,
} from "../mocks/academicMocks";

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
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
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
          },
        }));
      },

      // --- Modules (mock) ---
      modules: MOCK_MODULES,

      // --- Assignments / tasks. Each carries a real `featureRow` for the ML
      // endpoints, plus `priorityLabel`/`confidence` once predicted. ---
      assignments: MOCK_ASSIGNMENTS,
      predictedPriorities: {}, // taskId -> { priority_label, confidence }
      setPredictedPriority: (taskId, result) =>
        set((s) => ({ predictedPriorities: { ...s.predictedPriorities, [taskId]: result } })),

      addAssignment: (assignment) => set((s) => ({ assignments: [assignment, ...s.assignments] })),

      completeTask: (taskId) =>
        set((s) => ({
          assignments: s.assignments.map((a) =>
            a.taskId === taskId ? { ...a, status: "completed", completedHours: a.estimatedHoursNeeded } : a
          ),
        })),

      updateAssignmentDeadline: (taskId, newDate) =>
        set((s) => ({
          assignments: s.assignments.map((a) => (a.taskId === taskId ? { ...a, deadlineDate: newDate } : a)),
        })),

      // --- Schedule (real /schedule + /reschedule responses persisted locally) ---
      weeklyFreeSlots: MOCK_WEEKLY_FREE_SLOTS,
      remainingFreeSlots: MOCK_WEEKLY_FREE_SLOTS,
      scheduleResponse: null, // raw ScheduleResponse from the backend
      todoList: [],
      setSchedule: (scheduleResponse) => set({ scheduleResponse }),
      setRemainingFreeSlots: (slots) => set({ remainingFreeSlots: slots }),
      setTodoList: (todoList) => set({ todoList }),

      // --- Notifications (mock) ---
      notifications: MOCK_NOTIFICATIONS,
      markNotificationRead: (id) =>
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),

      // --- Settings (mock) ---
      settings: MOCK_SETTINGS,
      updateNotificationSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, notifications: { ...s.settings.notifications, [key]: value } } })),
      updateStudyPreference: (key, value) =>
        set((s) => ({ settings: { ...s.settings, studyPreferences: { ...s.settings.studyPreferences, [key]: value } } })),

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
        assignments: s.assignments,
        predictedPriorities: s.predictedPriorities,
        weeklyFreeSlots: s.weeklyFreeSlots,
        remainingFreeSlots: s.remainingFreeSlots,
        scheduleResponse: s.scheduleResponse,
        todoList: s.todoList,
        notifications: s.notifications,
        settings: s.settings,
        streak: s.streak,
      }),
      // v2: dropped monthSessionsByKey — Study Planner's Month view no
      // longer shows fabricated placeholder sessions, only real assignment
      // deadlines, so that cached mock data is no longer used anywhere.
      version: 2,
      migrate: (persisted) => {
        if (persisted) delete persisted.monthSessionsByKey;
        return persisted;
      },
    }
  )
);
