import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Brain } from "lucide-react";
import { useGameStore } from "../../Game/state/GameStateManager";
import LearningPatternsSection from "./LearningPatternsSection";
import BehaviorAnalysisSection from "./BehaviorAnalysisSection";

const SUB_TABS = [
  { id: "patterns", label: "Learning Patterns", icon: BarChart3 },
  { id: "behavior", label: "Behaviour Analysis", icon: Brain },
];

const WINDOW_OPTIONS = [14, 30, 60, 90];

export default function AnalyticsContent() {
  const userId = useGameStore((s) => s.userId);
  const [subTab, setSubTab] = useState("patterns");
  const [windowDays, setWindowDays] = useState(30);
  const [demoMode, setDemoMode] = useState(false);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold mb-0.5 text-slate-800 dark:text-white">Analytics</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            A read-only look at your learning patterns and the existing behaviour-analysis feature.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {subTab === "patterns" && (
            <div className="flex rounded-full bg-brand-50 dark:bg-white/5 p-0.5">
              {WINDOW_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindowDays(w)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    windowDays === w ? "bg-gradient-to-r from-brand-500 to-brand-400 text-white" : "text-brand-600 hover:bg-white/70 dark:hover:bg-white/10"
                  }`}
                >
                  {w}d
                </button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-300 cursor-pointer rounded-full bg-brand-50 dark:bg-white/5 px-2.5 py-1.5">
            <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} className="accent-brand-500" />
            Demo data
          </label>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl bg-brand-50/60 dark:bg-white/5 p-1.5 ring-1 ring-brand-100/70 dark:ring-white/10">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-colors ${
                active ? "text-white shadow-playful" : "text-brand-600 hover:bg-white/70 dark:hover:bg-white/10"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="analytics-subtab-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon size={13} strokeWidth={2.3} className="relative z-10" />
              <span className="relative z-10">{t.label}</span>
            </motion.button>
          );
        })}
      </div>

      {!userId ? (
        <p className="text-xs text-slate-400">Sign in to see your analytics.</p>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {subTab === "patterns" && <LearningPatternsSection userId={userId} windowDays={windowDays} demoMode={demoMode} />}
            {subTab === "behavior" && <BehaviorAnalysisSection userId={userId} demoMode={demoMode} />}
          </motion.div>
        </AnimatePresence>
      )}

      <p className="mt-6 text-center text-[11px] text-slate-400">
        These views summarise your self-reported journal data. They are descriptive, not diagnostic, and not medical or academic advice.
      </p>
    </div>
  );
}
