import { create } from "zustand";
import { generateDailyQuestions, shouldEscalateToSpecialEntry } from "../data/questions";
import { campusDateKey, localTodayIso } from "../../services/localDate";
import { ASSIGNMENT_STATUS } from "../data/assignments";
import { EXAM_STATUS } from "../data/exams";
import { getBuildingById } from "../data/buildings";
import { missionLabel } from "../Environment/stationMap";
import { mapBackendQuestion, serializeAnswer } from "../data/backendQuestion";
import { levelFromXp } from "../data/progression";
import { readStoredUser, storeUser, apiErrorMessage, loadUserWorld } from "../../services/userApi";
import { startDailySession, submitDailyAnswer, deleteTodayJournal, finishDailyRun } from "../../services/journalApi";
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
  APPROACHING_FINISH: "APPROACHING_FINISH",
  DAY_CELEBRATION: "DAY_CELEBRATION",
  DAILY_COMPLETION: "DAILY_COMPLETION",
  GAME_PAUSED: "GAME_PAUSED",
};

const UNPAUSABLE = new Set([
  PHASES.GAME_START,
  PHASES.DAY_CELEBRATION,
  PHASES.DAILY_COMPLETION,
]);

export function isPausablePhase(phase) {
  return Boolean(phase) && !UNPAUSABLE.has(phase);
}

function whenUnpaused(get, fn, delay = 0) {
  const run = () => {
    if (get().paused || get().restarting) {
      setTimeout(run, 160);
      return;
    }
    fn();
  };
  if (delay) setTimeout(run, delay);
  else run();
}

function mapBackendTasks(tasks = []) {
  const submitted = new Set(["report_completed", "completed", "viva_pending"]);
  return (tasks || [])
    .filter((task) => task && (task.task_type === "assignment" || task.subject))
    .map((task) => {
      const stage = String(task.progress_stage || "").toLowerCase();
      return {
        id: task.id,
        title: task.title || `${task.subject} assignment`,
        subject: task.subject,
        status:
          task.mark != null && task.mark !== ""
            ? ASSIGNMENT_STATUS.MARK_RECEIVED
            : submitted.has(stage)
              ? ASSIGNMENT_STATUS.MARK_PENDING
              : task.deadline
                ? ASSIGNMENT_STATUS.DEADLINE_RECORDED
                : ASSIGNMENT_STATUS.NEW,
        deadline: task.deadline || null,
        mark: task.mark ?? null,
        lastMarkCheckDate: task.last_mark_check || null,
        markCheckFrequencyDays: 7,
      };
    });
}

function mapBackendExams(exams = []) {
  return (exams || []).map((exam) => ({
    id: exam.id,
    subject: exam.subject,
    examType: exam.exam_type,
    status:
      exam.mark != null && exam.mark !== ""
        ? EXAM_STATUS.MARK_RECEIVED
        : exam.date
          ? EXAM_STATUS.DATE_RECORDED
          : EXAM_STATUS.PENDING,
    date: exam.date || null,
    mark: exam.mark ?? null,
    lastMarkCheckDate: exam.last_mark_check || null,
    markCheckFrequencyDays: 7,
  }));
}

export const XP_RULES = {
  GAME_START: 10,
  ANSWER: 15,
  INTERACTION: 40,
  DAILY_COMPLETE: 100,
  HIT_PENALTY: 25,
  PICKUP: 12,
};

export const MAX_LIVES = 4;

function pushFloater(list, floater) {
  return [...list, floater].slice(-8);
}

function xpPatch(state, nextXp, extra = {}) {
  const xp = Math.max(0, nextXp);
  const prevLevel = state.level || levelFromXp(state.xp);
  const level = levelFromXp(xp);
  const patch = { ...extra, xp, level };
  if (level > prevLevel) {
    patch.leveledUpTo = level;
    patch.floatingTexts = pushFloater(extra.floatingTexts || state.floatingTexts, {
      id: performance.now() + 1,
      kind: "level",
      text: `LEVEL ${level}`,
      sub: "Campus rank up",
    });
  }
  return patch;
}

export function isActiveCampusRun(state) {
  return Boolean(state?.sessionId) && state.phase !== PHASES.GAME_START;
}

const initialDay = 1;

export const useGameStore = create((set, get) => ({
  phase: PHASES.GAME_START,
  day: initialDay,
  level: 1,
  xp: 0,
  score: 0,
  lifetimeScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  badges: [],
  newBadges: [],
  runStartXp: 0,
  runStartLevel: 1,
  leveledUpTo: null,
  speed: 12,
  lives: MAX_LIVES,
  combo: 0,
  exhausted: false,
  hitFlashAt: 0,
  floatingTexts: [],
  playerName: "",
  userId: null,
  subjects: [],
  universityName: "",
  degreeName: "",
  campusYear: null,
  semester: null,
  gpa: null,

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
  missedDates: [],
  playDate: null,
  journalDate: null,
  finishLineZ: null,
  paused: false,
  restarting: false,
  restartError: null,

  applyUserProgress: (user, { preserveRun = false } = {}) => {
    if (!user) return;
    const xp = user.total_xp ?? get().xp;
    const day = Math.max(1, user.current_day || get().day || 1);
    const patch = {
      userId: user.id || get().userId,
      playerName: user.name || get().playerName,
      subjects: user.subjects || [],
      universityName: user.university_name || get().universityName,
      degreeName: user.degree_name || get().degreeName,
      campusYear: user.campus_year ?? get().campusYear,
      semester: user.semester ?? get().semester,
      gpa: user.gpa ?? null,
      currentStreak: user.current_streak ?? get().currentStreak ?? 0,
      longestStreak: user.longest_streak ?? get().longestStreak ?? 0,
      badges: Array.isArray(user.badges) ? user.badges : get().badges || [],
      day,
      dailyCompleted: Boolean(user.daily_completed),
      missedDates: Array.isArray(user.missed_dates) ? user.missed_dates : get().missedDates || [],
      playDate: user.play_date || get().playDate || localTodayIso(),
      journalDay:
        get().journalDay?.day === day ? get().journalDay : createEmptyJournalDay(day),
    };
    if (!preserveRun) {
      patch.xp = xp;
      patch.level = user.level ?? levelFromXp(xp);
    }
    if (user.tasks) patch.assignments = mapBackendTasks(user.tasks);
    if (user.exams) patch.exams = mapBackendExams(user.exams);
    set(patch);
  },

  applyWorldRecords: ({ tasks, exams, sessions } = {}) => {
    const patch = {};
    if (tasks) patch.assignments = mapBackendTasks(tasks);
    if (exams) patch.exams = mapBackendExams(exams);
    if (sessions) {
      patch.lifetimeScore = sessions
        .filter((session) => session && session.completed)
        .reduce((sum, session) => sum + Number(session.score_earned || 0), 0);
    }
    if (Object.keys(patch).length) set(patch);
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
      throw new Error("Please register or sign in before starting a campus run.");
    }

    useRunnerStore.getState().resetRun();
    get().applyUserProgress(user);
    const day = get().day;
    const playDate = get().playDate || localTodayIso();

    const res = await startDailySession({
      userId: user.id,
      date: `${playDate}T00:00:00`,
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

    const startXp = get().xp;
    const startLevel = get().level;
    set({
      phase: PHASES.RUNNING,
      paused: false,
      restarting: false,
      restartError: null,
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
      journalDate: playDate,
      finishLineZ: null,
      objectiveText: "Continue your campus run",
      runStartXp: startXp,
      runStartLevel: startLevel,
      newBadges: [],
      score: 0,
      lives: MAX_LIVES,
      combo: 0,
      exhausted: false,
      hitFlashAt: 0,
      ...xpPatch(get(), startXp + XP_RULES.GAME_START, { floatingTexts: [], leveledUpTo: null }),
    });
    try {
      const world = await loadUserWorld(user.id);
      get().applyWorldRecords(world);
    } catch {
      // Keep local records if the world fetch fails.
    }
  },

  takeHit: () => {
    const runner = useRunnerStore.getState();
    const now = performance.now();
    if (get().paused) return;
    if (runner.invincibleUntil > now || runner.isStumbling) return;
    if (get().phase === PHASES.DAY_CELEBRATION || get().phase === PHASES.DAILY_COMPLETION) return;

    const lives = Math.max(0, get().lives - 1);
    const exhausted = lives === 0;
    const floaters = pushFloater(get().floatingTexts, {
      id: now,
      kind: "hit",
      text: exhausted ? "LATE TO CLASS" : "−1 LIFE",
      sub: `−${XP_RULES.HIT_PENALTY} XP`,
    });
    set({
      lives,
      exhausted,
      combo: 0,
      score: Math.max(0, get().score - 80),
      hitFlashAt: now,
      ...xpPatch(get(), get().xp - XP_RULES.HIT_PENALTY, { floatingTexts: floaters }),
    });
    runner.beginStumble(now);
  },

  registerNearMiss: () => {
    const combo = get().combo + 1;
    const now = performance.now();
    const bonus = 15 + combo * 8;
    set({
      combo,
      score: get().score + bonus,
      floatingTexts: pushFloater(get().floatingTexts, {
        id: now,
        kind: "combo",
        text: combo >= 3 ? `${combo} COMBO` : "NICE!",
        sub: combo >= 5 ? "CAMPUS RUSH" : `+${bonus}`,
      }),
    });
  },

  collectPickup: () => {
    const combo = get().combo + 1;
    const now = performance.now();
    const floaters = pushFloater(get().floatingTexts, {
      id: now,
      kind: "pickup",
      text: `+${XP_RULES.PICKUP} XP`,
      sub: combo >= 2 ? `Combo ×${combo}` : "Collected",
    });
    set({
      combo,
      score: get().score + 50,
      ...xpPatch(get(), get().xp + XP_RULES.PICKUP, { floatingTexts: floaters }),
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
          currentStreak: res.current_streak ?? get().currentStreak,
          longestStreak: res.longest_streak ?? get().longestStreak,
          badges: res.badges ?? get().badges,
          newBadges: res.new_badges || get().newBadges || [],
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
      get().beginFinishRun();
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
    whenUnpaused(get, () => {
      const targetLocation = activeQuestion.targetLocation ?? getBuildingById("library")?.id;
      get().beginBuildingVisit(targetLocation);
    }, 400);
  },

  confirmAnswer: async (answerValue) => {
    const { activeQuestion, journalDay } = get();
    if (!activeQuestion) return;

    const now = performance.now();
    const floaters = pushFloater(get().floatingTexts, {
      id: now,
      kind: "answer",
      text: "+120",
      sub: "Answered",
    });
    set({
      phase: PHASES.ANSWER_CONFIRMED,
      pendingAnswer: answerValue,
      journalDay: recordResponse(journalDay, activeQuestion, answerValue, "lane"),
      score: get().score + 120,
      ...xpPatch(get(), get().xp + XP_RULES.ANSWER, { floatingTexts: floaters }),
    });

    const escalates = shouldEscalateToSpecialEntry(activeQuestion, answerValue);
    const needsInteraction = activeQuestion.requiresSpecialInteraction || escalates;
    if (!needsInteraction) {
      await get().ingestBackendAnswer(answerValue);
      const todayKey = localTodayIso();
      const declined =
        answerValue === "Not yet" || answerValue === "Waiting on the lecturer";
      if (declined && activeQuestion.context?.field === "exam-mark-check") {
        const ids = new Set((activeQuestion.context?.missingExams || []).map((exam) => exam.id));
        set({
          exams: get().exams.map((exam) =>
            ids.has(exam.id) ? { ...exam, lastMarkCheckDate: todayKey } : exam
          ),
        });
      }
      if (declined && activeQuestion.context?.field === "mark-check") {
        const subject = activeQuestion.context?.subject || activeQuestion.subject;
        const options = activeQuestion.context?.subjectOptions || [];
        set({
          assignments: get().assignments.map((item) =>
            item.id === activeQuestion.context?.assignmentId ||
            item.subject === subject ||
            options.includes(item.subject)
              ? { ...item, lastMarkCheckDate: todayKey }
              : item
          ),
        });
      }
    }

    whenUnpaused(get, () => get().evaluateDataRequirement(), 900);
  },

  evaluateDataRequirement: () => {
    const { activeQuestion, pendingAnswer } = get();
    set({ phase: PHASES.CHECKING_DATA_REQUIREMENT });

    const escalates = shouldEscalateToSpecialEntry(activeQuestion, pendingAnswer);
    const needsInteraction = activeQuestion.requiresSpecialInteraction || escalates;

    whenUnpaused(get, () => {
      if (needsInteraction) {
        const targetLocation =
          activeQuestion.targetLocation ?? getBuildingById("library")?.id;
        get().beginBuildingVisit(targetLocation);
      } else {
        get().advanceQuestionQueue();
      }
    }, 400);
  },

  beginBuildingVisit: (targetLocation) => {
    const runner = useRunnerStore.getState();
    const pauseZ = runner.posZ;
    runner.snapshotCampus();
    const building = getBuildingById(targetLocation);
    set({
      phase: PHASES.TRANSITION_TO_BUILDING,
      targetBuildingId: targetLocation,
      transitionEntryZ: pauseZ,
      objectiveText: building ? `Head to the ${building.name}` : "Head to the building",
    });
  },

  buildingTransitionComplete: () => set({ phase: PHASES.ENTERING_BUILDING }),

  buildingEntered: () => {
    const { activeQuestion, targetBuildingId } = get();
    const label = missionLabel(activeQuestion, targetBuildingId);
    set({
      phase: PHASES.SPECIAL_INTERACTION_READY,
      objectiveText: `Walk to the ${label.toLowerCase()}`,
    });
  },

  startSpecialInteraction: () => {
    if (document.pointerLockElement) document.exitPointerLock();
    useRunnerStore.getState().setLookLocked(false);
    set({ phase: PHASES.SPECIAL_INTERACTION_ACTIVE });
  },

  tryStartMission: () => {
    const { phase } = get();
    if (phase !== PHASES.SPECIAL_INTERACTION_READY) return;
    if (!useRunnerStore.getState().nearMission) return;
    get().startSpecialInteraction();
  },

  completeSpecialInteraction: async (result) => {
    const { activeQuestion, journalDay, assignments, exams } = get();
    let updatedAssignments = assignments;
    let updatedExams = exams;
    const field = activeQuestion?.context?.field;
    const todayKey = localTodayIso();
    const deadlineFields = field === "deadline" || field === "deadline-check";
    const subject = activeQuestion?.context?.subject || activeQuestion?.subject;
    const assignmentId = activeQuestion?.context?.assignmentId;

    if (deadlineFields && result.value) {
      updatedAssignments = assignments.map((item) => {
        const matches = assignmentId ? item.id === assignmentId : item.subject === subject;
        return matches
          ? { ...item, deadline: result.value, status: ASSIGNMENT_STATUS.DEADLINE_RECORDED }
          : item;
      });
    } else if (activeQuestion?.interactionType === "marks" && (assignmentId || (field === "mark-check" && subject))) {
      updatedAssignments = assignments.map((item) => {
        const matches = assignmentId ? item.id === assignmentId : item.subject === subject;
        return matches
          ? {
              ...item,
              mark: result.value,
              status: ASSIGNMENT_STATUS.MARK_RECEIVED,
              lastMarkCheckDate: todayKey,
            }
          : item;
      });
    }

    if ((field === "examDates" || field === "exam-dates-check") && result.value) {
      updatedExams = exams.map((item) =>
        result.value[item.id]
          ? { ...item, date: result.value[item.id], status: EXAM_STATUS.DATE_RECORDED }
          : item
      );
    }

    if ((field === "examMark" || field === "exam-mark-check") && result.value != null) {
      const examId = activeQuestion?.context?.missingExams?.[0]?.id;
      updatedExams = exams.map((item) =>
        item.id === examId || (!examId && item.subject === subject)
          ? {
              ...item,
              mark: result.value,
              status: EXAM_STATUS.MARK_RECEIVED,
              lastMarkCheckDate: todayKey,
            }
          : item
      );
    }

    set({
      phase: PHASES.SPECIAL_INTERACTION_COMPLETED,
      assignments: updatedAssignments,
      exams: updatedExams,
      journalDay: recordInteraction(journalDay, activeQuestion, result),
      score: get().score + 300,
      ...xpPatch(get(), get().xp + XP_RULES.INTERACTION, {}),
    });

    await get().ingestBackendAnswer(result.value);
    whenUnpaused(get, () => set({ phase: PHASES.RETURNING_TO_CAMPUS }), 1600);
  },

  returnTransitionComplete: () => {
    set({ phase: PHASES.RUNNING_RESUMED, targetBuildingId: null, objectiveText: "Continue your campus run" });
    whenUnpaused(get, () => get().advanceQuestionQueue(), 300);
  },

  advanceQuestionQueue: () => {
    const nextIndex = get().questionIndex + 1;
    const done = get().sessionCompleted || nextIndex >= get().questionQueue.length;
    set({
      questionIndex: nextIndex,
      activeQuestion: null,
      pendingAnswer: null,
      phase: done ? get().phase : PHASES.RUNNING,
    });
    if (done) get().beginFinishRun();
  },

  beginFinishRun: () => {
    const { phase } = get();
    if (
      phase === PHASES.APPROACHING_FINISH ||
      phase === PHASES.DAY_CELEBRATION ||
      phase === PHASES.DAILY_COMPLETION
    ) {
      return;
    }
    const z = useRunnerStore.getState().posZ + 52;
    set({
      phase: PHASES.APPROACHING_FINISH,
      activeQuestion: null,
      pendingAnswer: null,
      finishLineZ: z,
      objectiveText: "The tape is ahead — keep running",
    });
  },

  crossFinishLine: () => {
    if (get().phase !== PHASES.APPROACHING_FINISH) return;
    useRunnerStore.getState().pulseShake(0.85);
    set({
      phase: PHASES.DAY_CELEBRATION,
      objectiveText: "That's the day.",
      floatingTexts: pushFloater(get().floatingTexts, {
        id: performance.now(),
        kind: "save",
        text: "FINISH",
        sub: "Tape broken",
      }),
    });
    setTimeout(() => get().finishDailyGame(), 3400);
  },

  finishDailyGame: async () => {
    if (get().phase === PHASES.DAILY_COMPLETION) return;
    const {
      journalDay,
      xp,
      score,
      day,
      level,
      sessionId,
      runStartXp,
      backendJournalEntry,
      backendJournalHighlights,
    } = get();
    const previousLevel = level;
    const playedDay = day;
    const savedJournalDate = get().journalDate || get().playDate || localTodayIso();
    const finalXp = xp + XP_RULES.DAILY_COMPLETE;
    const completedDay = completeJournalDay(journalDay, finalXp, score);
    const sessionXp = Math.max(0, finalXp - (runStartXp ?? 0));
    let synced = {
      phase: PHASES.DAILY_COMPLETION,
      dailyCompleted: true,
      journalDay: completedDay,
      objectiveText: "Daily journal complete",
      ...xpPatch(get(), finalXp, {}),
    };
    if (synced.level > previousLevel) synced.leveledUpTo = synced.level;
    set(synced);

    try {
      if (sessionId) {
        const data = await finishDailyRun({ sessionId, xpEarned: sessionXp, score });
        const persistedXp = data.total_xp ?? finalXp;
        const next = {
          ...xpPatch({ ...get() }, persistedXp, {}),
          currentStreak: data.current_streak ?? get().currentStreak,
          longestStreak: data.longest_streak ?? get().longestStreak,
          badges: data.badges ?? get().badges,
          newBadges: [...(get().newBadges || []), ...(data.new_badges || [])].filter(
            (item, index, list) => list.indexOf(item) === index
          ),
          day: data.current_day ?? day,
          dailyCompleted: data.daily_completed ?? true,
          missedDates: Array.isArray(data.missed_dates) ? data.missed_dates : get().missedDates,
          playDate: data.play_date ?? get().playDate,
          lifetimeScore: (get().lifetimeScore || 0) + score,
        };
        if (next.level > previousLevel) next.leveledUpTo = next.level;
        set(next);
        synced = { ...synced, ...next };
        const stored = readStoredUser();
        if (stored) {
          storeUser({
            ...stored,
            total_xp: data.total_xp ?? persistedXp,
            level: data.level ?? levelFromXp(persistedXp),
            current_streak: data.current_streak ?? stored.current_streak,
            longest_streak: data.longest_streak ?? stored.longest_streak,
            badges: data.badges ?? stored.badges,
            current_day: data.current_day ?? stored.current_day,
            daily_completed: data.daily_completed ?? stored.daily_completed,
            missed_dates: data.missed_dates ?? stored.missed_dates,
            play_date: data.play_date ?? stored.play_date,
          });
        }
      }
    } catch {
      // Keep the local XP and level so the completion screen still feels earned.
    }

    useJournalHistoryStore.getState().addEntry({
      day: playedDay,
      date: savedJournalDate,
      journalDay: completedDay,
      journalEntry: backendJournalEntry,
      highlights: backendJournalHighlights || [],
      xp: sessionXp,
      score,
      level: synced.level,
      completedAt: `${savedJournalDate}T00:00:00`,
    });
  },

  startNextDay: () => {
    set({
      phase: PHASES.GAME_START,
      paused: false,
      restarting: false,
      restartError: null,
      sessionId: null,
      sessionCompleted: false,
      backendJournalEntry: null,
      backendJournalHighlights: [],
      questionQueue: [],
      questionIndex: 0,
      activeQuestion: null,
      pendingAnswer: null,
      lives: MAX_LIVES,
      combo: 0,
      exhausted: false,
      hitFlashAt: 0,
      floatingTexts: [],
      finishLineZ: null,
    });
  },

  discardTodayJournal: async (date) => {
    const user = readStoredUser();
    if (!user?.id) {
      throw new Error("Please sign in to delete this journal.");
    }
    const target =
      campusDateKey(date) || get().journalDate || get().playDate || localTodayIso();
    const data = await deleteTodayJournal(user.id, target);
    storeUser(data);
    get().applyUserProgress(data);
    get().applyWorldRecords({ tasks: data.tasks, exams: data.exams, sessions: data.sessions });
    useJournalHistoryStore.getState().hydrateFromSessions(data.sessions || [], data.id);
    useRunnerStore.getState().resetRun();
    const day = Math.max(1, data.current_day || get().day);
    set({
      phase: PHASES.GAME_START,
      paused: Boolean(get().restarting),
      restarting: get().restarting,
      restartError: null,
      sessionId: null,
      sessionCompleted: false,
      backendJournalEntry: null,
      backendJournalHighlights: [],
      questionQueue: [],
      questionIndex: 0,
      activeQuestion: null,
      pendingAnswer: null,
      dailyCompleted: Boolean(data.daily_completed),
      missedDates: Array.isArray(data.missed_dates) ? data.missed_dates : [],
      playDate: data.play_date || localTodayIso(),
      journalDate: null,
      finishLineZ: null,
      journalDay: createEmptyJournalDay(day),
      newBadges: [],
      leveledUpTo: null,
      score: 0,
      lives: MAX_LIVES,
      combo: 0,
      exhausted: false,
      hitFlashAt: 0,
      floatingTexts: [],
      objectiveText: "Start today's campus run",
    });
    return data;
  },

  dismissControlHints: () => set({ showControlHints: false }),

  pause: () => {
    const { phase, paused, restarting } = get();
    if (paused || restarting || !isPausablePhase(phase)) return;
    if (document.pointerLockElement) document.exitPointerLock();
    useRunnerStore.getState().setLookLocked(false);
    useRunnerStore.getState().setExploreInput(0, 0);
    set({ paused: true, restartError: null });
  },

  resume: () => {
    if (get().restarting) return;
    set({ paused: false, restartError: null });
  },

  togglePause: () => {
    if (get().paused) get().resume();
    else get().pause();
  },

  restartRun: async () => {
    if (get().restarting) return;
    const {
      selectedActivities,
      lectureSubjects,
      assignmentSubjects,
      examSubjects,
      examKinds,
      sessionCompleted,
      runStartXp,
    } = get();
    const startXp = Math.max(0, runStartXp ?? get().xp);
    set({ restarting: true, restartError: null, paused: true });
    try {
      if (sessionCompleted) {
        await get().discardTodayJournal();
      }
      set({
        xp: startXp,
        level: levelFromXp(startXp),
      });
      await get().startDailyGame({
        activities: selectedActivities,
        lectureSubjects,
        assignmentSubjects,
        examSubjects,
        examKinds,
      });
    } catch (err) {
      set({
        paused: true,
        restarting: false,
        restartError: apiErrorMessage(err, "Could not restart this run. Try again."),
      });
    }
  },

  setSpeed: (speed) => set({ speed }),

  dailyProgress: () => {
    const { questionQueue, questionIndex, dailyCompleted, sessionCompleted, phase } = get();
    if (
      dailyCompleted ||
      sessionCompleted ||
      phase === PHASES.APPROACHING_FINISH ||
      phase === PHASES.DAY_CELEBRATION
    ) {
      return 1;
    }
    if (questionQueue.length === 0) return 0;
    return Math.min(1, questionIndex / Math.max(questionQueue.length, 1));
  },
}));
