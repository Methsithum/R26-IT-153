import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGameStore } from "../../Game/state/GameStateManager";
import { useJournalHistoryStore } from "../../Game/state/journalHistoryStore";
import { apiErrorMessage, loginUser } from "../../services/userApi";
import AuthShell, { Field, inputClass } from "./AuthShell";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const user = await loginUser(email.trim(), password);
      useJournalHistoryStore.getState().reset();
      useGameStore.getState().applyUserProgress(user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "Invalid email or password."));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue from the day you last completed."
      footer={
        <>
          New student?{" "}
          <Link to="/register" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        <Field label="Email">
          <input
            required
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
          />
        </Field>
        <Field label="Password">
          <input
            required
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </Field>
        {error && <p className="text-sm text-high-600 dark:text-high-500">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-playful transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
