import { useCallback, useReducer, useRef } from 'react';
import { MAP_COMPLETE_DISTANCE, MIN_COLLECTIBLES_FOR_CHECKPOINT } from '../constants/gameMaps';

const initialState = {
  maps: [],
  currentMapIndex: 0,
  distance: 0,
  health: 3,
  invincibleUntil: 0,
  sessionXp: 0,
  collectibles: {},
  isPaused: false,
  isCheckpoint: false,
  isBossEncounter: false,
  bossDefeated: false,
  mapComplete: false,
  adventureComplete: false,
  floatingXp: [],
  session: null,
  completionResult: null,
  checkpointActivated: false,
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
        invincibleUntil: Date.now() + 1800,
      };
    }

    case 'CHECK_PROGRESS': {
      const collected = totalCollected(state.collectibles);
      const reachedEnd = state.distance >= MAP_COMPLETE_DISTANCE;
      const enoughItems = collected >= MIN_COLLECTIBLES_FOR_CHECKPOINT;

      // Boss/checkpoint ONLY after running AND collecting — no mid-run questionnaire
      if (reachedEnd && enoughItems && !state.mapComplete) {
        return {
          ...state,
          mapComplete: true,
          isBossEncounter: true,
          isCheckpoint: true,
          isPaused: true,
          checkpointActivated: true,
        };
      }
      return state;
    }

    case 'END_CHECKPOINT':
      return { ...state, isCheckpoint: false, isPaused: false, checkpointActivated: false };

    case 'DEFEAT_BOSS':
      return { ...state, bossDefeated: true, isBossEncounter: false };

    case 'NEXT_MAP': {
      const nextIndex = state.currentMapIndex + 1;
      if (nextIndex >= state.maps.length) {
        return {
          ...state,
          adventureComplete: true,
          isPaused: true,
          mapComplete: false,
          bossDefeated: false,
        };
      }
      return {
        ...state,
        currentMapIndex: nextIndex,
        distance: 0,
        collectibles: {},
        mapComplete: false,
        bossDefeated: false,
        isPaused: false,
        isCheckpoint: false,
        isBossEncounter: false,
        checkpointActivated: false,
        health: 3,
        invincibleUntil: 0,
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

  const initSession = useCallback((maps, session) => {
    dispatch({ type: 'INIT', maps, session });
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
  const endCheckpoint = useCallback(() => dispatch({ type: 'END_CHECKPOINT' }), []);
  const defeatBoss = useCallback(() => dispatch({ type: 'DEFEAT_BOSS' }), []);
  const nextMap = useCallback(() => dispatch({ type: 'NEXT_MAP' }), []);
  const setSession = useCallback((session) => dispatch({ type: 'SET_SESSION', session }), []);
  const setCompletion = useCallback((result) => dispatch({ type: 'SET_COMPLETION', result }), []);

  const currentMap = state.maps[state.currentMapIndex] || null;
  const progress = Math.min(100, (state.distance / MAP_COMPLETE_DISTANCE) * 100);
  const collectedCount = totalCollected(state.collectibles);

  return {
    state,
    currentMap,
    progress,
    collectedCount,
    initSession,
    setDistance,
    collectItem,
    removeFloatingXp,
    hitObstacle,
    endCheckpoint,
    defeatBoss,
    nextMap,
    setSession,
    setCompletion,
  };
}

export { totalCollected };
