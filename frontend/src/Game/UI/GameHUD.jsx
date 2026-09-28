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

export default function GameHUD() {
  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      <HitFx />
      <LevelUpBurst />
      <RunFeedback />

      <div className="absolute top-4 left-[4.35rem] sm:left-[4.6rem]">
        <DailyProgress />
      </div>

      <div className="absolute bottom-16 left-4 sm:bottom-auto sm:top-4 sm:left-1/2 z-10 sm:-translate-x-1/2">
        <LivesDisplay />
        <ComboBadge />
      </div>

      <QuestionBanner />
      <FinishAheadBanner />

      <div className="absolute top-4 right-4">
        <ScoreDisplay />
      </div>

      <div className="absolute bottom-20 right-4 hidden sm:flex flex-col items-end gap-3">
        <ObjectivePanel />
        <Minimap />
      </div>

      <div className="absolute bottom-4 left-4">
        <ControlHints />
      </div>

      <div className="absolute bottom-4 right-4">
        <CampusClock />
      </div>
      <div className="absolute bottom-16 right-3 max-w-[55%] sm:hidden"><ObjectivePanel /></div>
    </div>
  );
}
