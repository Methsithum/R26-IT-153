import DailyProgress from "./DailyProgress";
import ScoreDisplay from "./ScoreDisplay";
import ObjectivePanel from "./ObjectivePanel";
import Minimap from "./Minimap";
import ControlHints from "./ControlHints";
import CampusClock from "./CampusClock";

export default function GameHUD() {
  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      <div className="absolute top-4 left-4">
        <DailyProgress />
      </div>

      <div className="absolute top-4 right-4">
        <ScoreDisplay />
      </div>

      <div className="absolute top-24 right-4 flex flex-col items-end gap-3">
        <ObjectivePanel />
        <Minimap />
      </div>

      <div className="absolute bottom-4 left-4">
        <ControlHints />
      </div>

      <div className="absolute bottom-4 right-4">
        <CampusClock />
      </div>
    </div>
  );
}
