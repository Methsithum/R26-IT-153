import { Link } from "react-router-dom";
import { UserCircle2, Sparkles } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import Toggle from "../../Components/academic/Shared/Toggle";
import { useAcademicStore } from "../../store/useAcademicStore";

const NOTIF_LABELS = {
  assignmentReminders: "Assignment deadline reminders",
  examReminders: "Exam reminders",
  studySessionReminders: "Study session reminders",
  missedTaskAlerts: "Missed task alerts",
};

export default function Settings() {
  const settings = useAcademicStore((s) => s.settings);
  const updateNotificationSetting = useAcademicStore((s) => s.updateNotificationSetting);
  const updateStudyPreference = useAcademicStore((s) => s.updateStudyPreference);
  const profile = useAcademicStore((s) => s.profile);

  return (
    <div>
      <Topbar title="Settings" subtitle="Notifications and preferences that shape your study plan." />
      <div className="px-4 sm:px-6 pb-10 max-w-2xl space-y-5">
        <Link to="/profile" className="card p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-transform">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent-teal to-brand-400 flex items-center justify-center text-white font-bold">
            {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-700 dark:text-white">{profile.name}</p>
            <p className="text-xs text-slate-400">View and edit your student profile</p>
          </div>
          <UserCircle2 size={20} className="text-slate-300" />
        </Link>

        <div className="card p-5">
          <p className="font-display font-bold text-slate-800 dark:text-white mb-4">Notifications</p>
          <div className="space-y-3">
            {Object.entries(NOTIF_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                <Toggle checked={settings.notifications[key]} onChange={(v) => updateNotificationSetting(key, v)} />
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-brand-500" />
            <p className="font-display font-bold text-slate-800 dark:text-white">Study Preferences</p>
          </div>
          <p className="text-xs text-slate-400 mb-4">These feed directly into the scheduling algorithm, so your plan reflects how you actually like to study.</p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 block mb-1">Preferred Study Time</label>
              <select
                value={settings.studyPreferences.preferredStudyTime}
                onChange={(e) => updateStudyPreference("preferredStudyTime", e.target.value)}
                className="input"
              >
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 block mb-1">
                Max Daily Study Hours: {settings.studyPreferences.maxDailyStudyHours}h
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={settings.studyPreferences.maxDailyStudyHours}
                onChange={(e) => updateStudyPreference("maxDailyStudyHours", Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 block mb-1">
                Break Duration: {settings.studyPreferences.breakDurationMinutes} min
              </label>
              <input
                type="range"
                min={5}
                max={30}
                step={5}
                value={settings.studyPreferences.breakDurationMinutes}
                onChange={(e) => updateStudyPreference("breakDurationMinutes", Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
