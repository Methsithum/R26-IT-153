import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Flag, GraduationCap, LockKeyhole, MapPin, Trees } from "lucide-react";
import { useGameStore } from "../../Game/state/GameStateManager";
import { useJournalHistoryStore } from "../../Game/state/journalHistoryStore";
import { formatCampusDate } from "../../services/localDate";
import "./roadmap.css";

const CHAPTER_SIZE = 6;
const POINTS = [[14, 27], [50, 27], [86, 27], [86, 72], [50, 72], [14, 72]];

export default function RoadmapContent({ onViewDay }) {
  const navigate = useNavigate();
  const currentDay = useGameStore((s) => s.day);
  const dailyCompleted = useGameStore((s) => s.dailyCompleted);
  const missedDates = useGameStore((s) => s.missedDates);
  const playDate = useGameStore((s) => s.playDate);
  const entries = useJournalHistoryStore((s) => s.entries);
  const activeChapter = Math.floor((currentDay - 1) / CHAPTER_SIZE);
  const [chapterChoice, setChapterChoice] = useState(null);
  const lastChapter = Math.floor((currentDay + 2) / CHAPTER_SIZE);
  const chapter = Math.min(chapterChoice ?? activeChapter, lastChapter);
  const firstDay = chapter * CHAPTER_SIZE + 1;
  const catchingUp = !dailyCompleted && (missedDates || []).length > 0;
  const completedDays = new Set(entries.map((entry) => entry.day));
  const days = Array.from({ length: CHAPTER_SIZE }, (_, index) => firstDay + index);
  const completed = days.filter((day) => day < currentDay || (day === currentDay && dailyCompleted)).length;

  function stateFor(day) {
    if (day < currentDay || (day === currentDay && dailyCompleted)) return "completed";
    if (day === currentDay) return catchingUp ? "catchup" : "current";
    return "locked";
  }

  function openDay(day) {
    if (day === currentDay && !dailyCompleted) navigate("/journal/activities");
    else if (completedDays.has(day)) onViewDay?.(day);
  }

  return (
    <section className="campus-roadmap" aria-labelledby="roadmap-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[.22em] text-brand-500">Your campus adventure</div>
          <h2 id="roadmap-title" className="font-display text-xl font-bold text-slate-800 dark:text-white">Game Roadmap</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Follow the trail. Every checkpoint holds a campus day.</p>
        </div>
        <button type="button" onClick={() => setChapterChoice(null)} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-600 dark:bg-white/5 dark:text-brand-300"><MapPin size={13} className="mr-1 inline" />Find my day</button>
      </header>

      <div className="roadmap-layout">
        <div className="roadmap-map-panel">
          <nav aria-label="Roadmap chapters" className="flex items-center justify-between gap-2 px-3 pt-3 sm:px-5">
            <button type="button" aria-label="Previous chapter" disabled={chapter === 0} onClick={() => setChapterChoice(chapter - 1)} className="roadmap-nav"><ChevronLeft size={18} /></button>
            <div className="text-center" aria-live="polite">
              <div className="text-xs font-bold text-brand-700 dark:text-brand-200">CHAPTER {String(chapter + 1).padStart(2, "0")}</div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Days {firstDay}–{firstDay + CHAPTER_SIZE - 1} · {completed}/{CHAPTER_SIZE} complete</div>
            </div>
            <button type="button" aria-label="Next chapter" disabled={chapter === lastChapter} onClick={() => setChapterChoice(chapter + 1)} className="roadmap-nav"><ChevronRight size={18} /></button>
          </nav>

          <div className="roadmap-trail" aria-label={`Chapter ${chapter + 1} checkpoints`}>
            <svg className="roadmap-road" viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden="true">
              <path d="M112 108 H688 C790 108 790 288 688 288 H112" fill="none" stroke="var(--trail-edge)" strokeWidth="30" strokeLinecap="round" />
              <path d="M112 108 H688 C790 108 790 288 688 288 H112" fill="none" stroke="var(--trail-fill)" strokeWidth="23" strokeLinecap="round" />
              <path d="M112 108 H688 C790 108 790 288 688 288 H112" fill="none" stroke="var(--trail-edge)" strokeWidth="2" strokeDasharray="5 9" />
            </svg>
            <div className="roadmap-landmark roadmap-library" aria-hidden="true"><GraduationCap size={30} strokeWidth={1.4} /><span>Campus quad</span></div>
            <div className="roadmap-landmark roadmap-garden" aria-hidden="true"><Trees size={30} strokeWidth={1.4} /><span>Study garden</span></div>
            <div className="roadmap-trail-label" aria-hidden="true"><Flag size={14} /> ONE DAY AT A TIME</div>

            {days.map((day, index) => {
              const state = stateFor(day);
              const active = day === currentDay && !dailyCompleted;
              const canOpen = active || completedDays.has(day);
              return (
                <div key={day} className={`roadmap-checkpoint is-${state}`} style={{ left: `${POINTS[index][0]}%`, top: `${POINTS[index][1]}%` }}>
                  {active && <span className="roadmap-you">YOU ARE HERE</span>}
                  <button type="button" className="roadmap-node" disabled={!canOpen} aria-label={`Day ${day}, ${state}${active ? ", play" : completedDays.has(day) ? ", open journal" : ""}`} aria-current={active ? "step" : undefined} onClick={() => openDay(day)}>
                    {state === "locked" ? <LockKeyhole size={20} strokeWidth={2} /> : <span>{day}</span>}
                    {state === "completed" && <span className="roadmap-check"><Check size={12} strokeWidth={3} /></span>}
                  </button>
                  <span className="roadmap-day-label">Day {day}</span>
                  <span className="roadmap-node-caption">{active ? catchingUp ? "Catch up" : "Play today" : state === "completed" ? "Recorded" : "Locked"}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-brand-100 px-3 py-3 text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-400">
            <span><i className="roadmap-key bg-emerald-500" />Recorded</span><span><i className={`roadmap-key ${catchingUp ? "bg-pink-500" : "bg-brand-500"}`} />Your next day</span><span><i className="roadmap-key bg-brand-100" />Coming next</span>
          </div>
        </div>

        <aside className={`roadmap-mission ${catchingUp ? "is-catchup" : ""}`}>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-brand-500"><Flag size={14} />{dailyCompleted ? "Mission complete" : catchingUp ? "Catch-up mission" : "Your next mission"}</div>
          <div className="roadmap-day-medal"><span>DAY</span><strong>{String(currentDay).padStart(2, "0")}</strong>{dailyCompleted ? <Check size={18} /> : <GraduationCap size={22} />}</div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{dailyCompleted ? "Another page in your story" : catchingUp ? "Pick up your adventure" : "Your campus is waiting"}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{dailyCompleted ? "Your day is recorded. Open the journal to revisit it." : catchingUp ? `Record ${formatCampusDate(playDate)} first. Today's run will still be waiting.` : `Complete Day ${currentDay} to unlock the next checkpoint.`}</p>
          <div className="my-4 flex items-center gap-2 border-y border-brand-100 py-3 text-xs text-brand-600 dark:border-white/10 dark:text-brand-300"><BookOpen size={16} />One campus run. One journal page.</div>
          <button type="button" className="roadmap-play" disabled={dailyCompleted && !completedDays.has(currentDay)} onClick={() => openDay(currentDay)}>{dailyCompleted ? "Open journal" : `Play Day ${currentDay}`}<ArrowRight size={16} /></button>
          <p className="mt-3 text-center text-[10px] text-slate-400">{dailyCompleted ? "The next adventure begins tomorrow" : "Your progress continues from here"}</p>
        </aside>
      </div>
    </section>
  );
}
