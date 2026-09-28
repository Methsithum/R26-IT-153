import DailyProgress from "./DailyProgress";
import ScoreDisplay from "./ScoreDisplay";
import ObjectivePanel from "./ObjectivePanel";
import Minimap from "./Minimap";
import ControlHints from "./ControlHints";
import CampusClock from "./CampusClock";
import QuestionBanner from "./QuestionBanner";
import FinishAheadBanner from "./FinishAheadBanner";
import LivesDisplay from "./LivesDisplay";
import ComboBadge from "./ComboBadge";
import HitFx from "./HitFx";
import LevelUpBurst from "./LevelUpBurst";
import RunFeedback from "./RunFeedback";
import { useLayoutEffect, useRef } from "react";
import { PHASES, useGameStore } from "../state/GameStateManager";

export default function GameHUD() {
  const dock = useRef(null);
  const phase = useGameStore((s) => s.phase);
  const answering = phase === PHASES.QUESTION_APPROACHING || phase === PHASES.ANSWER_SELECTION;
  useLayoutEffect(() => {
    const element = dock.current;
    const game = element.closest(".campus-game");
    const resize = () => game.style.setProperty("--hud-height", `${element.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => { observer.disconnect(); game.style.removeProperty("--hud-height"); };
  }, []);
  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      <HitFx />
      <LevelUpBurst />
      <RunFeedback />

      <div ref={dock} className="game-hud-dock">
      <div className="game-hud-stats">
      <div className="game-player-status">
        <DailyProgress />
      </div>

      <div className="game-vitals">
        <LivesDisplay />
        <div className="game-combo"><ComboBadge /></div>
      </div>

      <div className="game-score-status">
        <ScoreDisplay />
      </div>
      </div>
      <QuestionBanner />
      </div>
      <FinishAheadBanner />

      <div className={`game-side-hud ${answering ? "is-answering" : ""}`}>
        <ObjectivePanel />
        <Minimap />
      </div>

      <div className="absolute bottom-4 left-4 max-w-[calc(100%-8rem)]">
        <ControlHints />
      </div>

      <div className="absolute bottom-4 right-4">
        <CampusClock />
      </div>
    </div>
  );
}
