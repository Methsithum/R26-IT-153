import { useState } from "react";
import { ArrowLeft, Check, Pencil, LogOut, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Topbar from "../../Components/academic/Layout/Topbar";
import { useAcademicStore } from "../../store/useAcademicStore";
import { clearStoredUser } from "../../services/userApi";
import { useJournalHistoryStore } from "../../Game/state/journalHistoryStore";

export default function Profile() {
  const navigate = useNavigate();
  const profile = useAcademicStore((s) => s.profile);
  const updateProfile = useAcademicStore((s) => s.updateProfile);
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleEdit() {
    setForm(profile);
    setIsEditing(true);
  }

  function handleCancel() {
    setForm(profile);
    setIsEditing(false);
  }

  function handleSave(e) {
    e.preventDefault();
    updateProfile(form);
    setSaved(true);
    setIsEditing(false);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSignOut() {
    clearStoredUser();
    useJournalHistoryStore.getState().reset();
    navigate("/login", { replace: true });
  }

  return (
    <div>
      <Topbar title="Student Profile" />
      <div className="px-4 sm:px-6 pb-10 max-w-xl">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-brand-600">
            <ArrowLeft size={15} /> Back
          </button>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-high-600 hover:text-high-700 bg-high-50 dark:bg-high-500/10 rounded-full px-3.5 py-1.5 transition-colors"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>

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
          <div className="flex items-center justify-between">
            <p className="font-display font-bold text-slate-800 dark:text-white">Details</p>
            {!isEditing && (
              <button
                type="button"
                onClick={handleEdit}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 bg-brand-50 dark:bg-brand-500/15 rounded-full px-3 py-1.5 transition-colors"
              >
                <Pencil size={13} /> Edit Details
              </button>
            )}
          </div>

          <Field label="Full Name">
            <input className="input disabled:opacity-60 disabled:cursor-not-allowed" disabled={!isEditing} value={form.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Student ID">
            <input className="input disabled:opacity-60 disabled:cursor-not-allowed" disabled={!isEditing} value={form.studentId} onChange={(e) => update("studentId", e.target.value)} />
          </Field>
          <Field label="University">
            <input className="input disabled:opacity-60 disabled:cursor-not-allowed" disabled={!isEditing} value={form.university || ""} onChange={(e) => update("university", e.target.value)} />
          </Field>
          <Field label="Degree">
            <input className="input disabled:opacity-60 disabled:cursor-not-allowed" disabled={!isEditing} value={form.degree} onChange={(e) => update("degree", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Year">
              <input type="number" min={1} max={6} className="input disabled:opacity-60 disabled:cursor-not-allowed" disabled={!isEditing} value={form.year} onChange={(e) => update("year", Number(e.target.value))} />
            </Field>
            <Field label="Semester">
              <input type="number" min={1} max={2} className="input disabled:opacity-60 disabled:cursor-not-allowed" disabled={!isEditing} value={form.semester} onChange={(e) => update("semester", Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Target GPA">
            <input type="number" step="0.01" min={0} max={4} className="input disabled:opacity-60 disabled:cursor-not-allowed" disabled={!isEditing} value={form.targetGpa} onChange={(e) => update("targetGpa", Number(e.target.value))} />
          </Field>
          <Field label="Available Study Hours / Week">
            <input type="number" min={0} className="input disabled:opacity-60 disabled:cursor-not-allowed" disabled={!isEditing} value={form.availableStudyHoursPerWeek} onChange={(e) => update("availableStudyHoursPerWeek", Number(e.target.value))} />
          </Field>

          {isEditing && (
            <div className="flex items-center gap-3">
              <button type="submit" className="flex-1 flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-2xl py-3 transition-colors">
                {saved ? <Check size={16} /> : null} {saved ? "Saved" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl px-4 py-3 transition-colors"
              >
                <X size={15} /> Cancel
              </button>
            </div>
          )}
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
