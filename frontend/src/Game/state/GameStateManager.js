import { create } from "zustand";
import { generateDailyQuestions, shouldEscalateToMarkEntry } from "../data/questions";
import { ASSIGNMENT_STATUS } from "../data/assignments";
import { EXAM_STATUS } from "../data/exams";
import { getBuildingById } from "../data/buildings";
import { mapBackendQuestion, serializeAnswer } from "../data/backendQuestion";
import { readStoredUser } from "../../services/userApi";
import { startDailySession, submitDailyAnswer } from "../../services/journalApi";
import { useJournalHistoryStore } from "./journalHistoryStore";
import { useRunnerStore } from "./runnerStore";
import {
  createEmptyJournalDay,
  recordResponse,
  recordInteraction,
  completeJournalDay,
} from "../data/journal";

export const PHASES = {
  GAME_START: "GAME_START",
  RUNNING: "RUNNING",
  QUESTION_APPROACHING: "QUESTION_APPROACHING",
  ANSWER_SELECTION: "ANSWER_SELECTION",
  ANSWER_CONFIRMED: "ANSWER_CONFIRMED",
  CHECKING_DATA_REQUIREMENT: "CHECKING_DATA_REQUIREMENT",
  TRANSITION_TO_BUILDING: "TRANSITION_TO_BUILDING",
  ENTERING_BUILDING: "ENTERING_BUILDING",
  SPECIAL_INTERACTION_READY: "SPECIAL_INTERACTION_READY",
  SPECIAL_INTERACTION_ACTIVE: "SPECIAL_INTERACTION_ACTIVE",
  SPECIAL_INTERACTION_COMPLETED: "SPECIAL_INTERACTION_COMPLETED",
  RETURNING_TO_CAMPUS: "RETURNING_TO_CAMPUS",
  RUNNING_RESUMED: "RUNNING_RESUMED",
  DAILY_COMPLETION: "DAILY_COMPLETION",
  GAME_PAUSED: "GAME_PAUSED",
};

const XP_RULES = {
  GAME_START: 10,
  ANSWER: 15,
  INTERACTION: 40,
  DAILY_COMPLETE: 100,
};

const initialDay = 1;

export const useGameStore = create((set, get) => ({
  phase: PHASES.GAME_START,
  day: initialDay,
  level: 1,
  xp: 0,
  score: 0,
  speed: 12,
  playerName: "",
  userId: null,
  subjects: [],
  universityName: "",
  degreeName: "",
  campusYear: null,
  semester: null,

  assignments: [],
  exams: [],
  selectedActivities: [],
  todaySubjects: [],
  lectureSubjects: [],
  assignmentSubjects: [],
  examSubjects: [],
  examKinds: [],
  journalDay: createEmptyJournalDay(initialDay),

  sessionId: null,
  sessionCompleted: false,
  backendJournalEntry: null,
  backendJournalHighlights: [],

  questionQueue: [],
  questionIndex: 0,
  activeQuestion: null,
  pendingAnswer: null,

  objectiveText: "Continue your campus run",
  targetBuildingId: null,
  transitionEntryZ: 0,
  showControlHints: true,

  dailyCompleted: false,

  applyUserProgress: (user) => {
    if (!user) return;
    const xp = user.total_xp ?? get().xp;
    const day = Math.max(1, user.current_day || 1);
    set({
      userId: user.id || get().userId,
      playerName: user.name || get().playerName,
      subjects: user.subjects || [],
      universityName: user.university_name || get().universityName,
      degreeName: user.degree_name || get().degreeName,
      campusYear: user.campus_year ?? get().campusYear,
      semester: user.semester ?? get().semester,
      xp,
      level: Math.max(1, Math.floor(xp / 500) + 1),
      day,
      dailyCompleted: Boolean(user.daily_completed),
      journalDay:
        get().journalDay?.day === day ? get().journalDay : createEmptyJournalDay(day),
    });
  },

  startDailyGame: async ({
    activities = [],
    lectureSubjects = [],
    assignmentSubjects = [],
    examSubjects = [],
    examKinds = [],
  } = {}) => {
    const user = readStoredUser();
    if (!user?.id) {
      throw new Error("Please register or sign in before starting today's run.");
    }

    useRunnerStore.getState().resetRun();
    get().applyUserProgress(user);
    const day = get().day;

    const res = await startDailySession({
      userId: user.id,
      selectedActivities: activities,
      lectureSubjects,
      assignmentSubjects,
      examSubjects,
      examKinds,
    });
    const first = mapBackendQuestion(res);
    if (!first || !res.session_id) {
      throw new Error("No journal question could be selected for today.");
    }

    set({
      phase: PHASES.RUNNING,
      selectedActivities: activities,
      lectureSubjects,
      assignmentSubjects,
      examSubjects,
      todaySubjects: [...new Set([...lectureSubjects, ...assignmentSubjects, ...examSubjects])],
      examKinds,
      sessionId: res.session_id,
      sessionCompleted: false,
      backendJournalEntry: null,
      backendJournalHighlights: [],
      questionQueue: [first],
      questionIndex: 0,
      activeQuestion: null,
      pendingAnswer: null,
      journalDay: createEmptyJournalDay(day),
      dailyCompleted: false,
      objectiveText: "Continue your campus run",
      xp: get().xp + XP_RULES.GAME_START,
    });
  },

  ingestBackendAnswer: async (answerValue) => {
    const { sessionId, questionQueue, assignments, exams, selectedActivities } = get();
    if (!sessionId) return;

    try {
      const res = await submitDailyAnswer(sessionId, serializeAnswer(answerValue));
      if (res.completed) {
        set({
          sessionCompleted: true,
          backendJournalEntry: res.journal_entry || null,
          backendJournalHighlights: res.journal_highlights || [],
        });
        return;
      }
      const next = mapBackendQuestion(res);
      if (next) {
        set({ questionQueue: [...get().questionQueue, next] });
      }
    } catch {
      const asked = new Set(questionQueue.map((q) => q.id));
      const extra = generateDailyQuestions({
        assignments,
        exams,
        questionCount: 2,
        preferredCategories: selectedActivities,
      }).find((q) => !asked.has(q.id));
      if (extra) set({ questionQueue: [...get().questionQueue, extra] });
    }
  },

  spawnNextQuestion: () => {
    const { questionQueue, questionIndex, sessionCompleted } = get();
    const next = questionQueue[questionIndex];
    if (!next || sessionCompleted) {
      get().finishDailyGame();
      return;
    }
    set({
      phase: next.answers?.length ? PHASES.ANSWER_SELECTION : PHASES.QUESTION_APPROACHING,
      activeQuestion: next,
      objectiveText: next.answers?.length ? "Pick a lane to answer" : "Continue your campus run",
    });
  },

  questionBoardReached: () => set({ phase: PHASES.ANSWER_SELECTION }),

  passInfoBoard: () => {
    const { activeQuestion } = get();
    if (!activeQuestion) return;
    set({ phase: PHASES.CHECKING_DATA_REQUIREMENT });
    setTimeout(() => {
      const targetLocation = activeQuestion.targetLocation ?? getBuildingById("library")?.id;
      const building = getBuildingById(targetLocation);
      set({
        phase: PHASES.TRANSITION_TO_BUILDING,
        targetBuildingId: targetLocation,
        objectiveText: building ? `Head to the ${building.name}` : "Head to the building",
      });
    }, 400);
  },

  confirmAnswer: async (answerValue) => {
    const { activeQuestion, journalDay } = get();
    if (!activeQuestion) return;

    set({
      phase: PHASES.ANSWER_CONFIRMED,
      pendingAnswer: answerValue,
      journalDay: recordResponse(journalDay, activeQuestion, answerValue, "lane"),
      xp: get().xp + XP_RULES.ANSWER,
      score: get().score + 120,
    });

    const escalates = shouldEscalateToMarkEntry(activeQuestion, answerValue);
    const needsInteraction = activeQuestion.requiresSpecialInteraction || escalates;
    if (!needsInteraction) {
      await get().ingestBackendAnswer(answerValue);
      const todayKey = new Date().toISOString().slice(0, 10);
      if (activeQuestion.context?.field === "exam-mark-check") {
        const examId = activeQuestion.context?.missingExams?.[0]?.id;
        set({
          exams: get().exams.map((exam) =>
            exam.id === examId ? { ...exam, lastMarkCheckDate: todayKey } : exam
          ),
        });
      }
      if (activeQuestion.context?.field === "mark-check") {
        const subject = activeQuestion.context?.subject || activeQuestion.subject;
        set({
          assignments: get().assignments.map((item) =>
            item.id === activeQuestion.context?.assignmentId || item.subject === subject
              ? { ...item, lastMarkCheckDate: todayKey }
              : item
          ),
        });
      }
    }

    setTimeout(() => get().evaluateDataRequirement(), 900);
  },

  evaluateDataRequirement: () => {
    const { activeQuestion, pendingAnswer } = get();
    set({ phase: PHASES.CHECKING_DATA_REQUIREMENT });

    const escalates = shouldEscalateToMarkEntry(activeQuestion, pendingAnswer);
    const needsInteraction = activeQuestion.requiresSpecialInteraction || escalates;

    setTimeout(() => {
      if (needsInteraction) {
        const targetLocation =
          activeQuestion.targetLocation ?? getBuildingById("library")?.id;
        const building = getBuildingById(targetLocation);
        set({
          phase: PHASES.TRANSITION_TO_BUILDING,
          targetBuildingId: targetLocation,
          transitionEntryZ: useRunnerStore.getState().posZ,
          objectiveText: building ? `Head to the ${building.name}` : "Head to the building",
        });
      } else {
        get().advanceQuestionQueue();
      }
    }, 400);
  },

  buildingTransitionComplete: () => set({ phase: PHASES.ENTERING_BUILDING }),

  buildingEntered: () => set({ phase: PHASES.SPECIAL_INTERACTION_READY }),

  startSpecialInteraction: () => set({ phase: PHASES.SPECIAL_INTERACTION_ACTIVE }),

  completeSpecialInteraction: async (result) => {
    const { activeQuestion, journalDay, assignments, exams } = get();
    let updatedAssignments = assignments;
    let updatedExams = exams;

    if (activeQuestion?.context?.assignmentId) {
      updatedAssignments = assignments.map((a) => {
        if (a.id !== activeQuestion.context.assignmentId) return a;
        if (activeQuestion.context.field === "deadline") {
          return { ...a, deadline: result.value, status: ASSIGNMENT_STATUS.DEADLINE_RECORDED };
        }
        if (activeQuestion.interactionType === "marks") {
          return {
            ...a,
            mark: result.value,
            status: ASSIGNMENT_STATUS.MARK_RECEIVED,
            lastMarkCheckDate: new Date().toISOString().slice(0, 10),
          };
        }
        return a;
      });
    }

    if (activeQuestion?.context?.field === "examDates" && result.value) {
      updatedExams = exams.map((e) =>
        result.value[e.id]
          ? { ...e, date: result.value[e.id], status: EXAM_STATUS.DATE_RECORDED }
          : e
      );
    }

    const examMarkField = activeQuestion?.context?.field;
    if ((examMarkField === "examMark" || examMarkField === "exam-mark-check") && result.value != null) {
      const examId = activeQuestion?.context?.missingExams?.[0]?.id;
      updatedExams = exams.map((e) =>
        e.id === examId || (!examId && e.subject === activeQuestion?.context?.subject)
          ? {
              ...e,
              mark: result.value,
              status: EXAM_STATUS.MARK_RECEIVED,
              lastMarkCheckDate: new Date().toISOString().slice(0, 10),
            }
          : e
      );
    }

    set({
      phase: PHASES.SPECIAL_INTERACTION_COMPLETED,
      assignments: updatedAssignments,
      exams: updatedExams,
      journalDay: recordInteraction(journalDay, activeQuestion, result),
      xp: get().xp + XP_RULES.INTERACTION,
      score: get().score + 300,
    });

    await get().ingestBackendAnswer(result.value);
    setTimeout(() => set({ phase: PHASES.RETURNING_TO_CAMPUS }), 700);
  },

  returnTransitionComplete: () => {
    set({ phase: PHASES.RUNNING_RESUMED, targetBuildingId: null, objectiveText: "Continue your campus run" });
    setTimeout(() => get().advanceQuestionQueue(), 300);
  },

  advanceQuestionQueue: () => {
    const nextIndex = get().questionIndex + 1;
    set({ questionIndex: nextIndex, activeQuestion: null, pendingAnswer: null, phase: PHASES.RUNNING });
    if (get().sessionCompleted || nextIndex >= get().questionQueue.length) {
      setTimeout(() => get().finishDailyGame(), 1200);
    }
  },

  finishDailyGame: () => {
    const { journalDay, xp, score, day, level, backendJournalEntry, backendJournalHighlights } = get();
    const finalXp = xp + XP_RULES.DAILY_COMPLETE;
    const completedDay = completeJournalDay(journalDay, finalXp, score);
    set({
      phase: PHASES.DAILY_COMPLETION,
      dailyCompleted: true,
      journalDay: completedDay,
      xp: finalXp,
      objectiveText: "Daily journal complete",
    });
    useJournalHistoryStore.getState().addEntry({
      day,
      journalDay: completedDay,
      journalEntry: backendJournalEntry,
      highlights: backendJournalHighlights || [],
      xp: finalXp,
      score,
      level,
      completedAt: completedDay.completedAt,
    });
  },

  startNextDay: () => {
    set({
      phase: PHASES.GAME_START,
      sessionId: null,
      sessionCompleted: false,
      backendJournalEntry: null,
      backendJournalHighlights: [],
      questionQueue: [],
      questionIndex: 0,
      activeQuestion: null,
      pendingAnswer: null,
    });
  },

  dismissControlHints: () => set({ showControlHints: false }),

  togglePause: () =>
    set((s) => ({
      phase: s.phase === PHASES.GAME_PAUSED ? PHASES.RUNNING : PHASES.GAME_PAUSED,
    })),

  setSpeed: (speed) => set({ speed }),

  dailyProgress: () => {
    const { questionQueue, questionIndex, dailyCompleted, sessionCompleted } = get();
    if (dailyCompleted || sessionCompleted) return 1;
    if (questionQueue.length === 0) return 0;
    return Math.min(1, questionIndex / Math.max(questionQueue.length, 1));
  },
}));
