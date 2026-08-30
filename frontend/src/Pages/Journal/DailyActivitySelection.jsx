import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import { useGameStore } from "../../Game/state/GameStateManager";
import { unlockAudio } from "../../Game/audio/sfx";
import { apiErrorMessage } from "../../services/userApi";
import { formatCampusDate, isPastCampusDate, localTodayIso } from "../../services/localDate";
import DiscardTodayButton from "./DiscardTodayButton";
import JournalShell from "./JournalShell";

const ACTIVITIES = [
  { id: "academic_study", label: "University Lectures", icon: "🎓" },
  { id: "assignment_work", label: "Assignment Work", icon: "📝" },
  { id: "exam_preparation", label: "Exam Preparation", icon: "📚" },
  { id: "lab_practical", label: "Lab / Practical", icon: "🔬" },
  { id: "quiz_work", label: "Quiz", icon: "📋" },
  { id: "internship", label: "Internship / Work", icon: "💼" },
  { id: "club_participation", label: "Extracurricular Activities", icon: "🎨" },
  { id: "project_development", label: "Personal Projects", icon: "🛠️" },
  { id: "other", label: "Other University Activities", icon: "📌" },
];

export default function DailyActivitySelection() {
  const navigate = useNavigate();
  const day = useGameStore((s) => s.day);
  const dailyCompleted = useGameStore((s) => s.dailyCompleted);
  const playDate = useGameStore((s) => s.playDate);
  const missedDates = useGameStore((s) => s.missedDates);
  const catchingUp = (missedDates || []).length > 0 || isPastCampusDate(playDate);
  const playLabel = formatCampusDate(playDate);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    useGameStore.setState({ restarting: false, paused: false });
    const { sessionId, sessionCompleted } = useGameStore.getState();
    if (!sessionId || sessionCompleted) return undefined;
    let cancelled = false;
    setBusy(true);
    useGameStore
      .getState()
      .abandonCurrentRun()
      .catch((err) => {
        if (!cancelled) {
          setError(apiErrorMessage(err, "Could not clear the previous run. Try again."));
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id) {
    unlockAudio();
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function handleContinue() {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      await unlockAudio();
      await useGameStore.getState().startDailyGame({ activities: selected });
      navigate("/journal/game");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not start this day's run. Try again."));
      setBusy(false);
    }
  }

  const journalHome = { pathname: "/journal", state: { openTab: "roadmap" } };

  return (
    <JournalShell
      title={catchingUp ? `Catch-up · Day ${day}` : `Day ${day}`}
      subtitle={catchingUp ? `This run will be saved as ${playLabel}.` : "Pick everything you did — then head into campus."}
      aside={
        <button
          type="button"
          onClick={() => navigate("/journal")}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-slate-500 shadow-card ring-1 ring-black/5 hover:text-brand-600 hover:ring-brand-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Journal
        </button>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mx-auto w-full max-w-3xl p-6 sm:p-8"
      >
          {dailyCompleted && !catchingUp ? (
            <div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-white/10 dark:text-brand-300">
                <Sparkles size={22} />
              </div>
              <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-white mb-2">
                Today’s journal is already saved
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-300 mb-6 max-w-xl">
                Come back tomorrow for the next campus day. If today’s answers were wrong, delete this journal and play Day {day} again.
              </p>
              <div className="flex flex-col items-start gap-3">
                <button
                  onClick={() => navigate(journalHome.pathname, { state: journalHome.state })}
                  className="rounded-2xl bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-600 hover:to-brand-500 text-white font-semibold px-6 py-3 text-sm shadow-playful transition-all"
                >
                  Return to Journal
                </button>
                <DiscardTodayButton date={localTodayIso()} />
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-white mb-2">
                {catchingUp ? `What did you do on ${playLabel}?` : "What did you do today?"}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-300 mb-6 max-w-2xl">
                {catchingUp
                  ? `This run is Day ${day} and will be saved as ${playLabel}, not today. After you finish, today's day will still be waiting.`
                  : "Pick everything that applies. Subjects, deadlines and exam dates are asked inside the campus run — only if they are still missing."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACTIVITIES.map((activity) => {
                  const active = selected.includes(activity.id);
                  return (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => toggle(activity.id)}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all ${
                        active
                          ? "bg-gradient-to-r from-brand-500 to-brand-400 border-transparent text-white shadow-playful"
                          : "bg-white dark:bg-white/5 border-brand-100 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-white/10"
                      }`}
                    >
                      <span className="text-lg leading-none">{activity.icon}</span>
                      <span className="flex-1">{activity.label}</span>
                      {active && <Check size={16} strokeWidth={2.6} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {error && <p className="text-sm text-high-600 mt-5">{error}</p>}
              <div className="flex items-center justify-between mt-8 gap-3">
                <button
                  onClick={() => navigate("/journal")}
                  className="text-sm text-slate-400 hover:text-brand-600 dark:hover:text-brand-300"
                >
                  ‹ Back to Journal
                </button>
                <button
                  onClick={handleContinue}
                  disabled={selected.length === 0 || busy}
                  className="rounded-2xl bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-600 hover:to-brand-500 disabled:opacity-40 transition-all text-white
                             font-semibold px-6 py-3 text-sm shadow-playful"
                >
                  {busy ? "Preparing questions…" : catchingUp ? "Continue catch-up run →" : "Continue to Campus Run →"}
                </button>
              </div>
            </>
        )}
      </motion.div>
    </JournalShell>
  );
}
