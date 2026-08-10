import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameScene from '../../components/student-journaling/game/GameScene';
import GameHUD from '../../components/student-journaling/game/GameHUD';
import GameControls from '../../components/student-journaling/game/GameControls';
import MapTransition from '../../components/student-journaling/game/MapTransition';
import CollectBurst from '../../components/student-journaling/game/CollectBurst';
import InPathQuestionBanner, { AnswerRecordedToast } from '../../components/student-journaling/game/InPathQuestionBanner';
import InGameInput from '../../components/student-journaling/game/InGameInput';
import useGameSession from '../../hooks/useGameSession';
import useGameSound from '../../hooks/useGameSound';
import useRunnerControls from '../../hooks/useRunnerControls';
import { generateMissionGates } from '../../constants/missionQuestions';
import { buildDemoCompletion, isDemoUser } from '../../constants/demoMode';
import { submitCheckpointAnswer } from '../../services/gameApi';
import { padOptions } from '../../utils/questionGates';
import {
  LANE_COUNT,
  MIN_COLLECTIBLES_FOR_CHECKPOINT,
  QUESTIONS_PER_MISSION,
} from '../../constants/gameMaps';

export default function GamePage({
  maps,
  missions = [],
  session: initialSession,
  userId,
  onAdventureComplete,
  onMissionComplete,
  onExit,
}) {
  const {
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
    clearRecordedAnswer,
    endMissionPause,
    nextMap,
    setCompletion,
  } = useGameSession();

  const sound = useGameSound(true);
  const [showMissionComplete, setShowMissionComplete] = useState(false);
  const [bursts, setBursts] = useState([]);
  const [playerZ, setPlayerZ] = useState(0);
  const sessionRef = useRef(initialSession);
  const backendCompletionRef = useRef(null);
  const [inputGate, setInputGate] = useState(null);
  const [dynamicQuestions, setDynamicQuestions] = useState([]);

  const controlsDisabled = state.missionComplete || state.adventureComplete || !!inputGate;

  const {
    laneIndexRef,
    jumpQueuedRef,
    moveLeft,
    moveRight,
    jump,
    bindKeyboard,
    resetLane,
  } = useRunnerControls({
    disabled: controlsDisabled,
    onMoveLeft: () => sound.playLane(),
    onMoveRight: () => sound.playLane(),
    onJump: () => sound.playJump(),
  });

  const gates = useMemo(() => {
    const base = generateMissionGates(currentMap?.id);
    return base.map((g, i) => {
      const dq = dynamicQuestions[i];
      if (dq) {
        return {
          ...g,
          question: dq.question,
          options: padOptions(dq.options),
          question_type: dq.question_type || 'lane',
        };
      }
      return { ...g, options: padOptions(g.options), question_type: 'lane' };
    });
  }, [currentMap?.id, dynamicQuestions]);

  useEffect(() => {
    sessionRef.current = initialSession;
    if (initialSession?.question && initialSession?.session_id !== 'demo-session') {
      setDynamicQuestions([{
        question: initialSession.question,
        options: initialSession.options,
        question_type: initialSession.question_type || 'lane',
      }]);
    } else {
      setDynamicQuestions([]);
    }
  }, [initialSession, currentMap?.id]);

  useEffect(() => {
    if (maps?.length) {
      initSession(maps, initialSession, missions);
    }
  }, [maps, initialSession, missions, initSession]);

  useEffect(() => {
    sound.unlock();
  }, [sound]);

  useEffect(() => {
    return bindKeyboard(() => controlsDisabled);
  }, [bindKeyboard, controlsDisabled]);

  useEffect(() => {
    if (state.missionComplete && !showMissionComplete) {
      sound.playCheckpoint();
      setShowMissionComplete(true);
    }
  }, [state.missionComplete, showMissionComplete, sound]);

  useEffect(() => {
    if (state.lastRecordedAnswer) {
      sound.playCollect();
    }
  }, [state.lastRecordedAnswer, sound]);

  const handleTick = useCallback((distance, z) => {
    setDistance(distance);
    setPlayerZ(z);
  }, [setDistance]);

  const handleCollect = useCallback((type, color) => {
    sound.playCollect();
    const x = `${35 + Math.random() * 30}%`;
    const y = `${25 + Math.random() * 25}%`;
    collectItem(type, 10, { x, y });
    setBursts((b) => [...b, { id: Date.now() + Math.random(), x, y, color }]);
  }, [collectItem, sound]);

  const handleHit = useCallback(() => {
    sound.playHit();
    hitObstacle();
  }, [hitObstacle, sound]);

  const submitGateAnswer = useCallback(async (gate, answer, selectedLane) => {
    resolveGate(gate.id, selectedLane, gate);

    const session = sessionRef.current;
    const useBackend = session?.session_id && session.session_id !== 'demo-session' && !isDemoUser(userId);

    if (!useBackend) return;

    try {
      const response = await submitCheckpointAnswer({
        sessionId: session.session_id,
        answer,
      });
      sessionRef.current = { ...session, ...response };

      if (response.completed) {
        backendCompletionRef.current = response;
        return;
      }

      if (response.question) {
        setDynamicQuestions((prev) => {
          const next = [...prev];
          next[state.questionsResolved] = {
            question: response.question,
            options: response.options,
            question_type: response.question_type || 'lane',
          };
          return next;
        });
      }
    } catch (_err) {
      /* offline — local answers still saved */
    }
  }, [resolveGate, userId, state.questionsResolved]);

  const handleResolveGate = useCallback((gateId, selectedLane, gate) => {
    if (gate.question_type && gate.question_type !== 'lane') {
      setInputGate(gate);
      return;
    }
    submitGateAnswer(gate, gate.options[selectedLane], selectedLane);
  }, [submitGateAnswer]);

  const handleInputSubmit = useCallback((gate, value) => {
    setInputGate(null);
    submitGateAnswer(gate, value, 0);
  }, [submitGateAnswer]);

  const removeBurst = useCallback((id) => {
    setBursts((b) => b.filter((x) => x.id !== id));
  }, []);

  const isLastMission = state.currentMapIndex >= state.maps.length - 1;

  const handleMissionContinue = () => {
    setShowMissionComplete(false);
    endMissionPause();

    const missionResult = {
      mapIndex: state.currentMapIndex,
      map: currentMap,
      mission: currentMission,
      sessionXp: state.sessionXp,
      collectedCount,
      questionsAnswered: state.questionsResolved,
      penalties: state.penalties,
      answers: state.answers,
    };

    onMissionComplete?.(missionResult);

    if (isLastMission) {
      const backendDone = backendCompletionRef.current;
      const completion = backendDone?.completed
        ? backendDone
        : buildDemoCompletion(state.maps, state.answers, state.sessionXp, initialSession);
      sound.playComplete();
      setCompletion(completion);
      onAdventureComplete?.(completion);
      return;
    }

    nextMap();
    resetLane(1);
    setDynamicQuestions([]);
    backendCompletionRef.current = null;
  };

  const nextGate = gates.find((g) => !state.resolvedGateIds.includes(g.id));
  const gateDistance = nextGate ? Math.abs(playerZ - nextGate.z) : null;

  const questionsRemaining = QUESTIONS_PER_MISSION - state.questionsResolved;
  const collectRemaining = Math.max(0, MIN_COLLECTIBLES_FOR_CHECKPOINT - collectedCount);
  const isInvincible = state.invincibleUntil > Date.now();

  if (!currentMap) {
    return (
      <div className="min-h-screen game-bg flex items-center justify-center">
        <p className="text-violet-300 animate-pulse">Loading adventure...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden game-bg">
      <GameScene
        mapDef={currentMap}
        gameState={{
          ...state,
          haltMovement: state.missionComplete || state.adventureComplete,
          slowCamera: state.isPaused || state.missionComplete,
        }}
        laneIndexRef={laneIndexRef}
        jumpQueuedRef={jumpQueuedRef}
        onTick={handleTick}
        onCollect={handleCollect}
        onHit={handleHit}
        onResolveGate={handleResolveGate}
        customGates={gates}
      />

      <InGameInput
        gate={inputGate}
        visible={!!inputGate}
        onSubmit={handleInputSubmit}
        onCancel={() => setInputGate(null)}
      />

      <CollectBurst bursts={bursts} onDone={removeBurst} />

      <InPathQuestionBanner
        gate={nextGate}
        distance={gateDistance}
        resolved={!nextGate}
      />

      <AnimatePresence>
        {state.lastRecordedAnswer && (
          <AnswerRecordedToast answer={state.lastRecordedAnswer} onDone={clearRecordedAnswer} />
        )}
      </AnimatePresence>

      {isInvincible && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-5 border-4 border-rose-500/30"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        />
      )}

      {!state.missionComplete && questionsRemaining > 0 && (
        <div className="absolute top-16 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <span className="game-badge text-[10px]">
            🎯 {questionsRemaining} question{questionsRemaining > 1 ? 's' : ''} ahead — pick a lane to answer
          </span>
        </div>
      )}

      {!state.missionComplete && questionsRemaining === 0 && collectRemaining > 0 && (
        <div className="absolute top-16 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <span className="game-badge text-[10px]">
            Collect {collectRemaining} more {currentMap.collectibleLabel} to reach mission goal
          </span>
        </div>
      )}

      {!state.missionComplete && questionsRemaining === 0 && collectRemaining === 0 && progress < 100 && (
        <div className="absolute top-16 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <span className="game-badge text-[10px]">🏁 Run to the Mission Goal!</span>
        </div>
      )}

      <GameHUD
        health={state.health}
        sessionXp={state.sessionXp}
        collectibles={state.collectibles}
        mapName={currentMap.name}
        missionName={currentMission?.name}
        progress={progress}
        missionProgress={missionProgress}
        questionsResolved={state.questionsResolved}
        questionsTotal={QUESTIONS_PER_MISSION}
        penalties={state.penalties}
        collectibleLabel={currentMap.collectibleLabel}
        collectibleEmoji={currentMap.collectibleEmoji}
        floatingXp={state.floatingXp}
        onFloatingXpDone={removeFloatingXp}
      />

      <GameControls
        onLeft={moveLeft}
        onRight={moveRight}
        onJump={jump}
        disabled={controlsDisabled}
      />

      <MapTransition
        map={currentMap}
        mission={currentMission}
        visible={showMissionComplete}
        stats={{
          sessionXp: state.sessionXp,
          collectedCount,
          questionsAnswered: state.questionsResolved,
          totalQuestions: QUESTIONS_PER_MISSION,
          penalties: state.penalties,
        }}
        isLastMission={isLastMission}
        onContinue={handleMissionContinue}
      />

      <button
        type="button"
        onClick={onExit}
        className="absolute top-4 right-4 z-20 game-panel px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white pointer-events-auto"
      >
        Exit
      </button>
    </div>
  );
}
