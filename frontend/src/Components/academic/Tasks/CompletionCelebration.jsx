import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Confetti from "react-confetti";
import { CheckCircle2 } from "lucide-react";

/**
 * Fires a brief celebratory moment on task completion. Confetti only for
 * High priority tasks (per build spec) - Medium/Low still get the success
 * card, just without the confetti burst, so High-priority wins feel
 * distinctly bigger.
 */
export default function CompletionCelebration({ active, priority, taskTitle, onDone }) {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    if (!active) return;
    const resize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    const timer = setTimeout(onDone, 2200);
    return () => {
      window.removeEventListener("resize", resize);
      clearTimeout(timer);
    };
  }, [active, onDone]);

  return (
    <AnimatePresence>
      {active && (
        <>
          {priority === "High" && (
            <Confetti width={size.width} height={size.height} numberOfPieces={220} recycle={false} gravity={0.25} />
          )}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-[#1a1530] shadow-playful rounded-2xl px-5 py-4 flex items-center gap-3 border border-low-500/20"
          >
            <div className="w-9 h-9 rounded-full bg-low-500 flex items-center justify-center animate-pop-in">
              <CheckCircle2 size={20} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-white text-sm">Task Completed!</p>
              <p className="text-xs text-slate-400 truncate max-w-[220px]">{taskTitle}</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
