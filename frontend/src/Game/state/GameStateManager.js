import { create } from "zustand";
import { generateDailyQuestions, shouldEscalateToMarkEntry } from "../data/questions";
import { initialAssignments, ASSIGNMENT_STATUS } from "../data/assignments";
import { initialExams, EXAM_STATUS } from "../data/exams";
import { getBuildingById } from "../data/buildings";
import { useJournalHistoryStore } from "./journalHistoryStore";
import { useRunnerStore } from "./runnerStore";
import {
  createEmptyJournalDay,
  recordResponse,
  recordInteraction,
  completeJournalDay,
} from "../data/journal";

// ---- Central game state machine -------------------------------------
// Every screen/behaviour of the runner is driven off `phase`. Nothing
// should be inferred from ad-hoc booleans scattered across components.

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

const initialDay = 4; // matches the reference "DAY 04"

export const useGameStore = create((set, get) => ({
  // --- meta / progression ---
  phase: PHASES.GAME_START,
  day: initialDay,
  level: 15,
  xp: 1240,
  score: 8450,
  speed: 12,

  assignments: initialAssignments,
  exams: initialExams,
  selectedActivities: [],
  journalDay: createEmptyJournalDay(initialDay),

  questionQueue: [],
  questionIndex: 0,
  activeQuestion: null,
  pendingAnswer: null,

  objectiveText: "Continue your campus run",
  targetBuildingId: null,
  transitionEntryZ: 0,
  showControlHints: true,

  dailyCompleted: false,

  // --- lifecycle ---
  // `activities` is the set of category ids the student picked on the Daily
  // Activity Selection screen (e.g. ["academic", "wellbeing"]) — it biases
  // which normal questions surface first without excluding the rest.
  startDailyGame: (activities = []) => {
    const { assignments, exams, day } = get();
    const queue = generateDailyQuestions({
      assignments,
      exams,
      questionCount: 4,
      preferredCategories: activities,
    });
    set({
      phase: PHASES.RUNNING,
      selectedActivities: activities,
      questionQueue: queue,
      questionIndex: 0,
      activeQuestion: null,
      journalDay: createEmptyJournalDay(day),
      objectiveText: "Continue your campus run",
      xp: get().xp + XP_RULES.GAME_START,
    });
  },

  // Called by the environment/spawner once the player is far enough to
  // trigger the next queued question.
  spawnNextQuestion: () => {
    const { questionQueue, questionIndex } = get();
    const next = questionQueue[questionIndex];
    if (!next) {
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

  // For "info-only" boards (already known to require a special interaction,
  // e.g. "when is your deadline?") — no lane answer to pick, just run through.
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

  // Player passed through an answer lane.
  confirmAnswer: (answerValue) => {
    const { activeQuestion, journalDay } = get();
    if (!activeQuestion) return;

    set({
      phase: PHASES.ANSWER_CONFIRMED,
      pendingAnswer: answerValue,
      journalDay: recordResponse(journalDay, activeQuestion, answerValue, "lane"),
      xp: get().xp + XP_RULES.ANSWER,
      score: get().score + 120,
    });

    // brief pause for feedback pop, then evaluate data requirement
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

  // --- building transition flow ---
  buildingTransitionComplete: () => set({ phase: PHASES.ENTERING_BUILDING }),

  buildingEntered: () => set({ phase: PHASES.SPECIAL_INTERACTION_READY }),

  startSpecialInteraction: () => set({ phase: PHASES.SPECIAL_INTERACTION_ACTIVE }),

  // Called by the (future) mini-game via SpecialInteractionRouter with
  // { completed: true, value }
  completeSpecialInteraction: (result) => {
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

    // Exam Calendar Sort resolves every pending exam in one interaction:
    // result.value is { [examId]: dateString }.
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

    setTimeout(() => set({ phase: PHASES.RETURNING_TO_CAMPUS }), 700);
  },

  returnTransitionComplete: () => {
    set({ phase: PHASES.RUNNING_RESUMED, targetBuildingId: null, objectiveText: "Continue your campus run" });
    setTimeout(() => get().advanceQuestionQueue(), 300);
  },

  // --- shared progression step ---
  advanceQuestionQueue: () => {
    const nextIndex = get().questionIndex + 1;
    set({ questionIndex: nextIndex, activeQuestion: null, pendingAnswer: null, phase: PHASES.RUNNING });
    if (nextIndex >= get().questionQueue.length) {
      setTimeout(() => get().finishDailyGame(), 1200);
    }
  },

  finishDailyGame: () => {
    const { journalDay, xp, score, day, level } = get();
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
    });
  },

  dismissControlHints: () => set({ showControlHints: false }),

  togglePause: () =>
    set((s) => ({
      phase: s.phase === PHASES.GAME_PAUSED ? PHASES.RUNNING : PHASES.GAME_PAUSED,
    })),

  setSpeed: (speed) => set({ speed }),

  // Progress fraction for the daily HUD bar.
  dailyProgress: () => {
    const { questionQueue, questionIndex, dailyCompleted } = get();
    if (dailyCompleted) return 1;
    if (questionQueue.length === 0) return 0;
    return Math.min(1, questionIndex / questionQueue.length);
  },
}));
