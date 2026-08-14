import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../../Game/state/GameStateManager";
import { useJournalHistoryStore } from "../../Game/state/journalHistoryStore";

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
      className="relative flex-1 min-w-0 rounded-r-sm bg-[#f5ecd9] text-stone-800 p-6 sm:p-8
                 shadow-inner border-l border-stone-300/50 min-h-[440px]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(#f5ecd9 0 27px, #e4d6b6 27px 28px)",
      }}
    >
      {children}
    </div>
  );
}

// Simulates turning a physical page: the outgoing page rotates away and the
// incoming page rotates in around a vertical spine, with a moving shadow
// standing in for the fold. `direction` flips which edge is the spine (1 =
// turning forward, page hinges on the left; -1 = turning back, hinges right).
function BookFlip({ pageKey, direction, children, className = "" }) {
  return (
    <div style={{ perspective: 1800 }} className={className}>
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
          className="w-full h-full"
        >
          <div
            className="absolute inset-0 pointer-events-none rounded-r-sm"
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

function OpenJournalContent() {
  const day = useGameStore((s) => s.day);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mb-1">
          {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </div>
        <h2 className="text-2xl font-bold text-stone-800 mb-4">Welcome back, Alex!</h2>
        <p className="text-sm text-stone-600 leading-relaxed max-w-sm">
          Complete today's campus run to log your journal entry. Your check-ins,
          deadlines and marks are collected as you play — nothing to fill in by hand.
        </p>
      </div>
      <div className="mt-6 flex justify-center">
        <motion.div
          initial={{ rotate: -3, opacity: 0, y: 12 }}
          animate={{ rotate: -2, opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-800/10 shadow-lg px-6 py-5 rounded-sm text-center max-w-xs"
        >
          <div className="text-xs text-stone-500 mb-3">
            Start today's game to log your journal entry.
          </div>
          <button
            onClick={() => navigate("/journal/activities")}
            className="rounded-lg bg-amber-700 hover:bg-amber-600 transition-colors text-amber-50
                       font-semibold px-5 py-2.5 text-sm shadow"
          >
            Start Game (Day {day})
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

const NODE_STYLE = {
  completed: { fill: "#2f9e63", stroke: "#1d6b42", label: "#ffffff" },
  missed: { fill: "#c9a26a", stroke: "#8f7350", label: "#5b4630" },
  current: { fill: "#b45309", stroke: "#7c3a06", label: "#ffffff" },
  upcoming: { fill: "#efe4c8", stroke: "#a8895a", label: "#5b4630" },
  locked: { fill: "#d8d2c4", stroke: "#a8895a", label: "#8a7457" },
};

const NODE_SPACING = 92;

function RoadmapContent() {
  const currentDay = useGameStore((s) => s.day);
  const entries = useJournalHistoryStore((s) => s.entries);
  const completedDays = new Set(entries.map((e) => e.day));
  const scrollRef = useRef(null);

  // Always starts at Day 1 — the path grows with progress and scrolls
  // rather than compressing older days out of view.
  const endDay = currentDay + 3;
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
    if (d < currentDay) return completedDays.has(d) ? "completed" : "missed";
    if (d === currentDay) return "current";
    if (d <= currentDay + 3) return "upcoming";
    return "locked";
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
      <p className="text-xs text-stone-500 mb-4">Your campus journey, from Day 1 onward.</p>
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
            return (
              <g key={d}>
                {i % 3 === 0 && (
                  <text x={x} y={y - 30} fontSize={17} textAnchor="middle">
                    {ROADMAP_ICONS[(i / 3) % ROADMAP_ICONS.length]}
                  </text>
                )}
                {state === "current" && (
                  <circle cx={x} cy={y} r={r + 7} fill="none" stroke="#b45309" strokeWidth={2} opacity={0.35} />
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
                  {state === "current" ? "Today" : `Day ${d}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-stone-500">
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#2f9e63] mr-1" />Completed</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#b45309] mr-1" />Today</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#efe4c8] border border-[#a8895a] mr-1" />Upcoming</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#d8d2c4] mr-1" />Locked</span>
      </div>
    </div>
  );
}

function RecentJournalsContent() {
  const entries = useJournalHistoryStore((s) => s.entries);
  const [index, setIndex] = useState(entries.length - 1);
  const [direction, setDirection] = useState(1);

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
          <div className="text-xs text-stone-500 mb-4">
            {entry.completedAt && new Date(entry.completedAt).toLocaleString()}
          </div>
          <div className="flex gap-6 mb-4">
            <div>
              <div className="text-[10px] uppercase text-stone-500">XP</div>
              <div className="text-lg font-bold text-amber-700">{entry.xp}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-stone-500">Score</div>
              <div className="text-lg font-bold text-stone-700">{entry.score}</div>
            </div>
          </div>
          <div className="text-sm font-semibold text-stone-700 mb-2">Check-ins</div>
          <ul className="text-sm text-stone-600 space-y-1 mb-3">
            {entry.journalDay.responses.map((r, i) => (
              <li key={i}>
                • {r.category}: <span className="font-medium">{String(r.answer)}</span>
              </li>
            ))}
          </ul>
          {entry.journalDay.interactionsCompleted.length > 0 && (
            <>
              <div className="text-sm font-semibold text-stone-700 mb-2">Records updated</div>
              <ul className="text-sm text-stone-600 space-y-1">
                {entry.journalDay.interactionsCompleted.map((r, i) => (
                  <li key={i}>
                    • {r.interactionType}: <span className="font-medium">{String(r.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
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
  const xpIntoLevel = xp % 500;
  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Alex</h2>
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
  const tabIndexRef = useRef(0);
  const Content = TAB_CONTENT[tab];

  function selectTab(id) {
    const nextIndex = TABS.findIndex((t) => t.id === id);
    setDirection(nextIndex >= tabIndexRef.current ? 1 : -1);
    tabIndexRef.current = nextIndex;
    setTab(id);
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#5b3a24] to-[#3a2415] flex items-center justify-center p-4 sm:p-8">
      <div className="relative w-full max-w-4xl flex rounded-md shadow-2xl overflow-hidden border border-black/20">
        {/* left illustrated page */}
        <div className="hidden sm:flex w-40 flex-col items-center justify-center gap-3 bg-[#efe4c8] border-r border-stone-300/50 p-4 text-center">
          <div className="w-16 h-16 rounded-full border-2 border-amber-800/30 flex items-center justify-center text-2xl">
            🏛️
          </div>
          <div className="text-[11px] text-stone-600 leading-relaxed">
            Smart Uni Guide
            <br />
            Student Journal
          </div>
        </div>

        {/* right content page with tabs */}
        <BookFlip pageKey={tab} direction={direction} className="flex-1 min-w-0">
          <Page>
            <Content />
          </Page>
        </BookFlip>

        {/* tab rail */}
        <div className="hidden md:flex flex-col gap-2 bg-[#3a2415] p-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`text-[11px] font-semibold px-3 py-2 rounded-md whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "bg-amber-100 text-amber-900"
                  : "bg-[#6b4a30] text-amber-100/80 hover:bg-[#7c5638]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* mobile tab bar */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 flex bg-[#3a2415] overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`flex-1 text-[10px] font-semibold px-2 py-2 whitespace-nowrap ${
                tab === t.id ? "bg-amber-100 text-amber-900" : "text-amber-100/80"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
