import { useCallback, useReducer } from 'react';
import {
  MAP_COMPLETE_DISTANCE,
  MIN_COLLECTIBLES_FOR_CHECKPOINT,
  QUESTIONS_PER_MISSION,
  CORRECT_ANSWER_XP,
  WRONG_ANSWER_XP_PENALTY,
} from '../constants/gameMaps';

const initialState = {
  maps: [],
  missions: [],
  currentMapIndex: 0,
  distance: 0,
  health: 3,
  invincibleUntil: 0,
  sessionXp: 0,
  collectibles: {},
  isPaused: false,
  missionComplete: false,
  adventureComplete: false,
  floatingXp: [],
  session: null,
  completionResult: null,
  // Mission / in-path question state
  resolvedGateIds: [],
  answers: [],
  questionsResolved: 0,
  penalties: 0,
  lastGateResult: null,
  correctAnswers: 0,
};

function totalCollected(collectibles) {
  return Object.values(collectibles).reduce((a, b) => a + b, 0);
}

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return {
        ...initialState,
        maps: action.maps,
        missions: action.missions || [],
        session: action.session || null,
      };

    case 'SET_DISTANCE':
      return { ...state, distance: action.distance };

    case 'COLLECT': {
      const key = action.collectibleType;
      const count = (state.collectibles[key] || 0) + 1;
      const floatingXp = [
        ...state.floatingXp,
        { id: Date.now() + Math.random(), value: action.xp || 10, x: action.x, y: action.y },
      ];
      return {
        ...state,
        collectibles: { ...state.collectibles, [key]: count },
        sessionXp: state.sessionXp + (action.xp || 10),
        floatingXp,
      };
    }

    case 'REMOVE_FLOATING_XP':
      return { ...state, floatingXp: state.floatingXp.filter((f) => f.id !== action.id) };

    case 'HIT': {
      if (state.invincibleUntil > Date.now()) return state;
      return {
        ...state,
        health: Math.max(0, state.health - 1),
        sessionXp: Math.max(0, state.sessionXp - 5),
        penalties: state.penalties + 1,
        invincibleUntil: Date.now() + 1800,
      };
    }

    case 'RESOLVE_GATE': {
      const { gateId, laneIndex, gate } = action;
      if (state.resolvedGateIds.includes(gateId)) return state;

      const correct = laneIndex === gate.correctLane;
      const selectedAnswer = gate.options[laneIndex];
      const answers = [
        ...state.answers,
        { question: gate.question, answer: selectedAnswer, correct, gateId },
      ];

      return {
        ...state,
        answers,
        questionsResolved: state.questionsResolved + 1,
        resolvedGateIds: [...state.resolvedGateIds, gateId],
        sessionXp: correct
          ? state.sessionXp + CORRECT_ANSWER_XP
          : Math.max(0, state.sessionXp - WRONG_ANSWER_XP_PENALTY),
        health: correct ? state.health : Math.max(0, state.health - 1),
        penalties: correct ? state.penalties : state.penalties + 1,
        correctAnswers: correct ? state.correctAnswers + 1 : state.correctAnswers,
        lastGateResult: correct ? 'correct' : 'wrong',
        invincibleUntil: correct ? state.invincibleUntil : Date.now() + 1200,
      };
    }

    case 'CLEAR_GATE_RESULT':
      return { ...state, lastGateResult: null };

    case 'CHECK_PROGRESS': {
      const collected = totalCollected(state.collectibles);
      const reachedGoal = state.distance >= MAP_COMPLETE_DISTANCE;
      const allQuestions = state.questionsResolved >= QUESTIONS_PER_MISSION;
      const enoughItems = collected >= MIN_COLLECTIBLES_FOR_CHECKPOINT;

      if (reachedGoal && allQuestions && enoughItems && !state.missionComplete) {
        return { ...state, missionComplete: true, isPaused: true };
      }
      return state;
    }

    case 'END_MISSION_PAUSE':
      return { ...state, isPaused: false };

    case 'NEXT_MAP': {
      const nextIndex = state.currentMapIndex + 1;
      if (nextIndex >= state.maps.length) {
        return {
          ...state,
          adventureComplete: true,
          isPaused: true,
          missionComplete: false,
        };
      }
      return {
        ...state,
        currentMapIndex: nextIndex,
        distance: 0,
        collectibles: {},
        missionComplete: false,
        isPaused: false,
        health: 3,
        invincibleUntil: 0,
        resolvedGateIds: [],
        answers: [],
        questionsResolved: 0,
        penalties: 0,
        lastGateResult: null,
        correctAnswers: 0,
      };
    }

    case 'SET_SESSION':
      return { ...state, session: action.session };

    case 'SET_COMPLETION':
      return { ...state, completionResult: action.result, adventureComplete: true, isPaused: true };

    default:
      return state;
  }
}

export default function useGameSession() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const initSession = useCallback((maps, session, missions = []) => {
    dispatch({ type: 'INIT', maps, session, missions });
  }, []);

  const setDistance = useCallback((distance) => {
    dispatch({ type: 'SET_DISTANCE', distance });
    dispatch({ type: 'CHECK_PROGRESS' });
  }, []);

  const collectItem = useCallback((collectibleType, xp, screenPos) => {
    dispatch({ type: 'COLLECT', collectibleType, xp, ...screenPos });
  }, []);

  const removeFloatingXp = useCallback((id) => {
    dispatch({ type: 'REMOVE_FLOATING_XP', id });
  }, []);

  const hitObstacle = useCallback(() => dispatch({ type: 'HIT' }), []);

  const resolveGate = useCallback((gateId, laneIndex, gate) => {
    dispatch({ type: 'RESOLVE_GATE', gateId, laneIndex, gate });
  }, []);

  const clearGateResult = useCallback(() => dispatch({ type: 'CLEAR_GATE_RESULT' }), []);

  const endMissionPause = useCallback(() => dispatch({ type: 'END_MISSION_PAUSE' }), []);

  const nextMap = useCallback(() => dispatch({ type: 'NEXT_MAP' }), []);

  const setSession = useCallback((session) => dispatch({ type: 'SET_SESSION', session }), []);

  const setCompletion = useCallback((result) => dispatch({ type: 'SET_COMPLETION', result }), []);

  const currentMap = state.maps[state.currentMapIndex] || null;
  const currentMission = state.missions[state.currentMapIndex] || null;
  const progress = Math.min(100, (state.distance / MAP_COMPLETE_DISTANCE) * 100);
  const collectedCount = totalCollected(state.collectibles);
  const missionProgress = Math.round(
    ((state.questionsResolved / QUESTIONS_PER_MISSION) * 0.6
      + (state.distance / MAP_COMPLETE_DISTANCE) * 0.4) * 100,
  );

  return {
    state,
    currentMap,
    currentMission,
    progress,
    missionProgress,
    collectedCount,
    initSession,
    setDistance,
    collectItem,
    removeFloatingXp,
    hitObstacle,
    resolveGate,
    clearGateResult,
    endMissionPause,
    nextMap,
    setSession,
    setCompletion,
  };
}

export { totalCollected };
