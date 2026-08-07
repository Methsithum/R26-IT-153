import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getJournalHistory } from '../../services/journalApi';
import { isDemoUser } from '../../constants/demoMode';

export default function JournalHistoryPage({ userId, onBack, onOpenJournal }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || isDemoUser(userId)) {
      setSessions([]);
      setLoading(false);
      return;
    }
    getJournalHistory(userId)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="min-h-screen game-bg px-4 py-8 sm:px-8">
      <motion.div className="mx-auto max-w-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <button type="button" onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 mb-6">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white mb-6">📚 Journal History</h1>

        {loading && <p className="text-slate-400">Loading journals...</p>}

        <div className="space-y-3">
          {sessions.map((s, i) => {
            const date = s.date ? new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Unknown';
            const preview = (s.journal_entry || '').slice(0, 120);
            return (
              <motion.button
                key={s._id || s.id || i}
                type="button"
                className="game-panel w-full p-4 rounded-2xl text-left hover:border-violet-500/40 transition"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onOpenJournal?.(s)}
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-semibold text-white">{date}</p>
                  <span className="text-[10px] game-badge">{(s.selected_activities || []).length} activities</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{preview}...</p>
              </motion.button>
            );
          })}
        </div>

        {!loading && sessions.length === 0 && (
          <p className="text-slate-500 text-center py-12">No journal entries yet. Complete an adventure first!</p>
        )}
      </motion.div>
    </div>
  );
}
