import { Moon, Sun, Bell, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { useAcademicStore } from "../../../store/useAcademicStore";

export default function Topbar({ title, subtitle }) {
  const darkMode = useAcademicStore((s) => s.darkMode);
  const toggleDarkMode = useAcademicStore((s) => s.toggleDarkMode);
  const unreadCount = useAcademicStore((s) => s.notifications.filter((n) => !n.read).length);
  const streak = useAcademicStore((s) => s.streak);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-canvas/80 dark:bg-[#0f0b1f]/80 backdrop-blur-md">
      <div className="min-w-0">
        {title && <h1 className="font-display font-bold text-xl sm:text-2xl text-slate-800 dark:text-white truncate">{title}</h1>}
        {subtitle && <p className="text-sm text-slate-400 mt-0.5 truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 bg-medium-50 dark:bg-medium-500/10 text-medium-600 dark:text-medium-500 font-semibold text-sm px-3 py-1.5 rounded-full">
          <Flame size={16} className="fill-medium-500 text-medium-500" />
          {streak} day streak
        </div>

        <button
          onClick={toggleDarkMode}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 text-slate-500 dark:text-slate-200 hover:scale-105 active:scale-95 transition-transform"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <Link
          to="/notifications"
          className="relative w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 text-slate-500 dark:text-slate-200 hover:scale-105 active:scale-95 transition-transform"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-high-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
