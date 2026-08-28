import { useEffect, useRef } from "react";
import { useRunnerStore } from "../state/runnerStore";
import { useGameStore } from "../state/GameStateManager";
import { getBuildingsInRange } from "../Environment/chunkGenerator";

const VIEW_AHEAD = 160;
const VIEW_BEHIND = 40;
const MAP_HEIGHT = 200;

// Small, unobtrusive campus minimap. Reads player position imperatively
// via requestAnimationFrame instead of subscribing to per-frame React
// state, so it never causes a 60fps re-render of the rest of the HUD.
export default function Minimap() {
  const svgRef = useRef(null);
  const playerDotRef = useRef(null);
  const listRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    function tick() {
      const { posZ } = useRunnerStore.getState();
      const { targetBuildingId } = useGameStore.getState();
      const buildings = getBuildingsInRange(posZ - VIEW_BEHIND, posZ + VIEW_AHEAD);

      if (listRef.current) {
        listRef.current.innerHTML = "";
        buildings.forEach((b) => {
          const relative = (b.z - posZ + VIEW_BEHIND) / (VIEW_AHEAD + VIEW_BEHIND);
          const y = MAP_HEIGHT * (1 - relative);
          const x = b.side > 0 ? 62 : 12;
          const isTarget = b.id === targetBuildingId;

          const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          dot.setAttribute("cx", x);
          dot.setAttribute("cy", String(y));
          dot.setAttribute("r", isTarget ? "5" : "3.5");
          dot.setAttribute("fill", isTarget ? "#facc15" : b.color);
          if (isTarget) {
            dot.setAttribute("stroke", "#facc15");
            dot.setAttribute("stroke-width", "1.5");
            dot.setAttribute("opacity", "0.9");
          }
          listRef.current.appendChild(dot);
        });

        const { finishLineZ, phase } = useGameStore.getState();
        if (
          finishLineZ != null &&
          (phase === "APPROACHING_FINISH" || phase === "DAY_CELEBRATION") &&
          finishLineZ >= posZ - VIEW_BEHIND &&
          finishLineZ <= posZ + VIEW_AHEAD
        ) {
          const relative = (finishLineZ - posZ + VIEW_BEHIND) / (VIEW_AHEAD + VIEW_BEHIND);
          const y = MAP_HEIGHT * (1 - relative);
          const line = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          line.setAttribute("x", "28");
          line.setAttribute("y", String(y - 2));
          line.setAttribute("width", "18");
          line.setAttribute("height", "4");
          line.setAttribute("rx", "1.5");
          line.setAttribute("fill", "#f5d76e");
          listRef.current.appendChild(line);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="pointer-events-none rounded-2xl border border-sky-300/20 bg-slate-900/70 backdrop-blur-md p-2 shadow-xl">
      <svg ref={svgRef} width="74" height={MAP_HEIGHT} viewBox={`0 0 74 ${MAP_HEIGHT}`}>
        {/* road */}
        <rect x="30" y="0" width="14" height={MAP_HEIGHT} fill="#3f4451" rx="4" />
        <g ref={listRef} />
        {/* player marker, fixed near the bottom */}
        <g ref={playerDotRef} transform={`translate(37, ${MAP_HEIGHT - 26})`}>
          <circle r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
}
