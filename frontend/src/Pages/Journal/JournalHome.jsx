import { useState } from "react";
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

function RoadmapContent() {
  const steps = [
    "Book-Style Journal",
    "Daily Activity Selection",
    "3D University Runner",
    "Answer Lanes",
    "Contextual Mini-Game",
    "Journal Entry Update",
  ];
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Game Roadmap</h2>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-sm text-stone-700">
            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-700 text-amber-50 text-xs font-bold">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function RecentJournalsContent() {
  const entries = useJournalHistoryStore((s) => s.entries);
  const [index, setIndex] = useState(entries.length - 1);

  if (entries.length === 0) {
    return (
      <div className="text-sm text-stone-500 italic">
        No completed days yet — finish a campus run to start your journal history.
      </div>
    );
  }

  const clamped = Math.min(Math.max(index, 0), entries.length - 1);
  const entry = entries[clamped];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <button
          disabled={clamped === 0}
          onClick={() => setIndex(clamped - 1)}
          className="text-stone-500 disabled:opacity-30 hover:text-stone-800 px-2 text-lg"
        >
          ‹
        </button>
        <h2 className="text-lg font-bold">Day {entry.day}</h2>
        <button
          disabled={clamped === entries.length - 1}
          onClick={() => setIndex(clamped + 1)}
          className="text-stone-500 disabled:opacity-30 hover:text-stone-800 px-2 text-lg"
        >
          ›
        </button>
      </div>
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
  );
}

function GameDetailsContent() {
  const { xp, level, score } = useGameStore((s) => ({
    xp: s.xp,
    level: s.level,
    score: s.score,
  }));
  const streak = useJournalHistoryStore((s) => s.currentStreak());
  const assignments = useGameStore((s) => s.assignments);
  const exams = useGameStore((s) => s.exams);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Game Details</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          ["Level", level],
          ["XP", xp.toLocaleString()],
          ["Score", score.toLocaleString()],
          ["Streak", `${streak} day${streak === 1 ? "" : "s"}`],
        ].map(([label, val]) => (
          <div key={label} className="rounded-lg bg-amber-50 border border-amber-800/10 px-3 py-2">
            <div className="text-[10px] uppercase text-stone-500">{label}</div>
            <div className="text-lg font-bold text-stone-800">{val}</div>
          </div>
        ))}
      </div>
      <div className="text-sm font-semibold text-stone-700 mb-2">Assignments</div>
      <ul className="text-sm text-stone-600 space-y-1 mb-4">
        {assignments.map((a) => (
          <li key={a.id}>
            • {a.title} — <span className="italic">{a.status.replace(/_/g, " ").toLowerCase()}</span>
          </li>
        ))}
      </ul>
      <div className="text-sm font-semibold text-stone-700 mb-2">Exams</div>
      <ul className="text-sm text-stone-600 space-y-1">
        {exams.map((e) => (
          <li key={e.id}>
            • {e.subject} — {e.date ?? "date pending"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CharacterStatsContent() {
  const { xp, level } = useGameStore((s) => ({ xp: s.xp, level: s.level }));
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
  const Content = TAB_CONTENT[tab];

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
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-w-0"
          >
            <Page>
              <Content />
            </Page>
          </motion.div>
        </AnimatePresence>

        {/* tab rail */}
        <div className="hidden md:flex flex-col gap-2 bg-[#3a2415] p-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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
              onClick={() => setTab(t.id)}
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
