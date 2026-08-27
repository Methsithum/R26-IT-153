import { motion } from "framer-motion";
import { MAX_LIVES, useGameStore } from "../state/GameStateManager";

function Heart({ filled, delay }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className="h-7 w-7 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{
        scale: filled ? 1 : 0.92,
        opacity: 1,
        filter: filled ? "saturate(1)" : "saturate(0.2)",
      }}
      transition={{ type: "spring", stiffness: 420, damping: 18, delay }}
    >
      <path
        d="M12 21s-6.7-4.35-9.33-7.7C.4 10.7 1.1 7.2 3.7 5.7 5.6 4.6 8 5 9.4 6.6L12 9.4l2.6-2.8C16 5 18.4 4.6 20.3 5.7c2.6 1.5 3.3 5 1.03 7.6C18.7 16.65 12 21 12 21z"
        fill={filled ? "#e11d48" : "transparent"}
        stroke={filled ? "#fecdd3" : "#64748b"}
        strokeWidth="1.6"
      />
    </motion.svg>
  );
}

export default function LivesDisplay() {
  const lives = useGameStore((s) => s.lives);
  const hitFlashAt = useGameStore((s) => s.hitFlashAt);

  return (
    <motion.div
      key={hitFlashAt}
      animate={hitFlashAt ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.38 }}
      className="flex flex-col items-center gap-1"
    >
      <div className="flex items-center gap-1.5 rounded-full border border-rose-300/25 bg-slate-950/65 px-3 py-1.5 backdrop-blur-md shadow-lg">
        {Array.from({ length: MAX_LIVES }, (_, i) => (
          <Heart key={i} filled={i < lives} delay={i * 0.04} />
        ))}
      </div>
    </motion.div>
  );
}
