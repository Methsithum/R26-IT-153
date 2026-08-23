import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Topbar from "../../Components/academic/Layout/Topbar";
import { useAcademicStore } from "../../store/useAcademicStore";

export default function Profile() {
  const navigate = useNavigate();
  const profile = useAcademicStore((s) => s.profile);
  const updateProfile = useAcademicStore((s) => s.updateProfile);
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleSave(e) {
    e.preventDefault();
    updateProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <Topbar title="Student Profile" />
      <div className="px-4 sm:px-6 pb-10 max-w-xl">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-brand-600 mb-4">
          <ArrowLeft size={15} /> Back
        </button>

        <div className="card p-6 mb-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-teal to-brand-400 flex items-center justify-center text-white font-bold text-xl">
            {form.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <p className="font-display font-bold text-lg text-slate-800 dark:text-white">{form.name}</p>
            <p className="text-sm text-slate-400">{form.studentId}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="card p-6 space-y-4">
          <Field label="Full Name">
            <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Student ID">
            <input className="input" value={form.studentId} onChange={(e) => update("studentId", e.target.value)} />
          </Field>
          <Field label="Degree">
            <input className="input" value={form.degree} onChange={(e) => update("degree", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Year">
              <input type="number" min={1} max={6} className="input" value={form.year} onChange={(e) => update("year", Number(e.target.value))} />
            </Field>
            <Field label="Semester">
              <input type="number" min={1} max={2} className="input" value={form.semester} onChange={(e) => update("semester", Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Target GPA">
            <input type="number" step="0.01" min={0} max={4} className="input" value={form.targetGpa} onChange={(e) => update("targetGpa", Number(e.target.value))} />
          </Field>
          <Field label="Available Study Hours / Week">
            <input type="number" min={0} className="input" value={form.availableStudyHoursPerWeek} onChange={(e) => update("availableStudyHoursPerWeek", Number(e.target.value))} />
          </Field>

          <button type="submit" className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-2xl py-3 transition-colors">
            {saved ? <Check size={16} /> : null} {saved ? "Saved" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 block mb-1">{label}</label>
      {children}
    </div>
  );
}
