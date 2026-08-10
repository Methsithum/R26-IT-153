import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameScene from '../../components/student-journaling/game/GameScene';
import GameControls from '../../components/student-journaling/game/GameControls';
import InPathQuestionBanner, { AnswerRecordedToast } from '../../components/student-journaling/game/InPathQuestionBanner';
import InGameInput from '../../components/student-journaling/game/InGameInput';
import CollectBurst from '../../components/student-journaling/game/CollectBurst';
import { MAP_DEFINITIONS } from '../../constants/gameMaps';
import { isDemoUser } from '../../constants/demoMode';
import {
  getLocalFirstJourneyStatus,
  getLocalFirstJourneyProgress,
  answerLocalFirstJourney,
  resetLocalFirstJourney,
  FIRST_JOURNEY_STEPS,
} from '../../constants/firstJourneyLocal';
import {
  getFirstJourneyStatus,
  answerFirstJourney,
} from '../../services/firstJourneyApi';
import { buildGate } from '../../utils/questionGates';
import useGameSound from '../../hooks/useGameSound';
import useRunnerControls from '../../hooks/useRunnerControls';

const INTRO_MAP = { ...MAP_DEFINITIONS.knowledge_forest, name: 'First Journey' };
const GATE_AHEAD = 28;
const UI_TICK_MS = 250;

function FirstJourneyIntro({ progress, onStart, onExit }) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="game-panel max-w-lg w-full p-6 sm:p-8 rounded-3xl border-2 border-violet-500/40"
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
      >
        <p className="text-4xl text-center mb-3">🏃‍♂️</p>
        <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">Welcome to First Journey</h2>
        <p className="text-sm text-violet-300 text-center mb-5">
          Run through the path, collect gems, and answer {progress.total} profile questions by choosing a lane.
        </p>

        <div className="space-y-2 mb-6 text-xs text-slate-300">
          <div className="flex items-start gap-2 game-panel px-3 py-2 rounded-xl">
            <span>🎮</span>
            <span><strong className="text-white">← →</strong> or on-screen buttons to switch lanes</span>
          </div>
          <div className="flex items-start gap-2 game-panel px-3 py-2 rounded-xl">
            <span>❓</span>
            <span>At each gate, pick the lane that matches your answer</span>
          </div>
          <div className="flex items-start gap-2 game-panel px-3 py-2 rounded-xl">
            <span>⭐</span>
            <span>Grab collectibles along the way — no wrong answers, just your story</span>
          </div>
        </div>

        {progress.answered > 0 && (
          <p className="text-center text-xs text-amber-400 mb-4">
            Resuming — {progress.answered} of {progress.total} answered
          </p>
        )}

        <button type="button" className="game-btn-primary w-full py-3 rounded-xl mb-2" onClick={onStart}>
          Start Running →
        </button>
        <button type="button" className="w-full py-2 text-xs text-slate-400 hover:text-white" onClick={onExit}>
          Back to Dashboard
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function FirstJourneyPage({ userId, onComplete, onExit }) {
  const sound = useGameSound(true);
  const [playerZ, setPlayerZ] = useState(0);
  const playerZRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const [gates, setGates] = useState([]);
  const [resolvedIds, setResolvedIds] = useState([]);
  const [inputGate, setInputGate] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [collected, setCollected] = useState(0);
  const [bursts, setBursts] = useState([]);
  const [progress, setProgress] = useState({ answered: 0, total: FIRST_JOURNEY_STEPS.length, completed: false });

  const {
    laneIndexRef,
    jumpQueuedRef,
    moveLeft,
    moveRight,
    jump,
    bindKeyboard,
  } = useRunnerControls({
    disabled: !!inputGate || done || !started,
    onMoveLeft: () => sound.playLane(),
    onMoveRight: () => sound.playLane(),
    onJump: () => sound.playJump(),
  });

  const refreshProgress = useCallback(() => {
    if (isDemoUser(userId)) {
      setProgress(getLocalFirstJourneyProgress());
    } else {
      setProgress((p) => ({ ...p, total: FIRST_JOURNEY_STEPS.length }));
    }
  }, [userId]);

  const placeNextGate = useCallback((status, fromZ = 0) => {
    if (status.completed) {
      setDone(true);
      setGates([]);
      return;
    }
    const z = fromZ - GATE_AHEAD;
    const gate = buildGate({
      id: status.question_id,
      z,
      question: status.question,
      options: status.options,
      question_type: status.question_type || 'lane',
      question_id: status.question_id,
    });
    setGates([gate]);
    setResolvedIds([]);
  }, []);

  useEffect(() => {
    sound.unlock();
    let cancelled = false;
    (async () => {
      try {
        const status = isDemoUser(userId)
          ? getLocalFirstJourneyStatus()
          : await getFirstJourneyStatus(userId);
        if (cancelled) return;
        refreshProgress();
        if (status.completed) setDone(true);
      } catch {
        if (!cancelled) refreshProgress();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, refreshProgress, sound]);

  useEffect(() => bindKeyboard(() => !!inputGate || done || !started), [bindKeyboard, inputGate, done, started]);

  const handleStart = useCallback(async () => {
    setStarted(true);
    let status;
    if (isDemoUser(userId)) {
      status = getLocalFirstJourneyStatus();
    } else {
      try {
        status = await getFirstJourneyStatus(userId);
      } catch {
        status = getLocalFirstJourneyStatus();
      }
    }
    if (status.completed) {
      setDone(true);
      return;
    }
    placeNextGate(status, 0);
  }, [userId, placeNextGate]);

  const submitAnswer = useCallback(async (gate, answer) => {
    let status;
    try {
      if (isDemoUser(userId)) {
        status = answerLocalFirstJourney(gate.question_id || gate.id, answer);
      } else {
        status = await answerFirstJourney(userId, gate.question_id || gate.id, answer);
      }
    } catch {
      status = answerLocalFirstJourney(gate.question_id || gate.id, answer);
    }

    refreshProgress();
    setLastAnswer(answer);
    setResolvedIds((prev) => [...prev, gate.id]);
    sound.playCollect();

    if (status.completed) {
      setTimeout(() => setDone(true), 1200);
      return;
    }

    setTimeout(() => placeNextGate(status, playerZRef.current), 700);
  }, [userId, refreshProgress, sound, placeNextGate]);

  const handleResolveGate = useCallback((gateId, laneIndex, gate) => {
    if (gate.question_type && gate.question_type !== 'lane') {
      setInputGate(gate);
      return;
    }
    submitAnswer(gate, gate.options[laneIndex]);
  }, [submitAnswer]);

  const handleTick = useCallback((_distance, z) => {
    playerZRef.current = z;
    const now = performance.now();
    if (now - lastUiUpdateRef.current < UI_TICK_MS) return;
    lastUiUpdateRef.current = now;
    setPlayerZ(z);
  }, []);

  const handleCollect = useCallback((type) => {
    setCollected((c) => c + 1);
    sound.playCollect();
    setBursts((prev) => {
      const burst = {
        id: `${Date.now()}-${Math.random()}`,
        x: `${45 + Math.random() * 10}%`,
        y: `${35 + Math.random() * 15}%`,
        color: type === 'star' ? '#fbbf24' : '#a78bfa',
      };
      return [...prev, burst].slice(-6);
    });
  }, [sound]);

  const handleHit = useCallback(() => {
    sound.playHit();
  }, [sound]);

  const handleReplay = () => {
    if (isDemoUser(userId)) resetLocalFirstJourney();
    setDone(false);
    setStarted(false);
    setGates([]);
    setResolvedIds([]);
    setCollected(0);
    setPlayerZ(0);
    playerZRef.current = 0;
    refreshProgress();
  };

  const nextGate = gates.find((g) => !resolvedIds.includes(g.id));
  const gateDistance = nextGate ? Math.abs(playerZ - nextGate.z) : null;
  const questionNum = progress.answered + (nextGate ? 1 : 0);

  const gameState = useMemo(() => ({
    resolvedGateIds: resolvedIds,
    haltMovement: !!inputGate || done,
    slowCamera: !!inputGate,
    missionComplete: done,
  }), [resolvedIds, done, inputGate]);

  if (loading) {
    return (
      <div className="min-h-screen game-bg flex items-center justify-center">
        <p className="text-violet-300 animate-pulse">Starting First Journey...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen game-bg flex items-center justify-center p-4">
        <motion.div
          className="game-panel max-w-md p-8 rounded-3xl text-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <p className="text-5xl mb-4">🌟</p>
          <h2 className="text-2xl font-bold text-white mb-2">First Journey Complete!</h2>
          <p className="text-violet-300 text-sm mb-6">
            Your baseline profile is saved. Daily adventures will now adapt to you.
          </p>
          <button type="button" className="game-btn-primary w-full py-3 rounded-xl mb-2" onClick={onComplete}>
            Start Daily Adventures →
          </button>
          {isDemoUser(userId) && (
            <button type="button" className="w-full py-2 text-xs text-slate-400 hover:text-violet-300" onClick={handleReplay}>
              Play First Journey Again
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden game-bg">
      {!started && (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-emerald-950/40 to-slate-950 pointer-events-none" />
      )}

      {started && (
        <GameScene
          mapDef={INTRO_MAP}
          gameState={gameState}
          laneIndexRef={laneIndexRef}
          jumpQueuedRef={jumpQueuedRef}
          onTick={handleTick}
          onCollect={handleCollect}
          onHit={handleHit}
          onResolveGate={handleResolveGate}
          customGates={gates}
          collectibleCount={16}
        />
      )}

      {started && (
        <div className="absolute top-4 left-4 z-20 game-panel px-3 py-2 rounded-xl">
          <p className="text-[10px] uppercase tracking-widest text-amber-400">First Journey</p>
          <p className="text-xs text-violet-200">
            Question {Math.min(questionNum, progress.total)} / {progress.total}
          </p>
          {collected > 0 && (
            <p className="text-[10px] text-emerald-400 mt-0.5">✨ {collected} collected</p>
          )}
        </div>
      )}

      {started && (
        <InPathQuestionBanner gate={nextGate} distance={gateDistance} resolved={!nextGate} />
      )}

      <AnimatePresence>
        {lastAnswer && (
          <AnswerRecordedToast answer={lastAnswer} onDone={() => setLastAnswer(null)} />
        )}
      </AnimatePresence>

      {started && (
        <CollectBurst bursts={bursts} onDone={(id) => setBursts((b) => b.filter((x) => x.id !== id))} />
      )}

      <InGameInput
        gate={inputGate}
        visible={!!inputGate}
        onSubmit={(g, val) => { setInputGate(null); submitAnswer(g, val); }}
        onCancel={() => setInputGate(null)}
      />

      {started && (
        <GameControls
          onLeft={moveLeft}
          onRight={moveRight}
          onJump={jump}
          disabled={!!inputGate}
        />
      )}

      {!started && (
        <FirstJourneyIntro
          progress={progress}
          onStart={handleStart}
          onExit={onExit}
        />
      )}

      <button
        type="button"
        onClick={onExit}
        className="absolute top-4 right-4 z-20 game-panel px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
      >
        Exit
      </button>
    </div>
  );
}
