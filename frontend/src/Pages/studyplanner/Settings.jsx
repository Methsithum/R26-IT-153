import { Link } from "react-router-dom";
import { UserCircle2, Sparkles } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import Toggle from "../../Components/academic/Shared/Toggle";
import SettingsRecommendations from "../../Components/academic/Settings/SettingsRecommendations";
import QuickFacts from "../../Components/academic/Settings/QuickFacts";
import { useAcademicStore } from "../../store/useAcademicStore";
import { WEEKDAYS } from "../../utils/dateHelpers";
import { FULL_STUDY_DAY_WINDOW } from "../../utils/freeSlotGenerator";

const NOTIF_LABELS = {
  assignmentReminders: "Assignment deadline reminders",
  examReminders: "Exam reminders",
  studySessionReminders: "Study session reminders",
  missedTaskAlerts: "Missed task alerts",
};

const TIME_OPTIONS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "night", label: "Night" },
];

export default function Settings() {
  const settings = useAcademicStore((s) => s.settings);
  const updateNotificationSetting = useAcademicStore((s) => s.updateNotificationSetting);
  const updateStudyPreference = useAcademicStore((s) => s.updateStudyPreference);
  const profile = useAcademicStore((s) => s.profile);
  const assignments = useAcademicStore((s) => s.assignments);
  const modules = useAcademicStore((s) => s.modules);
  const exams = useAcademicStore((s) => s.exams);
  const streak = useAcademicStore((s) => s.streak);

  const selectedTimes = settings.studyPreferences.preferredStudyTimes || [];
  function toggleTime(key) {
    if (selectedTimes.includes(key)) {
      if (selectedTimes.length === 1) return; // always keep at least one selected
      updateStudyPreference("preferredStudyTimes", selectedTimes.filter((k) => k !== key));
    } else {
      if (selectedTimes.length >= 2) return; // cap at two
      updateStudyPreference("preferredStudyTimes", [...selectedTimes, key]);
    }
  }

  const fullStudyDays = settings.studyPreferences.fullStudyDays || [];
  function toggleFullStudyDay(day) {
    updateStudyPreference(
      "fullStudyDays",
      fullStudyDays.includes(day) ? fullStudyDays.filter((d) => d !== day) : [...fullStudyDays, day]
    );
  }

  return (
    <div>
      <Topbar title="Settings" subtitle="Notifications and preferences that shape your study plan." />
      <div className="px-4 sm:px-6 pb-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-5">
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
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 block mb-1">
                Preferred Study Time <span className="font-normal normal-case text-slate-400">(pick 1 or 2)</span>
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TIME_OPTIONS.map(({ key, label }) => {
                  const active = selectedTimes.includes(key);
                  const disabled = !active && selectedTimes.length >= 2;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleTime(key)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-brand-500 text-white shadow-playful"
                          : disabled
                          ? "border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                          : "border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">Study on weekends</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Off skips Saturday and Sunday entirely — your weekly free time (and the plan) only spans Mon-Fri.
                </p>
              </div>
              <Toggle
                checked={settings.studyPreferences.includeWeekends !== false}
                onChange={(v) => updateStudyPreference("includeWeekends", v)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 block mb-1">
                Full Study Days{" "}
                <span className="font-normal normal-case text-slate-400">
                  (each gets a fixed {FULL_STUDY_DAY_WINDOW.start}-{FULL_STUDY_DAY_WINDOW.end} block instead of your usual window — good for catching up)
                </span>
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {WEEKDAYS.map((day) => {
                  const active = fullStudyDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleFullStudyDay(day)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-accent-teal text-white shadow-playful"
                          : "border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
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

      <div className="space-y-6">
        <SettingsRecommendations settings={settings} assignments={assignments} />
        <QuickFacts modules={modules} assignments={assignments} exams={exams} streak={streak} />
      </div>
      </div>
    </div>
  );
}
