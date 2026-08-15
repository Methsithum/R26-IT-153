import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "../../Game/state/GameStateManager";

const ACTIVITIES = [
  { id: "academic_study", label: "University Lectures", icon: "🎓" },
  { id: "assignment_work", label: "Assignment Work", icon: "📝" },
  { id: "exam_preparation", label: "Exam Preparation", icon: "📚" },
  { id: "internship", label: "Internship / Work", icon: "💼" },
  { id: "club_participation", label: "Extracurricular Activities", icon: "🎨" },
  { id: "project_development", label: "Personal Projects", icon: "🛠️" },
  { id: "other", label: "Other University Activities", icon: "📌" },
];

export default function DailyActivitySelection() {
  const navigate = useNavigate();
  const day = useGameStore((s) => s.day);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function handleContinue() {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      await useGameStore.getState().startDailyGame(selected);
      navigate("/journal/game");
    } catch (err) {
      setError(err?.message || "Could not start today's run. Try again.");
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
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mb-1">Day {day}</div>
        <h1 className="text-2xl font-bold mb-2">What did you do today?</h1>
        <p className="text-sm text-stone-600 mb-6">
          Pick everything that applies — today's campus run will focus on these first.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {ACTIVITIES.map((a) => {
            const active = selected.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                  active
                    ? "bg-amber-700 border-amber-800 text-amber-50"
                    : "bg-amber-50 border-amber-800/10 text-stone-700 hover:bg-amber-100"
                }`}
              >
                <span className="text-lg">{a.icon}</span>
                {a.label}
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            ‹ Back to Journal
          </button>
          <button
            onClick={handleContinue}
            disabled={selected.length === 0 || busy}
            className="rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 transition-colors text-amber-50
                       font-semibold px-6 py-3 text-sm shadow"
          >
            {busy ? "Preparing questions…" : "Continue to Campus Run →"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
