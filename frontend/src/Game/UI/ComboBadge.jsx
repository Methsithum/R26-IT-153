import { AnimatePresence, motion as Motion } from "framer-motion";
import { useGameStore } from "../state/GameStateManager";

export default function ComboBadge() {
  const combo = useGameStore((s) => s.combo);
  const rushing = combo >= 5;

  return (
    <AnimatePresence>
      {combo >= 2 && (
        <Motion.div
          key={combo}
          initial={{ scale: 0.7, opacity: 0, y: 8 }}
          animate={{ scale: rushing ? 1.12 : 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0 }}
          className={`mt-2 rounded-full px-3 py-1 text-center text-xs font-black tracking-[0.2em] shadow-lg ${
            rushing
              ? "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950"
              : "border border-amber-300/40 bg-slate-950/70 text-amber-200 backdrop-blur-md"
          }`}
        >
          {rushing ? "CAMPUS RUSH" : `COMBO ×${combo}`}
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
