import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../../Game/state/GameStateManager";
import { campusDateKey, formatCampusDate, isPastCampusDate } from "../../services/localDate";

export default function DiscardTodayButton({ className = "", date, dayNumber }) {
  const navigate = useNavigate();
  const journalDate = useGameStore((s) => s.journalDate);
  const playDate = useGameStore((s) => s.playDate);
  const storeDay = useGameStore((s) => s.day);
  const targetDate = campusDateKey(date) || journalDate || playDate;
  const catchingUp = isPastCampusDate(targetDate);
  const shortDate = catchingUp
    ? formatCampusDate(targetDate, { weekday: "short", month: "short", day: "numeric" })
    : "today";
  const replayDay = dayNumber || storeDay;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDiscard() {
    if (busy) return;
    const ok = window.confirm(
      catchingUp
        ? `Delete the ${shortDate} journal? Deadlines, marks and exam dates logged in that run will be undone so you can play Day ${replayDay} again.`
        : "Delete today's saved journal? Deadlines, marks and exam dates logged today will be undone so you can play this day again."
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await useGameStore.getState().discardTodayJournal(targetDate);
      navigate("/", { state: { openTab: "roadmap" } });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Could not delete this journal.");
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
        {busy ? "Deleting…" : `Wrong entry — delete & replay ${shortDate}`}
      </button>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
