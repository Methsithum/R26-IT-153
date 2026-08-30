import { useEffect, useState } from "react";
import { formatCampusDate, localTodayIso } from "../../services/localDate";
import { splitJournalParagraphs } from "../../Game/data/journalNarrative";
import { apiErrorMessage, readStoredUser } from "../../services/userApi";
import {
  fetchReflectionStatus,
  fetchWeeklyReflections,
  submitWeeklyReflection,
} from "../../services/reflectionApi";

function oldestFirst(list) {
  return [...(list || [])].sort((a, b) =>
    String(a.week_start).localeCompare(String(b.week_start))
  );
}

function shiftIso(iso, days) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return iso;
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function weekDateLine(start, end) {
  if (!start || !end) return "";
  return `${formatCampusDate(start, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })} — ${formatCampusDate(end, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;
}

function shortWeekLabel(start, end) {
  if (!start || !end) return "This week";
  return `${formatCampusDate(start, { month: "short", day: "numeric" })} — ${formatCampusDate(end, { month: "short", day: "numeric" })}`;
}

export default function ReflectionsPage() {
  const today = localTodayIso();
  const userId = readStoredUser()?.id;
  const [current, setCurrent] = useState(null);
  const [pickedDate, setPickedDate] = useState(today);
  const [letter, setLetter] = useState(null);
  const [dayCount, setDayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");

  async function applyStatus(status, saved = []) {
    const week = {
      week_start: status.week_start,
      week_end: status.week_end,
      journal_count: status?.weekly?.journal_count || 0,
    };
    setCurrent(week);
    setPickedDate(status.date || week.week_start);
    setLetter(
      status?.weekly?.existing ||
        saved.find((item) => item.week_start === week.week_start) ||
        null
    );
    setDayCount(status?.weekly?.journal_count || 0);
  }

  async function loadByDate(iso) {
    if (!userId || !iso) return;
    const status = await fetchReflectionStatus(userId, iso);
    await applyStatus(status);
  }

  async function pickDate(iso) {
    if (!iso) return;
    setError("");
    try {
      await loadByDate(iso);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not open that week."));
    }
  }

  function stepWeek(days) {
    const from = current?.week_start || pickedDate;
    if (!from) return;
    pickDate(shiftIso(from, days));
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [status, saved] = await Promise.all([
          fetchReflectionStatus(userId, today),
          fetchWeeklyReflections(userId),
        ]);
        if (cancelled) return;
        const list = oldestFirst(status?.weeks);
        if (!list.length) {
          await applyStatus(status, saved);
          return;
        }
        const latest = list[list.length - 1];
        const open = await fetchReflectionStatus(userId, latest.week_start);
        if (cancelled) return;
        await applyStatus(open, saved);
      } catch {
        if (!cancelled) setError("Could not load weekly letters.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, today]);

  async function writeWeek() {
    if (!current || writing) return;
    setWriting(true);
    setError("");
    try {
      const page = await submitWeeklyReflection({
        userId,
        weekStart: current.week_start,
        weekEnd: current.week_end,
      });
      setLetter(page);
      await loadByDate(current.week_start);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not write this week's letter."));
    } finally {
      setWriting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col justify-center max-w-lg">
        <h2 className="font-display text-2xl font-bold text-slate-800 dark:text-white mb-2">Weekly letter</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">Opening this week’s page…</p>
      </div>
    );
  }

  const nextWeekStart = current?.week_start ? shiftIso(current.week_start, 7) : "";
  const canGoNext = Boolean(nextWeekStart) && nextWeekStart <= today;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-brand-500 dark:text-brand-300">Weekly letter</div>
          <h2 className="font-journal text-[1.65rem] font-medium tracking-tight text-slate-800 dark:text-white">
            {shortWeekLabel(current?.week_start, current?.week_end)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            type="date"
            value={pickedDate || ""}
            max={today}
            onChange={(event) => pickDate(event.target.value)}
            aria-label="Pick a date in the week"
            className="h-8 rounded-full border border-brand-200 dark:border-white/15 bg-transparent px-3 text-xs text-slate-600 dark:text-slate-300"
          />
          <button
            type="button"
            disabled={!current?.week_start}
            onClick={() => stepWeek(-7)}
            className="rounded-full border border-brand-200 dark:border-white/15 px-3 py-1 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-brand-50 dark:hover:bg-white/10"
          >
            ‹
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => stepWeek(7)}
            className="rounded-full border border-brand-200 dark:border-white/15 px-3 py-1 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-brand-50 dark:hover:bg-white/10"
          >
            ›
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="text-xs text-slate-400 mb-4 italic">
          {weekDateLine(current?.week_start, current?.week_end)}
        </div>

        {letter ? (
          <>
            <div className="journal-letter mb-6">
              {splitJournalParagraphs(letter.narrative).map((paragraph, i) => (
                <p key={`${i}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}
            </div>
            {(letter.highlights || []).length > 0 && (
              <div className="mb-6 rounded-2xl border border-brand-100 dark:border-white/10 bg-brand-50/80 dark:bg-white/5 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300 mb-2">
                  Week at a glance
                </div>
                <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                  {letter.highlights.map((item, i) => (
                    <li key={`${item}-${i}`} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              disabled={writing}
              onClick={writeWeek}
              className="text-xs text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 hover:underline disabled:opacity-50"
            >
              {writing ? "Rewriting…" : "Rewrite from this week’s runs"}
            </button>
          </>
        ) : dayCount > 0 ? (
          <div className="max-w-lg">
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-300 mb-5">
              {dayCount} campus day{dayCount === 1 ? "" : "s"} from this week can become a letter. It is written for you from those runs.
            </p>
            <button
              type="button"
              disabled={writing}
              onClick={writeWeek}
              className="rounded-2xl bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-600 hover:to-brand-500 text-white font-semibold px-5 py-2.5 text-sm shadow-playful disabled:opacity-60"
            >
              {writing ? "Writing…" : "Write this week"}
            </button>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-300 max-w-lg">
            No campus journal in this week yet. Pick another date, or finish a run first.
          </p>
        )}
        {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
      </div>
    </div>
  );
}
