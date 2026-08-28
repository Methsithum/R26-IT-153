import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGameStore } from "../../Game/state/GameStateManager";
import { useJournalHistoryStore } from "../../Game/state/journalHistoryStore";
import { apiErrorMessage, registerUser } from "../../services/userApi";
import AuthShell, { Field, inputClass } from "./AuthShell";

const YEARS = [1, 2, 3, 4];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    age: "",
    university_name: "",
    degree_name: "",
    campus_year: 1,
    semester: 1,
    gpa: "",
    password: "",
    confirmPassword: "",
  });
  const [subjects, setSubjects] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const needsGpa = !(Number(form.campus_year) === 1 && Number(form.semester) === 1);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setYearOrSemester(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      const firstSemester = Number(next.campus_year) === 1 && Number(next.semester) === 1;
      return firstSemester ? { ...next, gpa: "" } : next;
    });
  }

  function addSubject(raw = draft) {
    const value = raw.trim().replace(/,$/, "");
    if (!value) return;
    setSubjects((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setDraft("");
  }

  function onDraftKey(event) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSubject();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }
    if (subjects.length === 0) {
      setError("Add the subjects you are registered for this semester.");
      return;
    }
    const gpaValue = needsGpa ? Number(form.gpa) : null;
    if (needsGpa && (form.gpa === "" || Number.isNaN(gpaValue) || gpaValue < 0 || gpaValue > 4)) {
      setError("Enter your current GPA between 0.00 and 4.00.");
      return;
    }

    setBusy(true);
    try {
      const user = await registerUser({
        name: form.name.trim(),
        email: form.email.trim(),
        age: Number(form.age),
        university_name: form.university_name.trim(),
        degree_name: form.degree_name.trim(),
        campus_year: Number(form.campus_year),
        semester: Number(form.semester),
        gpa: gpaValue,
        subjects,
        password: form.password,
      });
      useJournalHistoryStore.getState().reset();
      useGameStore.getState().applyUserProgress(user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create your account."));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your Smart Uni Guide account"
      subtitle="Tell us who you are and which modules you're taking this semester."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Student name">
          <input
            required
            className={inputClass}
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Nimali Perera"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="you@university.edu"
          />
        </Field>
        <Field label="Age">
          <input
            required
            type="number"
            min={16}
            max={80}
            className={inputClass}
            value={form.age}
            onChange={(e) => setField("age", e.target.value)}
            placeholder="21"
          />
        </Field>
        <Field label="University name">
          <input
            required
            className={inputClass}
            value={form.university_name}
            onChange={(e) => setField("university_name", e.target.value)}
            placeholder="University of Colombo"
          />
        </Field>
        <Field label="Degree name">
          <input
            required
            className={inputClass}
            value={form.degree_name}
            onChange={(e) => setField("degree_name", e.target.value)}
            placeholder="BSc Computer Science"
          />
        </Field>
        <Field label="Campus year">
          <div className="flex flex-wrap gap-2">
            {YEARS.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setYearOrSemester("campus_year", year)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  form.campus_year === year
                    ? "bg-brand-500 text-white shadow-playful"
                    : "border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                }`}
              >
                Year {year}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Semester">
          <div className="flex gap-2">
            {[1, 2].map((sem) => (
              <button
                key={sem}
                type="button"
                onClick={() => setYearOrSemester("semester", sem)}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  form.semester === sem
                    ? "bg-brand-500 text-white shadow-playful"
                    : "border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                }`}
              >
                Semester {sem}
              </button>
            ))}
          </div>
        </Field>

        {needsGpa && (
          <div className="sm:col-span-2">
            <Field label="Student GPA">
              <input
                required
                type="number"
                min={0}
                max={4}
                step={0.01}
                className={inputClass}
                value={form.gpa}
                onChange={(e) => setField("gpa", e.target.value)}
                placeholder="e.g. 3.45"
              />
              <p className="mt-1 text-xs text-slate-400">Current cumulative GPA, from 0.00 to 4.00.</p>
            </Field>
          </div>
        )}

        <div className="sm:col-span-2">
          <Field label="Currently registered subjects">
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2">
              <div className="mb-2 flex flex-wrap gap-2">
                {subjects.map((subject) => (
                  <span
                    key={subject}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-500/15 px-3 py-1 text-sm text-brand-700 dark:text-brand-300"
                  >
                    {subject}
                    <button
                      type="button"
                      className="text-brand-500/70 hover:text-brand-700 dark:hover:text-brand-300"
                      onClick={() => setSubjects((prev) => prev.filter((item) => item !== subject))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {subjects.length === 0 && (
                  <span className="text-sm text-slate-400">e.g. Operating Systems, Web Development</span>
                )}
              </div>
              <input
                className="w-full border-0 bg-transparent py-1 text-sm text-slate-700 dark:text-white outline-none placeholder:text-slate-400"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onDraftKey}
                onBlur={() => addSubject()}
                placeholder="Type a subject and press Enter"
              />
            </div>
          </Field>
        </div>

        <Field label="Password">
          <input
            required
            type="password"
            minLength={6}
            className={inputClass}
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            placeholder="At least 6 characters"
          />
        </Field>
        <Field label="Confirm password">
          <input
            required
            type="password"
            minLength={6}
            className={inputClass}
            value={form.confirmPassword}
            onChange={(e) => setField("confirmPassword", e.target.value)}
            placeholder="Repeat password"
          />
        </Field>

        {error && <p className="sm:col-span-2 text-sm text-high-600 dark:text-high-500">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="sm:col-span-2 mt-1 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-playful transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
