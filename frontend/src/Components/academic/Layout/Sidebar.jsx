import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  CalendarDays,
  CheckSquare,
  BookOpen,
  GraduationCap,
  BarChart3,
  Bell,
  Settings,
} from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";
import Logo from "../Shared/Logo";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, exact: true },
  { to: "/study-planner", label: "Study Planner", icon: CalendarDays },
  { to: "/tasks", label: "My Tasks", icon: CheckSquare },
  { to: "/modules", label: "Modules", icon: BookOpen },
  { to: "/exams", label: "Exams", icon: GraduationCap },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell, badge: true },
];

export default function Sidebar() {
  const unreadCount = useAcademicStore((s) => s.notifications.filter((n) => !n.read).length);
  const profile = useAcademicStore((s) => s.profile);

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 bg-white dark:bg-[#150f28] border-r border-black/5 dark:border-white/5 px-4 py-6">
      <div className="flex items-center gap-2 px-2 mb-8">
        <Logo size={40} />
        <div>
          <p className="font-display font-bold text-lg leading-tight text-slate-800 dark:text-white">StudyFlow</p>
          <p className="text-[11px] text-slate-400 -mt-0.5">Smart Uni Guide</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl font-medium text-sm transition-all ${
                isActive
                  ? "bg-gradient-to-r from-brand-500 to-brand-400 text-white shadow-playful"
                  : "text-slate-500 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-white/5 hover:text-brand-600"
              }`
            }
          >
            <Icon size={19} strokeWidth={2.3} />
            {label}
            {badge && unreadCount > 0 && (
              <span className="ml-auto bg-high-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `mt-4 flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors ${
            isActive ? "bg-brand-50 dark:bg-white/10" : "hover:bg-brand-50 dark:hover:bg-white/5"
          }`
        }
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-teal to-brand-400 flex items-center justify-center text-white font-bold text-sm">
          {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-white truncate">{profile.name}</p>
          <p className="text-xs text-slate-400 truncate">Year {profile.year} · Sem {profile.semester}</p>
        </div>
        <Settings size={16} className="text-slate-400" />
      </NavLink>
    </aside>
  );
}
