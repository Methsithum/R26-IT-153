import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../../Game/state/GameStateManager";
import { formatCampusDate, localTodayIso } from "../../services/localDate";
import { apiErrorMessage, readStoredUser } from "../../services/userApi";
import {
  fetchReflectionStatus,
  fetchWeeklyReflections,
  submitWeeklyReflection,
} from "../../services/reflectionApi";

const ACTIVITY_LABEL = {
  academic_study: "Lectures",
  assignment_work: "Assignments",
  exam_preparation: "Exams",
  lab_practical: "Lab",
  quiz_work: "Quiz",
  project_development: "Project",
  internship: "Internship",
  club_participation: "Club",
  event_participation: "Event",
  sports: "Sports",
  other: "Campus",
};

function weekLabel(start, end) {
  if (!start || !end) return "This week";
  const from = formatCampusDate(start, { month: "short", day: "numeric" });
  const to = formatCampusDate(end, { month: "short", day: "numeric" });
  return `${from} — ${to}`;
}

function shiftDate(iso, days) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return iso;
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function Seal({ pulse = false }) {
  return (
    <motion.div
      animate={pulse ? { scale: [1, 1.08, 1], rotate: [0, -6, 4, 0] } : { scale: 1 }}
      transition={pulse ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
      className="relative grid h-16 w-16 place-items-center rounded-full"
      style={{
        background: "radial-gradient(circle at 35% 30%, #fde68a, #b45309 58%, #3f1f0a)",
        boxShadow: "0 10px 22px rgba(180,83,9,0.4), inset 0 1px 0 rgba(255,255,255,0.35)",
      }}
    >
      <span className="text-xl leading-none text-amber-50">✉</span>
    </motion.div>
  );
}

function LetterPage({ title, kicker, narrative, highlights, onBack, onRewrite, rewriting }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, rotate: 0.6 }}
      animate={{ opacity: 1, y: 0, rotate: -0.35 }}
      className="relative mx-auto max-w-2xl overflow-hidden rounded-sm border border-amber-900/15 bg-[#fffaf0] px-6 py-7 shadow-xl sm:px-10 sm:py-9"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(180,83,9,0.05), transparent 18%), repeating-linear-gradient(#fffaf0 0 34px, #f3e6c8 34px 35px)",
      }}
    >
      <div className="absolute right-6 top-6">
        <Seal pulse={rewriting} />
      </div>
      <div className="text-[11px] uppercase tracking-[0.28em] text-amber-800/70">{kicker}</div>
      <h3 className="mt-2 max-w-[85%] font-serif text-3xl font-semibold text-stone-800">{title}</h3>
      <p className="mt-6 max-w-xl font-serif text-[17px] leading-8 text-stone-700">{narrative}</p>
      {highlights?.length > 0 && (
        <ul className="mt-6 space-y-2 border-t border-amber-900/10 pt-5">
          {highlights.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-stone-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-700" />
              {item}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-700"
        >
          Close the letter
        </button>
        {onRewrite && (
          <button
            type="button"
            disabled={rewriting}
            onClick={onRewrite}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50"
          >
            {rewriting ? "Rewriting from this week…" : "Regenerate from this week’s runs"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function ComposingOverlay({ label }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 grid place-items-center bg-[#f5ecd9]/88 backdrop-blur-[2px]"
    >
      <div className="text-center">
        <Seal pulse />
        <p className="mt-4 font-serif text-xl text-stone-800">Ink is finding the week</p>
        <p className="mt-1 text-sm text-stone-500">{label}</p>
      </div>
    </motion.div>
  );
}

export default function ReflectionsPage() {
  const playerName = useGameStore((s) => s.playerName);
  const today = localTodayIso();
  const [anchorDate, setAnchorDate] = useState(today);
  const [status, setStatus] = useState(null);
  const [weeklyList, setWeeklyList] = useState([]);
  const [reading, setReading] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const userId = readStoredUser()?.id;

  const load = async (date = anchorDate) => {
    if (!userId) return;
    const [nextStatus, weekly] = await Promise.all([
      fetchReflectionStatus(userId, date),
      fetchWeeklyReflections(userId),
    ]);
    setStatus(nextStatus);
    setWeeklyList(weekly);
    if (nextStatus?.week_start && nextStatus.week_start !== date) {
      setAnchorDate(nextStatus.week_start);
    }
  };

  useEffect(() => {
    load(anchorDate).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, anchorDate]);

  const selectedLabel = weekLabel(status?.week_start, status?.week_end);
  const existing = status?.weekly?.existing;
  const sessions = status?.sessions || [];
  const locked = !status?.weekly?.available;
  const atCurrentWeek = status?.week_end && status.week_end >= today;

  const readingMeta = useMemo(() => {
    if (!reading) return null;
    return {
      title: "A letter from the week",
      kicker: weekLabel(reading.week_start, reading.week_end),
    };
  }, [reading]);

  async function generateLetter() {
    if (!status?.week_start || locked) return;
    setSubmitting(true);
    setError("");
    try {
      const page = await submitWeeklyReflection({
        userId,
        weekStart: status.week_start,
        weekEnd: status.week_end,
      });
      await load(status.week_start);
      setReading(page);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not seal this week's letter."));
    } finally {
      setSubmitting(false);
    }
  }

  if (reading && readingMeta) {
    return (
      <div className="relative h-full min-h-0">
        <LetterPage
          title={readingMeta.title}
          kicker={readingMeta.kicker}
          narrative={reading.narrative}
          highlights={reading.highlights}
          rewriting={submitting}
          onRewrite={generateLetter}
          onBack={() => setReading(null)}
        />
        <AnimatePresence>{submitting && <ComposingOverlay label={selectedLabel} />}</AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">Quiet pages</div>
      <h2 className="mt-1 font-serif text-3xl font-semibold text-stone-800">Weekly letter</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
        No extra form. Pick a week — the letter is written from the campus days you already ran.
        {playerName ? ` ${playerName}, this desk is yours.` : ""}
      </p>

      <div className="mt-5 rounded-sm border border-amber-900/15 bg-[#fffaf0]/80 p-4 shadow-sm">
        <div className="text-[11px] uppercase tracking-[0.22em] text-amber-800/70">Choose a week</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchorDate((current) => shiftDate(current, -7))}
            className="rounded-md border border-amber-900/15 px-3 py-1.5 text-sm text-stone-700 hover:bg-amber-50"
          >
            ← Previous
          </button>
          <input
            type="date"
            value={anchorDate}
            max={today}
            onChange={(e) => setAnchorDate(e.target.value || today)}
            className="rounded-md border border-amber-900/20 bg-white px-3 py-1.5 text-sm text-stone-800"
          />
          <button
            type="button"
            disabled={atCurrentWeek}
            onClick={() =>
              setAnchorDate((current) => {
                const next = shiftDate(current, 7);
                return next > today ? today : next;
              })
            }
            className="rounded-md border border-amber-900/15 px-3 py-1.5 text-sm text-stone-700 hover:bg-amber-50 disabled:opacity-40"
          >
            Next →
          </button>
          <button
            type="button"
            onClick={() => setAnchorDate(today)}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-50"
          >
            This week
          </button>
        </div>
        {(status?.weeks || []).length > 0 && (
          <label className="mt-3 block">
            <div className="mb-1 text-xs text-stone-500">Weeks with campus journals</div>
            <select
              value={status?.week_start || ""}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="w-full max-w-md rounded-md border border-amber-900/20 bg-white px-3 py-2 text-sm text-stone-800"
            >
              {(status.weeks || []).map((week) => (
                <option key={week.week_start} value={week.week_start}>
                  {weekLabel(week.week_start, week.week_end)} · {week.journal_count} day
                  {week.journal_count === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="relative mt-5 min-h-0 flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-sm border border-amber-900/15 shadow-lg"
          style={{
            background: "linear-gradient(180deg, #fffaf0 0%, #f4e6c8 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-amber-900/10 px-5 py-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-amber-800/70">Ink from the runs</div>
              <h3 className="mt-1 font-serif text-2xl text-stone-900">{selectedLabel}</h3>
              <p className="mt-1 text-xs text-stone-500">
                {sessions.length} campus day{sessions.length === 1 ? "" : "s"} in this week
              </p>
            </div>
            <Seal pulse={submitting} />
          </div>

          {locked ? (
            <p className="px-5 py-8 text-sm leading-relaxed text-stone-600">{status?.weekly?.reason}</p>
          ) : (
            <div className="px-5 py-4">
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={`${session.date}-${session.excerpt}`}
                    className="rounded-md border border-amber-900/10 bg-white/50 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-amber-900">
                        {formatCampusDate(session.date, { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      {(session.activities || []).slice(0, 3).map((activity) => (
                        <span
                          key={activity}
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-900"
                        >
                          {ACTIVITY_LABEL[activity] || activity}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 font-serif text-sm leading-relaxed text-stone-700">{session.excerpt}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col items-center gap-2 border-t border-dashed border-amber-900/20 pt-5 pb-2">
                {existing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setReading(existing)}
                      className="rounded-full bg-amber-800 px-6 py-2.5 text-sm font-semibold text-amber-50 shadow hover:bg-amber-700"
                    >
                      Open this week’s letter
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={generateLetter}
                      className="text-xs font-semibold text-amber-900 hover:underline disabled:opacity-50"
                    >
                      Regenerate from these runs
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={generateLetter}
                    className="rounded-full bg-amber-800 px-7 py-3 text-sm font-semibold text-amber-50 shadow-lg hover:bg-amber-700 disabled:opacity-60"
                  >
                    {submitting ? "Sealing the letter…" : "Seal this week’s letter"}
                  </button>
                )}
                <p className="max-w-md text-center text-[11px] text-stone-500">
                  Written automatically from the days above. You don’t fill anything in.
                </p>
                {error && <p className="text-sm text-rose-700">{error}</p>}
              </div>
            </div>
          )}
        </motion.div>

        {weeklyList.length > 0 && (
          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">Sealed letters</div>
            <div className="mt-3 space-y-2">
              {weeklyList.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setAnchorDate(item.week_start);
                    setReading(item);
                  }}
                  className="flex w-full items-center gap-3 rounded-md border border-amber-900/10 bg-[#fffaf0]/80 px-3 py-2.5 text-left hover:bg-amber-50"
                >
                  <span className="text-lg">✉️</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-stone-800">
                      {weekLabel(item.week_start, item.week_end)}
                    </span>
                    <span className="block truncate text-xs text-stone-500">{item.narrative}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>{submitting && !reading && <ComposingOverlay label={selectedLabel} />}</AnimatePresence>
    </div>
  );
}
