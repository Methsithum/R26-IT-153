import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../state/GameStateManager";

const KIND_STYLE = {
  hit: "text-rose-200",
  combo: "text-amber-200",
  pickup: "text-emerald-200",
  answer: "text-sky-200",
  save: "text-amber-100",
  level: "text-amber-200",
};

export default function HitFx() {
  const hitFlashAt = useGameStore((s) => s.hitFlashAt);
  const texts = useGameStore((s) => s.floatingTexts);
  const exhausted = useGameStore((s) => s.exhausted);
  const [flash, setFlash] = useState(false);
  const [gone, setGone] = useState({});

  useEffect(() => {
    if (!hitFlashAt) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 320);
    return () => clearTimeout(t);
  }, [hitFlashAt]);

  const lastId = texts[texts.length - 1]?.id;
  useEffect(() => {
    if (!lastId) return;
    const t = setTimeout(() => {
      setGone((prev) => ({ ...prev, [lastId]: true }));
    }, 950);
    return () => clearTimeout(t);
  }, [lastId]);

  const showing = texts.slice(-4).filter((item) => !gone[item.id]);

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
          flash ? "opacity-100" : "opacity-0"
        }`}
        style={{
          boxShadow: "inset 0 0 140px 48px rgba(190, 18, 60, 0.55)",
        }}
      />

      <AnimatePresence>
        {exhausted && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute left-1/2 top-28 z-20 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-rose-400/40 bg-slate-950/80 px-5 py-3 text-center shadow-2xl backdrop-blur-md"
          >
            <div className="text-sm font-black tracking-[0.28em] text-rose-300">LATE TO CLASS</div>
            <div className="mt-1 text-xs text-slate-300">
              Keep running — your journal answers are safe.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 top-[38%] flex flex-col items-center gap-1">
        <AnimatePresence>
          {showing.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 18, scale: 0.85 }}
              animate={{ opacity: 1, y: -28, scale: 1 }}
              exit={{ opacity: 0, y: -56 }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              className={`text-center font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] ${KIND_STYLE[item.kind] || "text-white"}`}
            >
              <div className="text-2xl tracking-wide">{item.text}</div>
              {item.sub && (
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200/90">
                  {item.sub}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
