import { motion } from "framer-motion";
import { Flame, TrendingUp } from "lucide-react";

export default function ProductivityAndStreak({ productivity, streak }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - productivity.score / 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="card p-5 flex items-center gap-5">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="9" className="text-slate-100 dark:text-white/10" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none" stroke="url(#prodGrad)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="prodGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="font-display font-bold text-xl text-slate-800 dark:text-white">{productivity.score}%</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Productivity Score</p>
          <p className="inline-flex items-center gap-1 text-sm font-semibold text-low-600 mt-1">
            <TrendingUp size={14} /> +{productivity.trend}% this week
          </p>
          <p className="text-xs text-slate-400 mt-2 max-w-[180px]">
            Based on completed vs. missed tasks, study hours logged, and planned vs. completed sessions.
          </p>
        </div>
      </div>

      <div className="card p-5 flex flex-col items-center justify-center text-center bg-gradient-to-br from-medium-500/10 to-accent-orange/10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-medium-500 to-accent-orange flex items-center justify-center mb-2 shadow-playful">
          <Flame size={28} className="text-white fill-white" />
        </div>
        <p className="font-display font-bold text-2xl text-slate-800 dark:text-white">{streak.days} Day Streak</p>
        <p className="text-xs text-slate-400 mt-1">Best streak: {streak.best} days — keep it going!</p>
      </div>
    </div>
  );
}
