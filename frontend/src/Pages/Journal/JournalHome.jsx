import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Feather,
  History,
  Map,
  MapPin,
  NotebookPen,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useGameStore } from "../../Game/state/GameStateManager";
import { useJournalHistoryStore } from "../../Game/state/journalHistoryStore";
import { buildJournalPage, splitJournalParagraphs } from "../../Game/data/journalNarrative";
import { BADGE_CATALOG, XP_PER_LEVEL, isBadgeUnlocked, xpIntoLevel, xpToNextLevel } from "../../Game/data/progression";
import LevelRing from "../../Game/UI/LevelRing";
import { campusDateKey, formatCampusDate } from "../../services/localDate";
import { formatExamMark } from "../../Game/data/letterGrades";
import DiscardTodayButton from "./DiscardTodayButton";
import CampusMapsPage from "./CampusMapsPage";
import ReflectionsPage from "./ReflectionsPage";
import JournalShell from "./JournalShell";

const TABS = [
  { id: "open", label: "Open Journal", icon: BookOpen },
  { id: "roadmap", label: "Game Roadmap", icon: Map },
  { id: "maps", label: "Campus Maps", icon: MapPin },
  { id: "recent", label: "Recent Journals", icon: History },
  { id: "reflect", label: "Reflections", icon: Feather },
  { id: "details", label: "Game Details", icon: Sparkles },
  { id: "stats", label: "Character Stats", icon: UserRound },
];

function Page({ children }) {
  return (
    <div
      className="relative flex h-full min-h-0 flex-1 min-w-0 bg-white dark:bg-[#1a1530] text-slate-800 dark:text-slate-100
                 px-6 py-7 sm:px-10 sm:py-9 lg:px-12 lg:py-10 overflow-hidden"
      style={{
        backgroundImage:
          "repeating-linear-gradient(transparent 0 34px, rgb(124 58 237 / 0.07) 34px 35px)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at 18% 8%, rgba(124,58,237,0.09), transparent 42%), radial-gradient(ellipse at 88% 92%, rgba(236,72,153,0.07), transparent 46%)",
        }}
      />
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-y-auto pb-4 scrollbar-thin">
        {children}
      </div>
    </div>
  );
}

// Simulates turning a physical page: the outgoing page rotates away and the
// incoming page rotates in around a vertical spine, with a moving shadow
// standing in for the fold. `direction` flips which edge is the spine (1 =
// turning forward, page hinges on the left; -1 = turning back, hinges right).
function BookFlip({ pageKey, direction, children, className = "" }) {
  return (
    <div style={{ perspective: 1800 }} className={`self-stretch h-full min-h-0 ${className}`}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={pageKey}
          custom={direction}
          initial={(dir) => ({ rotateY: dir >= 0 ? 78 : -78, opacity: 0.4 })}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={(dir) => ({ rotateY: dir >= 0 ? -78 : 78, opacity: 0.4 })}
          transition={{ duration: 0.5, ease: [0.45, 0, 0.2, 1] }}
          style={{
            transformOrigin: direction >= 0 ? "left center" : "right center",
            transformStyle: "preserve-3d",
            position: "relative",
          }}
          className="flex h-full min-h-0 w-full"
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                direction >= 0
                  ? "linear-gradient(90deg, rgba(91,33,182,0.16), transparent 22%)"
                  : "linear-gradient(270deg, rgba(91,33,182,0.16), transparent 22%)",
            }}
          />
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function OpenJournalContent({ selectTab }) {
  const day = useGameStore((s) => s.day);
  const dailyCompleted = useGameStore((s) => s.dailyCompleted);
  const missedDates = useGameStore((s) => s.missedDates);
  const playDate = useGameStore((s) => s.playDate);
  const playerName = useGameStore((s) => s.playerName);
  const subjects = useGameStore((s) => s.subjects);
  const catchingUp = (missedDates || []).length > 0;
  const playLabel = catchingUp ? formatCampusDate(playDate) : null;

  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-brand-500 dark:text-brand-300 mb-2">
          {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white mb-5">
          Welcome back, {playerName || "student"}!
        </h2>
        <p className="text-base text-slate-500 dark:text-slate-300 leading-relaxed max-w-2xl">
          {catchingUp
            ? `You missed a campus day. Play Day ${day} now and it will be saved as ${playLabel} — then you can still log today.`
            : dailyCompleted
              ? "Today's entry is complete. Come back tomorrow to continue your streak — or write this week's letter while the days are still close."
              : "Today's journal entry is still incomplete. Complete your campus run to log it."}{" "}
          Your check-ins, deadlines and marks are collected as you play — weekly letters live on the Reflections page.
        </p>
        {subjects.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {subjects.map((subject) => (
              <span
                key={subject}
                className="rounded-full bg-brand-50 dark:bg-white/10 border border-brand-200/60 dark:border-white/10 px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-200"
              >
                {subject}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-6 flex justify-center">
        <motion.div
          initial={{ rotate: -3, opacity: 0, y: 12 }}
          animate={{ rotate: -2, opacity: 1, y: 0 }}
          className="bg-white dark:bg-white/5 border border-brand-100 dark:border-white/10 shadow-[var(--shadow-playful)] px-8 py-6 rounded-3xl text-center max-w-sm"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            {catchingUp
              ? `Catch up Day ${day} (${playLabel}) before today's run.`
              : dailyCompleted
                ? "Check the roadmap to see when the next day unlocks."
                : "Start today's game to log your journal entry."}
          </div>
          <button
            onClick={() => selectTab("roadmap")}
            className="rounded-2xl bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-600 hover:to-brand-500 transition-all text-white
                       font-semibold px-5 py-2.5 text-sm shadow-playful"
          >
            {catchingUp
              ? `Catch up Day ${day}`
              : dailyCompleted
                ? "View Roadmap"
                : `Start Game (Day ${day})`}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

const ASSIGNMENT_BADGES = {
  NEW: { icon: "🆕", color: "#8f5cff", label: "New" },
  DEADLINE_RECORDED: { icon: "📅", color: "#3b82f6", label: "Deadline Set" },
  IN_PROGRESS: { icon: "✏️", color: "#f59e0b", label: "In Progress" },
  COMPLETED: { icon: "✅", color: "#10b981", label: "Completed" },
  MARK_PENDING: { icon: "⏳", color: "#ec4899", label: "Awaiting Mark" },
  MARK_RECEIVED: { icon: "🏆", color: "#10b981", label: "Mark Received" },
};

const EXAM_BADGES = {
  PENDING: { icon: "❓", color: "#f43f5e", label: "Date Pending" },
  DATE_RECORDED: { icon: "📌", color: "#10b981", label: "Date Set" },
  MARK_RECEIVED: { icon: "🏆", color: "#10b981", label: "Mark Received" },
};

const ROADMAP_ICONS = ["🏛️", "📚", "🏫", "🔬"];

// Candy-Crush-style progression: only Day 1..currentDay are reachable.
// currentDay is the one playable node; everything beyond it is locked
// until the current day's run is completed (GameStateManager.startNextDay
// only then advances `day`).
const NODE_STYLE = {
  completed: { fill: "#10b981", stroke: "#059669", label: "#ffffff" },
  current: { fill: "#7c3aed", stroke: "#5b21b6", label: "#ffffff" },
  catchup: { fill: "#ec4899", stroke: "#be185d", label: "#ffffff" },
  locked: { fill: "#e4d9ff", stroke: "#cbb3ff", label: "#7c3aed" },
};

const NODE_SPACING = 92;
const LOOKAHEAD_LOCKED_DAYS = 3; // how many locked days are teased beyond today

function RoadmapContent({ onViewDay }) {
  const navigate = useNavigate();
  const currentDay = useGameStore((s) => s.day);
  const dailyCompleted = useGameStore((s) => s.dailyCompleted);
  const missedDates = useGameStore((s) => s.missedDates);
  const playDate = useGameStore((s) => s.playDate);
  const entries = useJournalHistoryStore((s) => s.entries);
  const completedDays = new Set(entries.map((e) => e.day));
  const scrollRef = useRef(null);
  const catchingUp = (missedDates || []).length > 0;

  // Always starts at Day 1 — the path grows with progress and scrolls
  // rather than compressing older days out of view.
  const endDay = currentDay + LOOKAHEAD_LOCKED_DAYS;
  const days = [];
  for (let d = 1; d <= endDay; d++) days.push(d);

  const H = 240;
  const W = Math.max(360, 40 + (days.length - 1) * NODE_SPACING + 40);
  const positions = days.map((d, i) => ({
    d,
    x: 40 + i * NODE_SPACING,
    y: H / 2 + Math.sin(i * 1.4) * 66,
  }));
  const pathD = positions.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  function nodeState(d) {
    if (d < currentDay) return "completed";
    if (d === currentDay) {
      if (dailyCompleted) return "completed";
      return catchingUp ? "catchup" : "current";
    }
    return "locked";
  }

  function handleNodeClick(d, state) {
    if (state === "locked") return;
    if (state === "current" || state === "catchup") {
      navigate("/journal/activities");
      return;
    }
    // completed — reopen that day's journal entry
    if (completedDays.has(d)) onViewDay?.(d);
  }

  function nodeCaption(d, state) {
    if (state === "catchup") {
      return formatCampusDate(playDate, { weekday: "short", month: "short", day: "numeric" });
    }
    if (state === "current") return "Play Today";
    return `Day ${d}`;
  }

  // Bring "Today" into view whenever the roadmap opens or progresses.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const todayX = 40 + (currentDay - 1) * NODE_SPACING;
    el.scrollTo({ left: Math.max(0, todayX - el.clientWidth / 2), behavior: "auto" });
  }, [currentDay]);

  return (
    <div>
      <h2 className="font-display text-xl font-bold mb-1 text-slate-800 dark:text-white">Game Roadmap</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        {catchingUp
          ? `Day ${currentDay} is a catch-up for ${formatCampusDate(playDate)}. Play it first — it saves as that date, then today's day unlocks.`
          : `Complete Day ${currentDay} to unlock Day ${currentDay + 1}.`}
      </p>
      <div ref={scrollRef} className="w-full overflow-x-auto pb-2 scrollbar-thin">
        <svg width={W} height={H} className="select-none block">
          <path
            d={pathD}
            fill="none"
            stroke="#cbb3ff"
            strokeWidth={3}
            strokeDasharray="2 9"
            strokeLinecap="round"
            opacity={0.85}
          />
          {positions.map(({ d, x, y }, i) => {
            const state = nodeState(d);
            const style = NODE_STYLE[state];
            const r = state === "current" || state === "catchup" ? 19 : 15;
            const clickable = state !== "locked";
            const pulse = state === "current" || state === "catchup";
            return (
              <g
                key={d}
                onClick={() => handleNodeClick(d, state)}
                style={{ cursor: clickable ? "pointer" : "not-allowed" }}
              >
                {i % 3 === 0 && (
                  <text x={x} y={y - 30} fontSize={17} textAnchor="middle">
                    {ROADMAP_ICONS[(i / 3) % ROADMAP_ICONS.length]}
                  </text>
                )}
                {pulse && (
                  <circle cx={x} cy={y} r={r + 7} fill="none" stroke={style.stroke} strokeWidth={2} opacity={0.35}>
                    <animate attributeName="r" values={`${r + 4};${r + 11};${r + 4}`} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.45;0.05;0.45" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={x} cy={y} r={r} fill={style.fill} stroke={style.stroke} strokeWidth={2} />
                <text
                  x={x}
                  y={y + 4}
                  fontSize={12}
                  textAnchor="middle"
                  fill={style.label}
                  fontWeight="bold"
                >
                  {state === "completed" ? "✓" : state === "locked" ? "🔒" : d}
                </text>
                <text x={x} y={y + r + 15} fontSize={9.5} textAnchor="middle" fill="#7c3aed">
                  {nodeCaption(d, state)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10b981] mr-1" />Completed (tap to view)</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#7c3aed] mr-1" />Today (tap to play)</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ec4899] mr-1" />Catch-up (saves as that date)</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#e4d9ff] mr-1" />Locked</span>
      </div>
    </div>
  );
}

function RecentJournalsContent({ focusDay }) {
  const entries = useJournalHistoryStore((s) => s.entries);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (entries.length === 0) {
      setIndex(0);
      return;
    }
    if (focusDay != null) {
      const focused = entries.findIndex((entry) => entry.day === focusDay);
      if (focused >= 0) {
        setIndex(focused);
        return;
      }
    }
    setIndex(entries.length - 1);
  }, [entries, focusDay]);

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center max-w-lg">
        <h2 className="font-display text-2xl font-bold text-slate-800 dark:text-white mb-2">Recent Journals</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">
          No journal pages yet. Finish a campus run and every day’s entry will appear here — Day 1, Day 2, and so on — so you can read them again anytime.
        </p>
      </div>
    );
  }

  const clamped = Math.min(Math.max(index, 0), entries.length - 1);
  const entry = entries[clamped];
  const latest = entries[entries.length - 1];
  const latestDate = campusDateKey(latest?.date || latest?.completedAt);
  const entryDate = campusDateKey(entry?.date || entry?.completedAt);
  const canReplay = Boolean(latestDate) && entryDate === latestDate;
  const { narrative, highlights } = buildJournalPage(entry);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-brand-500 dark:text-brand-300">Your journal</div>
          <h2 className="font-display text-2xl font-bold text-slate-800 dark:text-white">Day {entry.day}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={clamped === 0}
            onClick={() => setIndex(clamped - 1)}
            className="rounded-full border border-brand-200 dark:border-white/15 px-3 py-1 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-brand-50 dark:hover:bg-white/10"
          >
            ‹
          </button>
          <button
            type="button"
            disabled={clamped === entries.length - 1}
            onClick={() => setIndex(clamped + 1)}
            className="rounded-full border border-brand-200 dark:border-white/15 px-3 py-1 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-brand-50 dark:hover:bg-white/10"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {entries.map((item, i) => (
          <button
            key={item.day}
            type="button"
            onClick={() => setIndex(i)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              i === clamped
                ? "bg-gradient-to-r from-brand-500 to-brand-400 text-white shadow-playful"
                : "bg-brand-50 dark:bg-white/10 text-brand-700 dark:text-brand-200 border border-brand-200/60 dark:border-white/10 hover:bg-brand-100"
            }`}
          >
            Day {item.day}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
        <div className="text-xs text-slate-400 mb-4 italic">
          {entry.completedAt &&
            new Date(entry.completedAt).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
        </div>
        <div className="journal-letter mb-6">
          {splitJournalParagraphs(narrative || "No entry was recorded for this day.").map((paragraph, i) => (
            <p key={`${i}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
          ))}
        </div>
        {highlights.length > 0 && (
          <div className="mb-6 rounded-2xl border border-brand-100 dark:border-white/10 bg-brand-50/80 dark:bg-white/5 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300 mb-2">
              Today at a glance
            </div>
            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
              {highlights.map((item, i) => (
                <li key={`${item}-${i}`} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {canReplay && (
          <div className="mt-6 border-t border-brand-100 dark:border-white/10 pt-4">
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-300">
              Saved the wrong answers in a hurry? Delete this page and play Day {entry.day} again.
            </p>
            <DiscardTodayButton date={entryDate} dayNumber={entry.day} />
          </div>
        )}
      </div>
    </div>
  );
}

function GameDetailsContent() {
  const xp = useGameStore((s) => s.xp);
  const level = useGameStore((s) => s.level);
  const streak = useGameStore((s) => s.currentStreak);
  const longestStreak = useGameStore((s) => s.longestStreak);
  const assignments = useGameStore((s) => s.assignments);
  const exams = useGameStore((s) => s.exams);
  const into = xpIntoLevel(xp);

  return (
    <div>
      <h2 className="font-display text-xl font-bold mb-4 text-slate-800 dark:text-white">Game Details</h2>

      <div className="relative overflow-hidden rounded-3xl border border-brand-100 dark:border-white/10 bg-gradient-to-br from-brand-50 via-white to-pink-50 dark:from-brand-700/20 dark:via-[#1a1530] dark:to-pink-500/10 p-4 mb-5 shadow-[var(--shadow-card)]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand-400/20 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <LevelRing xp={xp} level={level} size={88} tone="brand" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-brand-600 dark:text-brand-300">Campus rank</div>
            <div className="text-2xl font-black text-slate-800 dark:text-white leading-tight">Level {level}</div>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 dark:border-white/10 bg-white/70 dark:bg-white/10 px-2.5 py-1 shadow-inner">
              <span className="text-sm leading-none">⭐</span>
              <span className="text-sm font-black tabular-nums text-brand-600 dark:text-brand-300">{xp.toLocaleString()}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-400">total XP</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{into.toLocaleString()} / {XP_PER_LEVEL} XP this rank</span>
              <span>{xpToNextLevel(xp)} to Lv {level + 1}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-brand-100 dark:bg-white/10 shadow-inner">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand-400 via-brand-500 to-accent-pink"
                initial={{ width: 0 }}
                animate={{ width: `${(into / XP_PER_LEVEL) * 100}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-white/90 dark:bg-white/10 border border-orange-200/60 dark:border-white/10 px-3 py-2 shadow-inner">
            <div className="text-xl leading-none">🔥</div>
            <div className="text-lg font-black text-medium-600 leading-none">{streak}</div>
            <div className="text-[9px] uppercase tracking-wide text-slate-400">streak</div>
            {longestStreak > 0 && (
              <div className="mt-1 text-[9px] text-medium-600/80">best {longestStreak}</div>
            )}
          </div>
        </div>
      </div>

      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Assignment Quests</div>
      <div className="space-y-2 mb-4">
        {assignments.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No assignments recorded yet.</p>
        ) : assignments.map((a) => {
          const badge = ASSIGNMENT_BADGES[a.status] ?? ASSIGNMENT_BADGES.NEW;
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-2xl bg-brand-50/70 dark:bg-white/5 border-l-4 px-3 py-2"
              style={{ borderColor: badge.color }}
            >
              <span className="text-lg">{badge.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{a.title}</div>
                <div className="text-[10px] text-slate-500">
                  {a.deadline
                    ? formatCampusDate(a.deadline, { weekday: "short", month: "short", day: "numeric" })
                    : "No date set"}
                  {a.mark != null && a.mark !== "" ? ` · ${a.mark}%` : ""}
                </div>
              </div>
              <span
                className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0"
                style={{ backgroundColor: `${badge.color}22`, color: badge.color }}
              >
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Exam Quests</div>
      <div className="space-y-2">
        {exams.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No exams recorded yet.</p>
        ) : exams.map((e) => {
          const status =
            e.mark != null && e.mark !== ""
              ? "MARK_RECEIVED"
              : e.date
                ? "DATE_RECORDED"
                : e.status;
          const badge = EXAM_BADGES[status] ?? EXAM_BADGES.PENDING;
          const kind = e.exam_type || e.examType;
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-2xl bg-brand-50/70 dark:bg-white/5 border-l-4 px-3 py-2"
              style={{ borderColor: badge.color }}
            >
              <span className="text-lg">{badge.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                  {e.subject}{kind ? ` · ${String(kind).replace(/^\w/, (c) => c.toUpperCase())}` : ""}
                </div>
                <div className="text-[10px] text-slate-500">
                  {e.date ?? "No date set"}
                  {e.mark != null && e.mark !== "" ? ` · ${formatExamMark(e.mark)}` : ""}
                </div>
              </div>
              <span
                className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0"
                style={{ backgroundColor: `${badge.color}22`, color: badge.color }}
              >
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CharacterStatsContent() {
  const xp = useGameStore((s) => s.xp);
  const level = useGameStore((s) => s.level);
  const badges = useGameStore((s) => s.badges);
  const streak = useGameStore((s) => s.currentStreak);
  const longestStreak = useGameStore((s) => s.longestStreak);
  const playerName = useGameStore((s) => s.playerName);
  const subjects = useGameStore((s) => s.subjects);
  const universityName = useGameStore((s) => s.universityName);
  const degreeName = useGameStore((s) => s.degreeName);
  const campusYear = useGameStore((s) => s.campusYear);
  const semester = useGameStore((s) => s.semester);
  const gpa = useGameStore((s) => s.gpa);
  const into = xpIntoLevel(xp);
  const journalCount = useJournalHistoryStore((s) => s.entries.length);

  return (
    <div>
      <div className="flex items-center gap-4 mb-5">
        <LevelRing xp={xp} level={level} size={100} tone="brand" />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold mb-0.5 truncate text-slate-800 dark:text-white">{playerName || "Student"}</h2>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Level {level} Student{universityName ? ` · ${universityName}` : ""}
          </div>
          <div className="mt-2 text-xs font-semibold text-brand-600 dark:text-brand-300">
            {xpToNextLevel(xp)} XP to Level {level + 1}
          </div>
        </div>
      </div>
      {(degreeName || campusYear || semester || gpa != null) && (
        <p className="text-sm text-slate-500 dark:text-slate-300 mb-4">
          {[
            degreeName,
            campusYear ? `Year ${campusYear}` : null,
            semester ? `Semester ${semester}` : null,
            gpa != null ? `GPA ${Number(gpa).toFixed(2)}` : null,
            streak ? `${streak}-day streak` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {subjects.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <span
              key={subject}
              className="rounded-full bg-brand-50 dark:bg-white/10 border border-brand-200/60 dark:border-white/10 px-3 py-1 text-xs text-brand-700 dark:text-brand-200"
            >
              {subject}
            </span>
          ))}
        </div>
      )}
      <div className="w-full h-3 rounded-full bg-brand-100 dark:bg-white/10 overflow-hidden mb-1">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-400 to-brand-600"
          initial={{ width: 0 }}
          animate={{ width: `${(into / XP_PER_LEVEL) * 100}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="text-xs text-slate-400 mb-6">{into} / {XP_PER_LEVEL} XP in this rank</div>
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Achievements</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {BADGE_CATALOG.map((badge) => {
          const unlocked = isBadgeUnlocked(badge.key, {
            badges,
            currentStreak: streak,
            longestStreak,
            xp,
            journalCount,
          });
          return (
            <div
              key={badge.key}
              className={`rounded-2xl border px-3 py-3 text-center transition-all ${
                unlocked
                  ? "bg-gradient-to-br from-brand-50 to-pink-50 dark:from-brand-700/20 dark:to-pink-500/10 border-brand-200/70 dark:border-brand-400/30 shadow-sm"
                  : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-55"
              }`}
            >
              <div className={`text-xl ${unlocked ? "" : "grayscale"}`}>{badge.icon}</div>
              <div className={`mt-1 text-[11px] font-bold leading-tight ${unlocked ? "text-brand-700 dark:text-brand-200" : "text-slate-400"}`}>
                {badge.label}
              </div>
              <div className="mt-0.5 text-[9px] text-slate-400 leading-snug">{unlocked ? "Unlocked" : badge.hint}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TAB_CONTENT = {
  open: OpenJournalContent,
  roadmap: RoadmapContent,
  maps: CampusMapsPage,
  reflect: ReflectionsPage,
  recent: RecentJournalsContent,
  details: GameDetailsContent,
  stats: CharacterStatsContent,
};

export default function JournalHome() {
  const location = useLocation();
  const navigate = useNavigate();
  const day = useGameStore((s) => s.day);
  const streak = useGameStore((s) => s.currentStreak);
  const [tab, setTab] = useState("open");
  const [direction, setDirection] = useState(1);
  const [focusDay, setFocusDay] = useState(null);
  const tabIndexRef = useRef(0);
  const Content = TAB_CONTENT[tab];

  function selectTab(id) {
    const nextIndex = TABS.findIndex((t) => t.id === id);
    setDirection(nextIndex >= tabIndexRef.current ? 1 : -1);
    tabIndexRef.current = nextIndex;
    setTab(id);
  }

  useEffect(() => {
    const openTab = location.state?.openTab;
    if (!openTab || !TAB_CONTENT[openTab]) return;
    selectTab(openTab);
    navigate(".", { replace: true, state: {} });
  }, [location.state, navigate]);

  function viewDay(d) {
    setFocusDay(d);
    selectTab("recent");
  }

  return (
    <JournalShell
      fill
      title="Student Journal"
      subtitle="Flip through your campus days, maps, and weekly letters."
      aside={
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 shadow-card ring-1 ring-brand-100">
            Day {day}
          </span>
          {streak > 0 && (
            <span className="rounded-full bg-medium-50 px-3 py-1.5 text-xs font-semibold text-medium-600">
              🔥 {streak}-day streak
            </span>
          )}
        </div>
      }
    >
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={`shrink-0 inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-to-r from-brand-500 to-brand-400 text-white shadow-playful"
                  : "bg-white text-slate-500 border border-black/5 hover:bg-brand-50 hover:text-brand-600"
              }`}
            >
              <Icon size={16} strokeWidth={2.3} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="card flex min-h-[28rem] flex-1 overflow-hidden shadow-[var(--shadow-playful)]">
        <div className="hidden sm:flex w-[7.5rem] shrink-0 flex-col items-center justify-center gap-4 bg-gradient-to-b from-brand-500 to-brand-700 p-5 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 shadow-inner">
            <NotebookPen size={28} strokeWidth={2.2} />
          </div>
          <div className="text-[11px] font-medium leading-relaxed tracking-wide text-white/90">
            Smart Uni Guide
            <br />
            Student Journal
          </div>
        </div>

        <div
          className="hidden sm:block w-2.5 shrink-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(91,33,182,0.45), rgba(255,255,255,0.55) 45%, rgba(124,58,237,0.18) 58%, rgba(91,33,182,0.28))",
            boxShadow: "inset 3px 0 10px rgba(91,33,182,0.18), 4px 0 14px rgba(124,58,237,0.08)",
          }}
        />

        <BookFlip pageKey={tab} direction={direction} className="flex-1 min-w-0 min-h-0">
          <Page>
            <Content selectTab={selectTab} onViewDay={viewDay} focusDay={focusDay} />
          </Page>
        </BookFlip>
      </div>
    </JournalShell>
  );
}
