import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useRunnerStore, LANES } from "../state/runnerStore";
import { PHASES, useGameStore } from "../state/GameStateManager";
import QuestionBoard from "./QuestionBoard";
import AnswerLane from "./AnswerLane";

const BOARD_DISTANCE_AHEAD = 34; // how far ahead the board spawns when triggered
const LANE_GAP = 16; // distance from board to the answer gates
const SPAWN_GAP = 60; // minimum run distance between questions
const LANE_COUNT = LANES.length;

// Map an answer set onto all LANE_COUNT lanes without ever dropping an
// answer. Every question has at most LANE_COUNT choices, so each answer
// gets its own lane; if there are fewer answers than lanes, the leftover
// lanes repeat the last answer rather than leaving a dead gate.
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

  const spawnGeom = useRef(null); // { boardZ, laneZ }
  const nextSpawnZ = useRef(SPAWN_GAP);
  const resolvedRef = useRef(false);
  const passedBoardRef = useRef(false);

  // Capture fixed world-space positions once a question becomes active.
  useEffect(() => {
    if (activeQuestion) {
      const { posZ } = useRunnerStore.getState();
      const boardZ = posZ + BOARD_DISTANCE_AHEAD;
      spawnGeom.current = { boardZ, laneZ: boardZ + LANE_GAP };
      resolvedRef.current = false;
      passedBoardRef.current = false;
    } else {
      spawnGeom.current = null;
    }
  }, [activeQuestion]);

  useFrame(() => {
    const { posZ, laneIndex } = useRunnerStore.getState();

    // Trigger the next question once enough distance has passed and the
    // runner is free (no question / interaction currently in progress).
    if (phase === PHASES.RUNNING && !activeQuestion && posZ >= nextSpawnZ.current) {
      nextSpawnZ.current = posZ + SPAWN_GAP;
      useGameStore.getState().spawnNextQuestion();
      return;
    }

    if (!activeQuestion || !spawnGeom.current) return;
    const { boardZ, laneZ } = spawnGeom.current;

    if (phase === PHASES.QUESTION_APPROACHING && !passedBoardRef.current && posZ >= boardZ - 3) {
      passedBoardRef.current = true;
      if (activeQuestion.answers) {
        useGameStore.getState().questionBoardReached();
      } else {
        useGameStore.getState().passInfoBoard();
      }
    }

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
  });

  if (!activeQuestion || !spawnGeom.current) return null;
  const { boardZ, laneZ } = spawnGeom.current;
  const showLanes =
    activeQuestion.answers &&
    [PHASES.QUESTION_APPROACHING, PHASES.ANSWER_SELECTION].includes(phase);

  return (
    <group>
      {[PHASES.QUESTION_APPROACHING, PHASES.ANSWER_SELECTION].includes(phase) && (
        <QuestionBoard text={activeQuestion.questionText} z={boardZ} />
      )}
      {showLanes &&
        laneMapping(activeQuestion.answers).map((label, i) => (
          <AnswerLane
            key={i}
            label={label}
            laneIndex={i}
            z={laneZ}
            active={phase === PHASES.ANSWER_SELECTION}
          />
        ))}
    </group>
  );
}
