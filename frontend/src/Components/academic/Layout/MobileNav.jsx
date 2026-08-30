import { NavLink } from "react-router-dom";
import { LayoutGrid, CalendarDays, CheckSquare, TrendingUp, Settings } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Home", icon: LayoutGrid, exact: true },
  { to: "/study-planner", label: "Planner", icon: CalendarDays },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/career", label: "Career", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-[#150f28] border-t border-black/5 dark:border-white/5 flex items-center justify-around py-2 px-1">
      {ITEMS.map(({ to, label, icon: Icon, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] font-medium ${
              isActive ? "text-brand-600 dark:text-brand-300" : "text-slate-400"
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
