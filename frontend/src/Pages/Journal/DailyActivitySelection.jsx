import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../../Game/state/GameStateManager";
import { readStoredUser } from "../../services/userApi";

const ACTIVITIES = [
  { id: "academic_study", label: "University Lectures", icon: "🎓" },
  { id: "assignment_work", label: "Assignment Work", icon: "📝" },
  { id: "exam_preparation", label: "Exam Preparation", icon: "📚" },
  { id: "internship", label: "Internship / Work", icon: "💼" },
  { id: "club_participation", label: "Extracurricular Activities", icon: "🎨" },
  { id: "project_development", label: "Personal Projects", icon: "🛠️" },
  { id: "other", label: "Other University Activities", icon: "📌" },
];

function StepDots({ step, total }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === step ? "w-8 bg-amber-800" : i < step ? "w-5 bg-amber-700/50" : "w-5 bg-stone-300"
          }`}
        />
      ))}
    </div>
  );
}

export default function DailyActivitySelection() {
  const navigate = useNavigate();
  const day = useGameStore((s) => s.day);
  const dailyCompleted = useGameStore((s) => s.dailyCompleted);
  const storeSubjects = useGameStore((s) => s.subjects);
  const registeredSubjects = useMemo(() => {
    if (storeSubjects?.length) return storeSubjects;
    return readStoredUser()?.subjects || [];
  }, [storeSubjects]);

  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState([]);
  const [todaySubjects, setTodaySubjects] = useState([]);
  const [examKinds, setExamKinds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsExamKinds = selected.includes("exam_preparation");
  const totalSteps = needsExamKinds ? 3 : 2;

  function toggle(list, id, setter) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function nextStep() {
    setError("");
    if (step === 0 && selected.length === 0) {
      setError("Pick at least one activity from today.");
      return;
    }
    if (step === 1 && todaySubjects.length === 0) {
      setError("Choose the subject(s) you worked on today.");
      return;
    }
    if (step === 1 && !needsExamKinds) {
      handleContinue();
      return;
    }
    setStep((s) => s + 1);
  }

  async function handleContinue() {
    if (busy) return;
    if (needsExamKinds && examKinds.length === 0) {
      setError("Choose Mid, Final, or both for today's exam prep.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await useGameStore.getState().startDailyGame({
        activities: selected,
        todaySubjects,
        examKinds: needsExamKinds ? examKinds : [],
      });
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
        {dailyCompleted ? (
          <div className="mt-2">
            <h1 className="text-2xl font-bold mb-2">Today’s journal is already saved</h1>
            <p className="text-sm text-stone-600 mb-6">
              Come back tomorrow for the next campus day. Refreshing will keep you on Day {day}.
            </p>
            <button
              onClick={() => navigate("/")}
              className="rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 font-semibold px-6 py-3 text-sm"
            >
              Return to Journal
            </button>
          </div>
        ) : (
          <>
        <StepDots step={step} total={totalSteps} />

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="activities" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <h1 className="text-2xl font-bold mb-2">What did you do today?</h1>
              <p className="text-sm text-stone-600 mb-6">
                Pick everything that applies — today's campus run will focus on these first.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACTIVITIES.map((a) => {
                  const active = selected.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggle(selected, a.id, setSelected)}
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
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="subjects" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <h1 className="text-2xl font-bold mb-2">Which subject(s) today?</h1>
              <p className="text-sm text-stone-600 mb-6">
                Only the modules you registered. Assignments and exams will bind to these.
              </p>
              {registeredSubjects.length === 0 ? (
                <p className="text-sm text-red-700">
                  No campus subjects on this account. Register again with your module list.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {registeredSubjects.map((subject) => {
                    const active = todaySubjects.includes(subject);
                    return (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => toggle(todaySubjects, subject, setTodaySubjects)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-amber-800 border-amber-900 text-amber-50"
                            : "bg-amber-50 border-amber-800/15 text-stone-700 hover:bg-amber-100"
                        }`}
                      >
                        {subject}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="exams" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <h1 className="text-2xl font-bold mb-2">Exam preparation</h1>
              <p className="text-sm text-stone-600 mb-6">
                Mid, Final, or both — Exam Hall will only ask for dates you have not set yet.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "mid", label: "Mid", hint: "Mid-semester paper" },
                  { id: "final", label: "Final", hint: "End-semester paper" },
                ].map((kind) => {
                  const active = examKinds.includes(kind.id);
                  return (
                    <button
                      key={kind.id}
                      type="button"
                      onClick={() => toggle(examKinds, kind.id, setExamKinds)}
                      className={`rounded-xl border px-4 py-5 text-left transition-colors ${
                        active
                          ? "bg-amber-800 border-amber-900 text-amber-50"
                          : "bg-amber-50 border-amber-800/15 text-stone-700 hover:bg-amber-100"
                      }`}
                    >
                      <div className="text-lg font-semibold">{kind.label}</div>
                      <div className={`text-xs mt-1 ${active ? "text-amber-100/80" : "text-stone-500"}`}>
                        {kind.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
              {todaySubjects.length > 0 && (
                <p className="mt-4 text-xs text-stone-500">
                  For {todaySubjects.join(", ")}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="text-sm text-red-700 mt-5">{error}</p>}

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => {
              setError("");
              if (step === 0) navigate("/");
              else setStep((s) => s - 1);
            }}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            {step === 0 ? "‹ Back to Journal" : "‹ Back"}
          </button>
          <button
            onClick={step === totalSteps - 1 ? handleContinue : nextStep}
            disabled={busy}
            className="rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 transition-colors text-amber-50
                       font-semibold px-6 py-3 text-sm shadow"
          >
            {busy
              ? "Preparing questions…"
              : step === totalSteps - 1
                ? "Continue to Campus Run →"
                : "Next →"}
          </button>
        </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
