import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import GameScene from '../../components/student-journaling/game/GameScene';
import GameHUD from '../../components/student-journaling/game/GameHUD';
import GameControls from '../../components/student-journaling/game/GameControls';
import GuideDialogue from '../../components/student-journaling/dialogue/GuideDialogue';
import MapTransition from '../../components/student-journaling/game/MapTransition';
import CollectBurst from '../../components/student-journaling/game/CollectBurst';
import useGameSession from '../../hooks/useGameSession';
import useGameSound from '../../hooks/useGameSound';
import { submitCheckpointAnswer } from '../../services/gameApi';
import { activateDemoCheckpoint, answerDemoSession, resetDemoForNextMap } from '../../constants/demoMode';
import { MIN_COLLECTIBLES_FOR_CHECKPOINT } from '../../constants/gameMaps';

export default function GamePage({
  maps,
  session: initialSession,
  onAdventureComplete,
  onExit,
}) {
  const {
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
  } = useGameSession();

  const sound = useGameSound(true);
  const [laneIndex, setLaneIndex] = useState(1);
  const [jumpTrigger, setJumpTrigger] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMapTransition, setShowMapTransition] = useState(false);
  const [bursts, setBursts] = useState([]);
  const sessionRef = useRef(initialSession);
  const pendingBackendQ = useRef(null);
  const prevCheckpoint = useRef(false);
  const checkpointReady = useRef(false);

  useEffect(() => {
    if (maps?.length) {
      initSession(maps, initialSession);
      sessionRef.current = initialSession;
      checkpointReady.current = false;

      // Hold backend question until boss checkpoint (after collecting)
      if (initialSession?.question && initialSession?.session_id !== 'demo-session') {
        pendingBackendQ.current = {
          question: initialSession.question,
          options: initialSession.options,
        };
        sessionRef.current = { ...initialSession, question: null, options: null };
      }
    }
  }, [maps, initialSession, initSession]);

  useEffect(() => {
    sound.unlock();
  }, [sound]);

  // Activate Luna dialogue ONLY when boss checkpoint opens (after collecting)
  useEffect(() => {
    if (!state.isCheckpoint || !state.checkpointActivated || checkpointReady.current) return;

    if (sessionRef.current?.session_id === 'demo-session') {
      const activated = activateDemoCheckpoint(sessionRef.current, currentMap, collectedCount);
      sessionRef.current = activated;
      setSession(activated);
      checkpointReady.current = true;
      sound.playCheckpoint();
      return;
    }

    if (pendingBackendQ.current) {
      sessionRef.current = {
        ...sessionRef.current,
        intro: `Great run! You collected ${collectedCount} ${currentMap?.collectibleLabel?.toLowerCase() || 'items'} in ${currentMap?.name || 'this map'}.`,
        question: pendingBackendQ.current.question,
        options: pendingBackendQ.current.options,
      };
      pendingBackendQ.current = null;
      setSession(sessionRef.current);
      checkpointReady.current = true;
      sound.playCheckpoint();
    }
  }, [state.isCheckpoint, state.checkpointActivated, currentMap, collectedCount, setSession, sound]);

  useEffect(() => {
    if (!state.isCheckpoint) {
      checkpointReady.current = false;
    }
  }, [state.isCheckpoint]);

  const moveLeft = useCallback(() => {
    setLaneIndex((i) => {
      const next = Math.max(0, i - 1);
      if (next !== i) sound.playLane();
      return next;
    });
  }, [sound]);

  const moveRight = useCallback(() => {
    setLaneIndex((i) => {
      const next = Math.min(2, i + 1);
      if (next !== i) sound.playLane();
      return next;
    });
  }, [sound]);

  const jump = useCallback(() => {
    setJumpTrigger((n) => n + 1);
    sound.playJump();
  }, [sound]);

  useEffect(() => {
    const onKey = (e) => {
      if (state.isCheckpoint || state.mapComplete || state.adventureComplete) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft();
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveLeft, moveRight, jump, state.isCheckpoint, state.mapComplete, state.adventureComplete]);

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

  const removeBurst = useCallback((id) => {
    setBursts((b) => b.filter((x) => x.id !== id));
  }, []);

  const isLastMap = state.currentMapIndex >= (state.maps.length - 1);

  const handleAnswer = async ({ answer, deadline }) => {
    const session = sessionRef.current;

    if (session?.session_id === 'demo-session') {
      setIsSubmitting(true);
      try {
        const response = answerDemoSession(session, answer, currentMap, collectedCount, isLastMap);
        sessionRef.current = response;
        setSession(response);

        if (response._mapBossDone) {
          endCheckpoint();
          defeatBoss();
          setShowMapTransition(true);
          sessionRef.current = resetDemoForNextMap(response);
          return;
        }

        if (response.completed) {
          sound.playComplete();
          setCompletion(response);
          onAdventureComplete?.(response);
          return;
        }

        endCheckpoint();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!session?.session_id) {
      endCheckpoint();
      if (state.mapComplete) setShowMapTransition(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitCheckpointAnswer({
        sessionId: session.session_id,
        answer,
        deadline,
      });

      sessionRef.current = { ...response, intro: null };
      setSession(sessionRef.current);

      if (response.completed) {
        sound.playComplete();
        setCompletion(response);
        onAdventureComplete?.(response);
        return;
      }

      // More questions for this boss — keep checkpoint open
      if (response.question) {
        sessionRef.current = {
          ...response,
          intro: 'Thanks! One more thing...',
        };
        setSession(sessionRef.current);
        return;
      }

      endCheckpoint();
      defeatBoss();
      if (!isLastMap) {
        setShowMapTransition(true);
      } else {
        onAdventureComplete?.(response);
      }
    } catch (_err) {
      endCheckpoint();
      defeatBoss();
      if (state.mapComplete) setShowMapTransition(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMapTransitionContinue = () => {
    setShowMapTransition(false);
    defeatBoss();
    nextMap();
    checkpointReady.current = false;
  };

  useEffect(() => {
    if (state.mapComplete && !showMapTransition && !state.adventureComplete && state.isCheckpoint) {
      // Wait for Q&A before showing transition — handled in handleAnswer
    }
  }, [state.mapComplete, showMapTransition, state.adventureComplete, state.isCheckpoint]);

  const isInvincible = state.invincibleUntil > Date.now();
  const collectRemaining = Math.max(0, MIN_COLLECTIBLES_FOR_CHECKPOINT - collectedCount);

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
        gameState={state}
        laneIndex={laneIndex}
        jumpTrigger={jumpTrigger}
        onTick={setDistance}
        onCollect={handleCollect}
        onHit={handleHit}
      />

      <CollectBurst bursts={bursts} onDone={removeBurst} />

      {isInvincible && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-5 border-4 border-rose-500/30"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        />
      )}

      {collectRemaining > 0 && !state.isCheckpoint && (
        <div className="absolute top-16 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <span className="game-badge text-[10px]">
            Collect {collectRemaining} more {currentMap.collectibleLabel} to reach the boss
          </span>
        </div>
      )}

      <GameHUD
        health={state.health}
        sessionXp={state.sessionXp}
        collectibles={state.collectibles}
        mapName={currentMap.name}
        progress={progress}
        collectibleLabel={currentMap.collectibleLabel}
        collectibleEmoji={currentMap.collectibleEmoji}
        floatingXp={state.floatingXp}
        onFloatingXpDone={removeFloatingXp}
      />

      <GameControls onLeft={moveLeft} onRight={moveRight} onJump={jump} disabled={state.isPaused} />

      <GuideDialogue
        visible={state.isCheckpoint && !!state.session?.question}
        session={state.session}
        onAnswer={handleAnswer}
        collectedCount={collectedCount}
        collectibleLabel={currentMap.collectibleLabel?.toLowerCase()}
        bossName={state.isBossEncounter ? currentMap.bossName : ''}
        isSubmitting={isSubmitting}
      />

      {state.isBossEncounter && !state.bossDefeated && !state.isCheckpoint && (
        <motion.div
          className="absolute top-1/3 left-0 right-0 z-20 text-center pointer-events-none"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="text-red-400 text-lg font-bold">{currentMap.bossEmoji} {currentMap.bossName}</p>
        </motion.div>
      )}

      <MapTransition map={currentMap} visible={showMapTransition} onContinue={handleMapTransitionContinue} />

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
