import { useEffect } from "react";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { useRunnerStore } from "../state/runnerStore";
import { play, unlockAudio, startAmbient, stopAmbient, setRunWind, setMusic, setPausedAtmosphere } from "./sfx";

const RUN_WIND_PHASES = new Set([
  PHASES.RUNNING,
  PHASES.QUESTION_APPROACHING,
  PHASES.ANSWER_SELECTION,
  PHASES.ANSWER_CONFIRMED,
  PHASES.CHECKING_DATA_REQUIREMENT,
  PHASES.RUNNING_RESUMED,
  PHASES.APPROACHING_FINISH,
  PHASES.DAY_CELEBRATION,
]);

const INTERIOR_PHASES = new Set([
  PHASES.TRANSITION_TO_BUILDING,
  PHASES.ENTERING_BUILDING,
  PHASES.SPECIAL_INTERACTION_READY,
  PHASES.SPECIAL_INTERACTION_ACTIVE,
  PHASES.SPECIAL_INTERACTION_COMPLETED,
  PHASES.RETURNING_TO_CAMPUS,
]);

let lastStartChimeAt = 0;

function playStartChime() {
  const now = performance.now();
  if (now - lastStartChimeAt < 900) return;
  lastStartChimeAt = now;
  play("start");
}

function musicFor(phase) {
  if (phase === PHASES.DAY_CELEBRATION) return "celebrate";
  if (RUN_WIND_PHASES.has(phase)) return "run";
  if (INTERIOR_PHASES.has(phase)) return "interior";
  return "off";
}

export default function useGameAudio() {
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    unlockAudio().then((ready) => {
      if (!ready) return;
      const phase = useGameStore.getState().phase;
      if (RUN_WIND_PHASES.has(phase)) {
        playStartChime();
        setRunWind(true);
      }
      setMusic(musicFor(phase));
    });

    const unsubGame = useGameStore.subscribe((state, prev) => {
      if (state.paused !== prev.paused) {
        setPausedAtmosphere(state.paused);
        if (!state.restarting && !prev.restarting) {
          play(state.paused ? "pauseHold" : "pauseLift");
        }
      }
      if (state.phase !== prev.phase && !state.paused) {
        setRunWind(RUN_WIND_PHASES.has(state.phase));
        setMusic(musicFor(state.phase));
        if (state.phase === PHASES.RUNNING && prev.phase === PHASES.GAME_START) playStartChime();
        if (state.phase === PHASES.QUESTION_APPROACHING) play("gate");
        if (state.phase === PHASES.ANSWER_CONFIRMED) play("answer");
        if (state.phase === PHASES.ENTERING_BUILDING) play("door");
        if (state.phase === PHASES.SPECIAL_INTERACTION_READY) {
          startAmbient(state.targetBuildingId || "library");
        }
        if (state.phase === PHASES.SPECIAL_INTERACTION_ACTIVE) play("enter");
        if (state.phase === PHASES.SPECIAL_INTERACTION_COMPLETED) play("save");
        if (state.phase === PHASES.RETURNING_TO_CAMPUS) stopAmbient();
        if (state.phase === PHASES.APPROACHING_FINISH) play("gate");
        if (state.phase === PHASES.DAY_CELEBRATION) {
          play("tape");
          play("fanfare");
        }
        if (state.phase === PHASES.DAILY_COMPLETION) {
          setRunWind(false);
          setMusic("off");
        }
      }

      const last = state.floatingTexts[state.floatingTexts.length - 1];
      const prevLast = prev.floatingTexts[prev.floatingTexts.length - 1];
      if (last && last.id !== prevLast?.id && !state.paused) {
        if (last.kind === "hit") play("hit");
        if (last.kind === "combo") play("combo");
        if (last.kind === "pickup") play("pickup");
        if (last.kind === "level") play("levelUp");
      }
    });

    const unsubRun = useRunnerStore.subscribe((state, prev) => {
      if (useGameStore.getState().paused) return;
      if (state.isJumping && !prev.isJumping) play("jump");
      if (!state.isJumping && prev.isJumping) play("land");
      if (state.isSliding && !prev.isSliding) play("slide");
      if (state.laneIndex !== prev.laneIndex) play("whoosh");
      if (state.nearMission && !prev.nearMission) play("near");
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      unsubGame();
      unsubRun();
      stopAmbient();
      setRunWind(false);
      setMusic("off");
    };
  }, []);
}
