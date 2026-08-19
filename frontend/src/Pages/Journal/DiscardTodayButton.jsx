import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../../Game/state/GameStateManager";

export default function DiscardTodayButton({ className = "" }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDiscard() {
    if (busy) return;
    const ok = window.confirm(
      "Delete today's saved journal? Deadlines, marks and exam dates logged today will be undone so you can play this day again."
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await useGameStore.getState().discardTodayJournal();
      navigate("/", { state: { openTab: "roadmap" } });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Could not delete today's journal.");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleDiscard}
        disabled={busy}
        className="rounded-lg border border-rose-300/70 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 disabled:opacity-40"
      >
        {busy ? "Deleting…" : "Wrong entry — delete & replay today"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
