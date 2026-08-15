import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../../Game/state/GameStateManager";
import { useJournalHistoryStore } from "../../Game/state/journalHistoryStore";
import { composeJournalNarrative } from "../../Game/data/journalNarrative";
import { ensureGuestUser, getUserSessions } from "../../services/userApi";

const TABS = [
  { id: "open", label: "Open Journal" },
  { id: "roadmap", label: "Game Roadmap" },
  { id: "recent", label: "Recent Journals" },
  { id: "details", label: "Game Details" },
  { id: "stats", label: "Character Stats" },
];

function Page({ children }) {
  return (
    <div
      className="relative flex h-full min-h-0 flex-1 min-w-0 bg-[#f5ecd9] text-stone-800
                 px-6 py-7 sm:px-10 sm:py-9 lg:px-14 lg:py-10 overflow-hidden"
      style={{
        backgroundImage:
          "repeating-linear-gradient(#f5ecd9 0 32px, #e4d6b6 32px 33px)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.45), transparent 42%), radial-gradient(ellipse at 80% 90%, rgba(139,90,43,0.08), transparent 46%)",
        }}
      />
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-y-auto pb-16 md:pb-0">
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
                  ? "linear-gradient(90deg, rgba(0,0,0,0.18), transparent 22%)"
                  : "linear-gradient(270deg, rgba(0,0,0,0.18), transparent 22%)",
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
  const playerName = useGameStore((s) => s.playerName);

  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mb-2">
          {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 mb-5">Welcome back, {playerName}!</h2>
        <p className="text-base text-stone-600 leading-relaxed max-w-2xl">
          {dailyCompleted
            ? "Today's entry is complete. Come back tomorrow to continue your streak."
            : "Today's journal entry is still incomplete. Complete your campus run to log it."}{" "}
          Your check-ins, deadlines and marks are collected as you play — nothing to fill in by hand.
        </p>
      </div>
      <div className="mt-6 flex justify-center">
        <motion.div
          initial={{ rotate: -3, opacity: 0, y: 12 }}
          animate={{ rotate: -2, opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-800/10 shadow-lg px-8 py-6 rounded-sm text-center max-w-sm"
        >
          <div className="text-xs text-stone-500 mb-3">
            {dailyCompleted
              ? "Check the roadmap to see when the next day unlocks."
              : "Start today's game to log your journal entry."}
          </div>
          <button
            onClick={() => selectTab("roadmap")}
            className="rounded-lg bg-amber-700 hover:bg-amber-600 transition-colors text-amber-50
                       font-semibold px-5 py-2.5 text-sm shadow"
          >
            {dailyCompleted ? "View Roadmap" : `Start Game (Day ${day})`}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

const ASSIGNMENT_BADGES = {
  NEW: { icon: "🆕", color: "#8fa6c9", label: "New" },
  DEADLINE_RECORDED: { icon: "📅", color: "#c9a26a", label: "Deadline Set" },
  IN_PROGRESS: { icon: "✏️", color: "#e0b45c", label: "In Progress" },
  COMPLETED: { icon: "✅", color: "#2f9e63", label: "Completed" },
  MARK_PENDING: { icon: "⏳", color: "#b48fc9", label: "Awaiting Mark" },
  MARK_RECEIVED: { icon: "🏆", color: "#2f9e63", label: "Mark Received" },
};

const EXAM_BADGES = {
  PENDING: { icon: "❓", color: "#c98f8f", label: "Date Pending" },
  DATE_RECORDED: { icon: "📌", color: "#2f9e63", label: "Date Set" },
};

const ROADMAP_ICONS = ["🏛️", "📚", "🏫", "🔬"];

// Candy-Crush-style progression: only Day 1..currentDay are reachable.
// currentDay is the one playable node; everything beyond it is locked
// until the current day's run is completed (GameStateManager.startNextDay
// only then advances `day`).
const NODE_STYLE = {
  completed: { fill: "#2f9e63", stroke: "#1d6b42", label: "#ffffff" },
  current: { fill: "#b45309", stroke: "#7c3a06", label: "#ffffff" },
  locked: { fill: "#d8d2c4", stroke: "#a8895a", label: "#8a7457" },
};

const NODE_SPACING = 92;
const LOOKAHEAD_LOCKED_DAYS = 3; // how many locked days are teased beyond today

function RoadmapContent({ onViewDay }) {
  const navigate = useNavigate();
  const currentDay = useGameStore((s) => s.day);
  const dailyCompleted = useGameStore((s) => s.dailyCompleted);
  const entries = useJournalHistoryStore((s) => s.entries);
  const completedDays = new Set(entries.map((e) => e.day));
  const scrollRef = useRef(null);

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
    if (d === currentDay) return dailyCompleted ? "completed" : "current";
    return "locked";
  }

  function handleNodeClick(d, state) {
    if (state === "locked") return;
    if (state === "current") {
      navigate("/journal/activities");
      return;
    }
    // completed — reopen that day's journal entry
    if (completedDays.has(d)) onViewDay?.(d);
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
      <h2 className="text-xl font-bold mb-1">Game Roadmap</h2>
      <p className="text-xs text-stone-500 mb-4">
        Complete Day {currentDay} to unlock Day {currentDay + 1}.
      </p>
      <div ref={scrollRef} className="w-full overflow-x-auto pb-2">
        <svg width={W} height={H} className="select-none block">
          <path
            d={pathD}
            fill="none"
            stroke="#a8895a"
            strokeWidth={3}
            strokeDasharray="2 9"
            strokeLinecap="round"
            opacity={0.6}
          />
          {positions.map(({ d, x, y }, i) => {
            const state = nodeState(d);
            const style = NODE_STYLE[state];
            const r = state === "current" ? 19 : 15;
            const clickable = state !== "locked";
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
                {state === "current" && (
                  <circle cx={x} cy={y} r={r + 7} fill="none" stroke="#b45309" strokeWidth={2} opacity={0.35}>
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
                <text x={x} y={y + r + 15} fontSize={9.5} textAnchor="middle" fill="#8a7457">
                  {state === "current" ? "Play Today" : `Day ${d}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-stone-500">
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#2f9e63] mr-1" />Completed (tap to view)</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#b45309] mr-1" />Today (tap to play)</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#d8d2c4] mr-1" />Locked</span>
      </div>
    </div>
  );
}

function RecentJournalsContent({ focusDay }) {
  const entries = useJournalHistoryStore((s) => s.entries);
  const [index, setIndex] = useState(entries.length - 1);
  const [direction, setDirection] = useState(1);

  // Jump to the entry the Roadmap was clicked for. Adjusting state during
  // render (rather than in an effect) is the React-recommended pattern for
  // "reset state when a prop changes" — it avoids an extra render pass.
  const [lastFocusDay, setLastFocusDay] = useState(focusDay);
  if (focusDay !== lastFocusDay) {
    setLastFocusDay(focusDay);
    if (focusDay != null) {
      const i = entries.findIndex((e) => e.day === focusDay);
      if (i >= 0) {
        setIndex(i);
        setDirection(1);
      }
    }
  }

  if (entries.length === 0) {
    return (
      <div className="text-sm text-stone-500 italic">
        No completed days yet — finish a campus run to start your journal history.
      </div>
    );
  }

  const clamped = Math.min(Math.max(index, 0), entries.length - 1);
  const entry = entries[clamped];

  function go(next) {
    setDirection(next > clamped ? 1 : -1);
    setIndex(next);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <button
          disabled={clamped === 0}
          onClick={() => go(clamped - 1)}
          className="text-stone-500 disabled:opacity-30 hover:text-stone-800 px-2 text-lg"
        >
          ‹
        </button>
        <h2 className="text-lg font-bold">Day {entry.day}</h2>
        <button
          disabled={clamped === entries.length - 1}
          onClick={() => go(clamped + 1)}
          className="text-stone-500 disabled:opacity-30 hover:text-stone-800 px-2 text-lg"
        >
          ›
        </button>
      </div>

      <BookFlip pageKey={entry.day} direction={direction} className="flex-1 relative">
        <div>
          <div className="text-xs text-stone-500 mb-4 italic">
            {entry.completedAt &&
              new Date(entry.completedAt).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
          </div>

          {/* the actual diary text — a flowing first-person paragraph rather
              than a raw data dump. Swaps to a real backend `journal_entry`
              string once that's wired up, no layout change needed. */}
          <p
            className="text-[15px] leading-7 text-stone-700 mb-5 first-letter:text-3xl
                       first-letter:font-bold first-letter:text-amber-700 first-letter:mr-1
                       first-letter:float-left"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {composeJournalNarrative(entry) || "No entry was recorded for this day."}
          </p>

          <div className="flex gap-6 pt-3 border-t border-stone-300/60">
            <div>
              <div className="text-[10px] uppercase text-stone-500">XP earned</div>
              <div className="text-lg font-bold text-amber-700">{entry.xp}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-stone-500">Score</div>
              <div className="text-lg font-bold text-stone-700">{entry.score}</div>
            </div>
          </div>
        </div>
      </BookFlip>
    </div>
  );
}

function GameDetailsContent() {
  const xp = useGameStore((s) => s.xp);
  const level = useGameStore((s) => s.level);
  const score = useGameStore((s) => s.score);
  const streak = useJournalHistoryStore((s) => s.currentStreak());
  const assignments = useGameStore((s) => s.assignments);
  const exams = useGameStore((s) => s.exams);
  const xpIntoLevel = xp % 500;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Game Details</h2>

      {/* gamified header: level badge + XP ring progress + streak flame */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative w-16 h-16 shrink-0">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-700 shadow-lg" />
          <div className="absolute inset-[3px] rounded-full bg-[#f5ecd9] flex flex-col items-center justify-center">
            <div className="text-[9px] uppercase text-stone-500 leading-none">Lv</div>
            <div className="text-xl font-extrabold text-amber-800 leading-none">{level}</div>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
            <span>XP Progress</span>
            <span>{xpIntoLevel} / 500</span>
          </div>
          <div className="w-full h-3 rounded-full bg-stone-300/70 overflow-hidden shadow-inner">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
              initial={{ width: 0 }}
              animate={{ width: `${(xpIntoLevel / 500) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-orange-50 border border-orange-800/10 px-3 py-1.5">
          <div className="text-lg leading-none">🔥</div>
          <div className="text-sm font-extrabold text-orange-700 leading-tight">{streak}</div>
          <div className="text-[9px] uppercase text-stone-500 leading-none">streak</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-800/10 px-3 py-2">
          <span className="text-lg">⭐</span>
          <div>
            <div className="text-[10px] uppercase text-stone-500">Total XP</div>
            <div className="text-base font-bold text-stone-800">{xp.toLocaleString()}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-800/10 px-3 py-2">
          <span className="text-lg">🪙</span>
          <div>
            <div className="text-[10px] uppercase text-stone-500">Score</div>
            <div className="text-base font-bold text-stone-800">{score.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="text-sm font-semibold text-stone-700 mb-2">Assignment Quests</div>
      <div className="space-y-2 mb-4">
        {assignments.map((a) => {
          const badge = ASSIGNMENT_BADGES[a.status] ?? ASSIGNMENT_BADGES.NEW;
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-lg bg-amber-50/70 border-l-4 px-3 py-2"
              style={{ borderColor: badge.color }}
            >
              <span className="text-lg">{badge.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-800 truncate">{a.title}</div>
                <div className="text-[10px] text-stone-500">{a.subject}</div>
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

      <div className="text-sm font-semibold text-stone-700 mb-2">Exam Quests</div>
      <div className="space-y-2">
        {exams.map((e) => {
          const badge = EXAM_BADGES[e.status] ?? EXAM_BADGES.PENDING;
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-lg bg-amber-50/70 border-l-4 px-3 py-2"
              style={{ borderColor: badge.color }}
            >
              <span className="text-lg">{badge.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-800 truncate">{e.subject}</div>
                <div className="text-[10px] text-stone-500">{e.date ?? "No date set"}</div>
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
  const playerName = useGameStore((s) => s.playerName);
  const xpIntoLevel = xp % 500;
  return (
    <div>
      <h2 className="text-xl font-bold mb-1">{playerName}</h2>
      <div className="text-sm text-stone-500 mb-4">Level {level} Student</div>
      <div className="w-full h-3 rounded-full bg-stone-300 overflow-hidden mb-1">
        <div
          className="h-full bg-amber-600"
          style={{ width: `${(xpIntoLevel / 500) * 100}%` }}
        />
      </div>
      <div className="text-xs text-stone-500 mb-6">{xpIntoLevel} / 500 XP to next level</div>
      <div className="text-sm font-semibold text-stone-700 mb-2">Achievements</div>
      <div className="flex gap-3 flex-wrap">
        {["First Journal", "3-Day Streak", "Mark Reported", "Deadline Set"].map((a) => (
          <span
            key={a}
            className="text-xs rounded-full bg-amber-100 border border-amber-800/10 px-3 py-1 text-amber-800"
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

const TAB_CONTENT = {
  open: OpenJournalContent,
  roadmap: RoadmapContent,
  recent: RecentJournalsContent,
  details: GameDetailsContent,
  stats: CharacterStatsContent,
};

export default function JournalHome() {
  const [tab, setTab] = useState("open");
  const [direction, setDirection] = useState(1);
  const [focusDay, setFocusDay] = useState(null);
  const tabIndexRef = useRef(0);
  const Content = TAB_CONTENT[tab];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await ensureGuestUser();
        if (cancelled) return;
        useGameStore.getState().applyUserProgress(user);
        const sessions = await getUserSessions(user.id);
        if (cancelled) return;
        useJournalHistoryStore.getState().hydrateFromSessions(sessions);
      } catch {
        // Offline / backend down — local journal still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectTab(id) {
    const nextIndex = TABS.findIndex((t) => t.id === id);
    setDirection(nextIndex >= tabIndexRef.current ? 1 : -1);
    tabIndexRef.current = nextIndex;
    setTab(id);
  }

  function viewDay(d) {
    setFocusDay(d);
    selectTab("recent");
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#3a2415]">
      <div className="flex h-full w-full">
        {/* left illustrated page */}
        <div className="hidden sm:flex w-[17%] max-w-[13.5rem] min-w-[9rem] shrink-0 flex-col items-center justify-center gap-4 bg-[#efe4c8] p-6 text-center">
          <div className="w-20 h-20 rounded-full border-2 border-amber-800/30 flex items-center justify-center text-3xl bg-[#f5ecd9]/70 shadow-inner">
            🏛️
          </div>
          <div className="text-xs text-stone-600 leading-relaxed tracking-wide">
            Smart Uni Guide
            <br />
            Student Journal
          </div>
        </div>

        {/* book spine / gutter */}
        <div
          className="hidden sm:block w-3 shrink-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(58,36,21,0.28), rgba(255,255,255,0.18) 42%, rgba(58,36,21,0.12) 58%, rgba(58,36,21,0.22))",
            boxShadow: "inset 4px 0 10px rgba(0,0,0,0.12), 4px 0 14px rgba(0,0,0,0.08)",
          }}
        />

        {/* main lined page */}
        <BookFlip pageKey={tab} direction={direction} className="flex-1 min-w-0 min-h-0">
          <Page>
            <Content selectTab={selectTab} onViewDay={viewDay} focusDay={focusDay} />
          </Page>
        </BookFlip>

        {/* tab rail — bookmark edge of the open journal */}
        <div className="hidden md:flex flex-col justify-center gap-2.5 bg-[#3a2415] px-3 py-8 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`text-[11px] font-semibold px-3 py-2.5 rounded-md whitespace-nowrap transition-colors shadow-sm ${
                tab === t.id
                  ? "bg-amber-100 text-amber-900"
                  : "bg-[#6b4a30] text-amber-100/80 hover:bg-[#7c5638]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* mobile tab bar */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 flex bg-[#3a2415] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTab(t.id)}
            className={`flex-1 text-[10px] font-semibold px-2 py-3 whitespace-nowrap ${
              tab === t.id ? "bg-amber-100 text-amber-900" : "text-amber-100/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
