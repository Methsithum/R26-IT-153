import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useRunnerStore, LANES } from "../state/runnerStore";
import { PHASES, useGameStore } from "../state/GameStateManager";
import AnswerLane from "./AnswerLane";

const LANE_DISTANCE_AHEAD = 95;
const SPAWN_GAP = 70;
const LANE_COUNT = LANES.length;

// Map answers onto all 4 lanes. Extra lanes repeat the last answer so
// every gate always has a valid choice.
function laneMapping(answers) {
  if (!answers || answers.length === 0) return Array(LANE_COUNT).fill(null);
  return Array.from(
    { length: LANE_COUNT },
    (_, i) => answers[Math.min(i, answers.length - 1)]
  );
}

export default function QuestionSystem() {
  const phase = useGameStore((s) => s.phase);
  const activeQuestion = useGameStore((s) => s.activeQuestion);

  const laneZRef = useRef(null);
  const nextSpawnZ = useRef(SPAWN_GAP);
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (activeQuestion) {
      const { posZ } = useRunnerStore.getState();
      laneZRef.current = posZ + LANE_DISTANCE_AHEAD;
      resolvedRef.current = false;
    } else {
      laneZRef.current = null;
    }
  }, [activeQuestion]);

  useFrame(() => {
    if (useGameStore.getState().paused) return;
    if (
      phase === PHASES.APPROACHING_FINISH ||
      phase === PHASES.DAY_CELEBRATION ||
      phase === PHASES.DAILY_COMPLETION
    ) {
      return;
    }

    const { posZ, laneIndex } = useRunnerStore.getState();

    if (phase === PHASES.RUNNING && !activeQuestion && posZ >= nextSpawnZ.current) {
      nextSpawnZ.current = posZ + SPAWN_GAP;
      useGameStore.getState().spawnNextQuestion();
      return;
    }

    if (!activeQuestion || laneZRef.current == null) return;
    const laneZ = laneZRef.current;

    if (
      phase === PHASES.ANSWER_SELECTION &&
      !resolvedRef.current &&
      activeQuestion.answers &&
      posZ >= laneZ - 1
    ) {
      resolvedRef.current = true;
      const value = laneMapping(activeQuestion.answers)[laneIndex];
      useGameStore.getState().confirmAnswer(value);
    }

    if (
      phase === PHASES.QUESTION_APPROACHING &&
      !resolvedRef.current &&
      !activeQuestion.answers &&
      posZ >= laneZ - 1
    ) {
      resolvedRef.current = true;
      useGameStore.getState().passInfoBoard();
    }
  });

  if (!activeQuestion || laneZRef.current == null || !activeQuestion.answers) return null;
  if (![PHASES.QUESTION_APPROACHING, PHASES.ANSWER_SELECTION].includes(phase)) return null;

  return (
    <group>
      {laneMapping(activeQuestion.answers).map((label, i) => (
        <AnswerLane
          key={i}
          label={label}
          laneIndex={i}
          z={laneZRef.current}
          active={phase === PHASES.ANSWER_SELECTION}
        />
      ))}
    </group>
  );
}
