import { create } from "zustand";
import { generateDailyQuestions, shouldEscalateToMarkEntry } from "../data/questions";
import { initialAssignments, ASSIGNMENT_STATUS } from "../data/assignments";
import { initialExams, EXAM_STATUS } from "../data/exams";
import { getBuildingById } from "../data/buildings";
import { mapBackendQuestion, serializeAnswer } from "../data/backendQuestion";
import { ensureGuestUser } from "../../services/userApi";
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

const initialDay = 4;

export const useGameStore = create((set, get) => ({
  phase: PHASES.GAME_START,
  day: initialDay,
  level: 15,
  xp: 1240,
  score: 8450,
  speed: 12,
  playerName: "Alex",

  assignments: initialAssignments,
  exams: initialExams,
  selectedActivities: [],
  journalDay: createEmptyJournalDay(initialDay),

  sessionId: null,
  sessionCompleted: false,
  backendJournalEntry: null,

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
    set({
      playerName: user.name || get().playerName,
      xp,
      level: Math.max(1, Math.floor(xp / 500) + 1),
    });
  },

  startDailyGame: async (activities = []) => {
    const { assignments, exams, day } = get();
    useRunnerStore.getState().resetRun();

    const localQueue = generateDailyQuestions({
      assignments,
      exams,
      questionCount: 4,
      preferredCategories: activities,
    });

    let queue = localQueue;
    let sessionId = null;

    try {
      const user = await ensureGuestUser(get().playerName);
      get().applyUserProgress(user);
      const res = await startDailySession({
        userId: user.id,
        selectedActivities: activities,
      });
      const first = mapBackendQuestion(res);
      if (first && res.session_id) {
        queue = [first];
        sessionId = res.session_id;
      }
    } catch {
      // Backend unreachable — keep the local tagged pool so the run still works.
    }

    set({
      phase: PHASES.RUNNING,
      selectedActivities: activities,
      sessionId,
      sessionCompleted: false,
      backendJournalEntry: null,
      questionQueue: queue,
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
        set({ sessionCompleted: true, backendJournalEntry: res.journal_entry || null });
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
    const { journalDay, xp, score, day, level, backendJournalEntry } = get();
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
      xp: finalXp,
      score,
      level,
      completedAt: completedDay.completedAt,
    });
  },

  startNextDay: () => {
    const nextDay = get().day + 1;
    set({
      day: nextDay,
      dailyCompleted: false,
      phase: PHASES.GAME_START,
      sessionId: null,
      sessionCompleted: false,
      backendJournalEntry: null,
      questionQueue: [],
      questionIndex: 0,
      activeQuestion: null,
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
