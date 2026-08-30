import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "../../Game/state/GameStateManager";
import { unlockAudio } from "../../Game/audio/sfx";
import { apiErrorMessage } from "../../services/userApi";
import { formatCampusDate, isPastCampusDate, localTodayIso } from "../../services/localDate";
import DiscardTodayButton from "./DiscardTodayButton";

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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#5b3a24] to-[#3a2415] flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-md shadow-2xl border border-black/20 bg-[#f5ecd9] text-stone-800 p-6 sm:p-8"
      >
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mb-1">
          {catchingUp ? `Catch-up · Day ${day}` : `Day ${day}`}
        </div>
        {dailyCompleted && !catchingUp ? (
          <div className="mt-2">
            <h1 className="text-2xl font-bold mb-2">Today’s journal is already saved</h1>
            <p className="text-sm text-stone-600 mb-6">
              Come back tomorrow for the next campus day. If today’s answers were wrong, delete this journal and play Day {day} again.
            </p>
            <div className="flex flex-col items-start gap-3">
              <button
                onClick={() => navigate("/")}
                className="rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 font-semibold px-6 py-3 text-sm"
              >
                Return to Journal
              </button>
              <DiscardTodayButton date={localTodayIso()} />
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">
              {catchingUp ? `What did you do on ${playLabel}?` : "What did you do today?"}
            </h1>
            <p className="text-sm text-stone-600 mb-6">
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
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      active
                        ? "bg-amber-700 border-amber-800 text-amber-50"
                        : "bg-amber-50 border-amber-800/10 text-stone-700 hover:bg-amber-100"
                    }`}
                  >
                    <span className="text-lg">{activity.icon}</span>
                    {activity.label}
                  </button>
                );
              })}
            </div>
            {error && <p className="text-sm text-red-700 mt-5">{error}</p>}
            <div className="flex items-center justify-between mt-8">
              <button onClick={() => navigate("/")} className="text-sm text-stone-500 hover:text-stone-700">
                ‹ Back to Journal
              </button>
              <button
                onClick={handleContinue}
                disabled={selected.length === 0 || busy}
                className="rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 transition-colors text-amber-50
                           font-semibold px-6 py-3 text-sm shadow"
              >
                {busy ? "Preparing questions…" : catchingUp ? "Continue catch-up run →" : "Continue to Campus Run →"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
