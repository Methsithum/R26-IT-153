import { create } from "zustand";
import { persist } from "zustand/middleware";
import { levelFromXp } from "../data/progression";

function sessionsToEntries(sessions = []) {
  let runningXp = 0;
  return (sessions || [])
    .filter((session) => session && session.completed)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((session, index) => {
      runningXp += Number(session.xp_earned || 0);
      return {
        day: index + 1,
        date: String(session.date || "").slice(0, 10),
        journalEntry: session.journal_entry || "",
        highlights: session.journal_highlights || [],
        journalDay: {
          day: index + 1,
          responses: (session.qa_history || []).map((qa) => ({
            questionId: qa.question_id,
            questionText: qa.question,
            category: "academic",
            answer: qa.answer,
            source: "backend",
          })),
          interactionsCompleted: [],
        },
        xp: session.xp_earned || 0,
        score: session.score_earned || 0,
        level: levelFromXp(runningXp),
        completedAt: session.date,
      };
    });
}

export const useJournalHistoryStore = create(
  persist(
    (set, get) => ({
      userId: null,
      entries: [],

      addEntry: (entry) =>
        set((state) => ({
          entries: [...state.entries.filter((item) => item.day !== entry.day), entry].sort(
            (a, b) => a.day - b.day
          ),
        })),

      hydrateFromSessions: (sessions = [], userId = null) => {
        set({
          userId: userId || null,
          entries: sessionsToEntries(sessions),
        });
      },

      reset: () => set({ userId: null, entries: [] }),

      currentStreak: () => {
        const days = get().entries.map((entry) => entry.day).sort((a, b) => b - a);
        if (days.length === 0) return 0;
        let streak = 1;
        for (let i = 1; i < days.length; i++) {
          if (days[i - 1] - days[i] === 1) streak += 1;
          else break;
        }
        return streak;
      },
    }),
    {
      name: "smart-uni-guide-journal-history-v2",
      version: 2,
      migrate: () => ({ userId: null, entries: [] }),
    }
  )
);
