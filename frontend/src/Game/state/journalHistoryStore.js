import { create } from "zustand";
import { persist } from "zustand/middleware";

// Cross-session record of completed daily journal entries — what powers
// the "Recent Journals" pages in the book-style Journal Home UI. Kept
// separate from GameStateManager (which resets per run) so history
// survives across visits.
export const useJournalHistoryStore = create(
  persist(
    (set, get) => ({
      entries: [], // { day, journalDay, xp, score, level, completedAt }

      addEntry: (entry) =>
        set((s) => ({
          entries: [...s.entries.filter((e) => e.day !== entry.day), entry].sort(
            (a, b) => a.day - b.day
          ),
        })),

      hydrateFromSessions: (sessions = []) => {
        const completed = (sessions || [])
          .filter((s) => s && s.completed)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        if (completed.length === 0) return;
        set({
          entries: completed.map((s, i) => ({
            day: i + 1,
            journalEntry: s.journal_entry,
            journalDay: {
              day: i + 1,
              responses: (s.qa_history || []).map((qa) => ({
                questionId: qa.question_id,
                category: "academic",
                answer: qa.answer,
                source: "backend",
              })),
              interactionsCompleted: [],
            },
            xp: 0,
            score: 0,
            level: 1,
            completedAt: s.date,
          })),
        });
      },

      currentStreak: () => {
        const days = get().entries.map((e) => e.day).sort((a, b) => b - a);
        if (days.length === 0) return 0;
        let streak = 1;
        for (let i = 1; i < days.length; i++) {
          if (days[i - 1] - days[i] === 1) streak++;
          else break;
        }
        return streak;
      },
    }),
    { name: "smart-uni-guide-journal-history" }
  )
);
