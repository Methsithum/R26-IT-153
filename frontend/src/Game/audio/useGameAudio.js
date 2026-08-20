import { useEffect } from "react";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { useRunnerStore } from "../state/runnerStore";
import { play, unlockAudio, startAmbient, stopAmbient } from "./sfx";

export default function useGameAudio() {
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    const unsubGame = useGameStore.subscribe((state, prev) => {
      if (state.phase !== prev.phase) {
        if (state.phase === PHASES.RUNNING && prev.phase === PHASES.GAME_START) play("start");
        if (state.phase === PHASES.QUESTION_APPROACHING) play("gate");
        if (state.phase === PHASES.ANSWER_CONFIRMED) play("answer");
        if (state.phase === PHASES.TRANSITION_TO_BUILDING) play("door");
        if (state.phase === PHASES.ENTERING_BUILDING) play("door");
        if (state.phase === PHASES.SPECIAL_INTERACTION_READY) {
          startAmbient(state.targetBuildingId || "library");
        }
        if (state.phase === PHASES.SPECIAL_INTERACTION_ACTIVE) play("enter");
        if (state.phase === PHASES.SPECIAL_INTERACTION_COMPLETED) play("save");
        if (state.phase === PHASES.RETURNING_TO_CAMPUS) stopAmbient();
        if (state.phase === PHASES.DAILY_COMPLETION) play("fanfare");
      }

      const last = state.floatingTexts[state.floatingTexts.length - 1];
      const prevLast = prev.floatingTexts[prev.floatingTexts.length - 1];
      if (last && last.id !== prevLast?.id) {
        if (last.kind === "hit") play("hit");
        if (last.kind === "combo") play("combo");
        if (last.kind === "pickup") play("pickup");
      }
    });

    const unsubRun = useRunnerStore.subscribe((state, prev) => {
      if (state.isJumping && !prev.isJumping) play("jump");
      if (state.isSliding && !prev.isSliding) play("slide");
      if (state.nearMission && !prev.nearMission) play("near");
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      unsubGame();
      unsubRun();
      stopAmbient();
    };
  }, []);
}
