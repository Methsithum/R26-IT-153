import { motion } from "framer-motion";
import { Bell, Calendar, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import EmptyState from "../../Components/academic/Shared/EmptyState";
import { useAcademicStore } from "../../store/useAcademicStore";

const TYPE_META = {
  deadline: { icon: Calendar, bg: "bg-medium-50 dark:bg-medium-500/10", color: "text-medium-600" },
  recommendation: { icon: Sparkles, bg: "bg-brand-50 dark:bg-brand-500/10", color: "text-brand-600" },
  completion: { icon: CheckCircle2, bg: "bg-low-50 dark:bg-low-500/10", color: "text-low-600" },
  missed: { icon: AlertTriangle, bg: "bg-high-50 dark:bg-high-500/10", color: "text-high-600" },
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.round(diffMs / 3.6e6);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function Notifications() {
  const notifications = useAcademicStore((s) => s.notifications);
  const markNotificationRead = useAcademicStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useAcademicStore((s) => s.markAllNotificationsRead);

  return (
    <div>
      <Topbar title="Notifications" subtitle="Reminders, recommendations, and progress updates." />
      <div className="px-4 sm:px-6 pb-10 space-y-3 max-w-2xl">
        <div className="flex justify-end">
          <button onClick={markAllNotificationsRead} className="text-xs font-semibold text-brand-600 hover:underline">
            Mark all as read
          </button>
        </div>

        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" subtitle="New reminders and recommendations will show up here." />
        ) : (
          notifications.map((n, i) => {
            const meta = TYPE_META[n.type] || TYPE_META.deadline;
            const Icon = meta.icon;
            return (
              <motion.button
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => markNotificationRead(n.id)}
                className={`w-full text-left card p-4 flex items-start gap-3 ${!n.read ? "ring-1 ring-brand-200 dark:ring-brand-500/30" : "opacity-70"}`}
              >
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                  <Icon size={16} className={meta.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700 dark:text-white">{n.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[11px] text-slate-300">{timeAgo(n.time)}</span>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}
