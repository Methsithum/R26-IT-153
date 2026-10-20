import { useEffect, useState } from "react";
import { GraduationCap, Check, Loader2 } from "lucide-react";
import { useAcademicStore } from "../../../store/useAcademicStore";
import { NORMAL_SEMESTER_CREDITS, totalCredits } from "../../../utils/semesterSetup";

const ATTEMPT_OPTIONS = [
  { value: 0, label: "First time" },
  { value: 1, label: "Repeat (2nd try)" },
  { value: 2, label: "3rd try or more" },
];

function initialForm(setup, modules) {
  return {
    semester_start: setup?.semester_start || "",
    semester_end: setup?.semester_end || "",
    registered_on: setup?.registered_on || "",
    subjects: Object.fromEntries(
      modules.map((m) => [
        m.name,
        {
          credits: setup?.subjects?.[m.name]?.credits ?? "",
          prev_attempts: setup?.subjects?.[m.name]?.prev_attempts ?? 0,
        },
      ])
    ),
  };
}

/**
 * One-time Semester setup: the real values behind four priority-model
 * features (semester length, registration date, credit load, repeat
 * attempts) that are otherwise neutral placeholders. See
 * utils/semesterSetup.js for how each answer becomes a model feature.
 */
export default function SemesterSetupCard() {
  const userId = useAcademicStore((s) => s.userId);
  const modules = useAcademicStore((s) => s.modules);
  const semesterSetup = useAcademicStore((s) => s.semesterSetup);
  const saveSemesterSetup = useAcademicStore((s) => s.saveSemesterSetup);

  const [form, setForm] = useState(() => initialForm(semesterSetup, modules));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Re-seed only when the saved setup or the SET of subjects changes - not
  // on every `modules` update (it's rebuilt often), which would wipe edits.
  const subjectKey = modules.map((m) => m.name).join("|");
  useEffect(() => {
    setForm(initialForm(semesterSetup, modules));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semesterSetup, subjectKey]);

  // Arriving from the Study Planner's "Semester setup" prompt (#semester-setup).
  useEffect(() => {
    if (window.location.hash === "#semester-setup") {
      document.getElementById("semester-setup")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const setField = (key, value) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const setSubject = (name, key, value) => {
    setSaved(false);
    setForm((f) => ({ ...f, subjects: { ...f.subjects, [name]: { ...f.subjects[name], [key]: value } } }));
  };

  const datesValid = form.semester_start && form.semester_end && form.semester_end > form.semester_start;
  const ready = datesValid && form.registered_on;
  const credits = totalCredits(form);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveSemesterSetup({
        ...form,
        subjects: Object.fromEntries(
          Object.entries(form.subjects).map(([name, s]) => [
            name,
            { credits: Number(s.credits) || 0, prev_attempts: Number(s.prev_attempts) || 0 },
          ])
        ),
      });
      setSaved(true);
    } catch (e) {
      setError(e.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const input =
    "w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-700 dark:text-white";

  return (
    <div id="semester-setup" className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap size={16} className="text-brand-500" />
        <p className="font-display font-bold text-slate-800 dark:text-white">Semester Setup</p>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Used by the priority model, so each assignment's priority reflects your real semester instead of default values.
      </p>

      {!userId ? (
        <p className="text-sm text-slate-500">Log in to save your semester details.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
              Semester starts
              <input type="date" className={`${input} mt-1`} value={form.semester_start} onChange={(e) => setField("semester_start", e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
              Semester ends
              <input type="date" className={`${input} mt-1`} value={form.semester_end} onChange={(e) => setField("semester_end", e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
              You registered on
              <input type="date" className={`${input} mt-1`} value={form.registered_on} onChange={(e) => setField("registered_on", e.target.value)} />
            </label>
          </div>
          {form.semester_start && form.semester_end && !datesValid && (
            <p className="text-xs text-high-600">The end date must be after the start date.</p>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 mb-2">Your subjects</p>
            {modules.length === 0 ? (
              <p className="text-sm text-slate-400">Your subjects appear here once your journal is synced.</p>
            ) : (
              <div className="space-y-2">
                {modules.map((m) => (
                  <div key={m.code} className="grid grid-cols-1 sm:grid-cols-[1fr_96px_170px] gap-2 items-center">
                    <p className="text-sm font-medium text-slate-700 dark:text-white truncate" title={m.name}>{m.name}</p>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      placeholder="Credits"
                      aria-label={`${m.name} credits`}
                      className={input}
                      value={form.subjects[m.name]?.credits ?? ""}
                      onChange={(e) => setSubject(m.name, "credits", e.target.value)}
                    />
                    <select
                      aria-label={`${m.name} attempt`}
                      className={input}
                      value={form.subjects[m.name]?.prev_attempts ?? 0}
                      onChange={(e) => setSubject(m.name, "prev_attempts", Number(e.target.value))}
                    >
                      {ATTEMPT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              Total: {credits} credits (a normal semester load is treated as {NORMAL_SEMESTER_CREDITS}).
            </p>
          </div>

          {error && <p className="text-xs text-high-600">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-low-600">
                <Check size={13} /> Saved - priorities updated
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!ready || saving}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-2xl px-4 py-2 disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
