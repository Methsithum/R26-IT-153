import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getUserReflections } from '../../services/api';

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
};

const formatTimestamp = (value) => {
  if (!value) return 'Unknown date';
  try {
    return new Date(value).toLocaleDateString();
  } catch (_error) {
    return String(value);
  }
};

const extractReflectionText = (entry) => {
  if (!entry || typeof entry !== 'object') return 'No summary available.';
  return (
    entry.reflection ||
    entry.content ||
    entry.summary ||
    entry.text ||
    entry.weekly_reflection ||
    entry.semester_reflection ||
    'No summary available.'
  );
};

export default function ReflectionsPanel({ userId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekly, setWeekly] = useState([]);
  const [semester, setSemester] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadReflections = async () => {
      if (!userId) {
        setWeekly([]);
        setSemester([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await getUserReflections(userId);
        if (!cancelled) {
          setWeekly(toArray(data?.weekly));
          setSemester(toArray(data?.semester));
        }
      } catch (_error) {
        if (!cancelled) {
          setError('Unable to load reflections right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReflections();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const allReflections = useMemo(
    () => [
      ...weekly.map((item) => ({ ...item, type: 'Weekly' })),
      ...semester.map((item) => ({ ...item, type: 'Semester' })),
    ],
    [weekly, semester]
  );

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8" style={{ background: '#f8fafc' }}>
      <motion.div
        className="mx-auto w-full max-w-6xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-blue-600/70 mb-1">Reflection History</p>
          <h1 className="text-2xl font-semibold text-slate-800">Your Reflections</h1>
          <p className="text-sm text-slate-600 mt-1">Weekly and semester insights from your journaling journey.</p>
        </div>

        {loading && (
          <div className="rounded-2xl border p-5 text-sm text-slate-600" style={{ background: '#ffffff', borderColor: '#e2e8f0' }}>
            Loading reflections...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border p-5 text-sm text-rose-700" style={{ background: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.26)' }}>
            {error}
          </div>
        )}

        {!loading && !error && allReflections.length === 0 && (
          <div className="rounded-2xl border p-5 text-sm text-slate-600" style={{ background: '#ffffff', borderColor: '#e2e8f0' }}>
            No reflections yet. Complete a few journaling sessions and come back here.
          </div>
        )}

        {!loading && !error && allReflections.length > 0 && (
          <div className="grid gap-3">
            {allReflections.map((item, index) => (
              <motion.div
                key={`${item.type}-${item.id || item._id || index}`}
                className="rounded-2xl border p-4"
                style={{ background: '#ffffff', borderColor: '#e2e8f0' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full border font-semibold"
                    style={{
                      background: item.type === 'Weekly' ? 'rgba(59,130,246,0.1)' : 'rgba(168,85,247,0.1)',
                      color: item.type === 'Weekly' ? '#1d4ed8' : '#7e22ce',
                      borderColor: item.type === 'Weekly' ? 'rgba(59,130,246,0.3)' : 'rgba(168,85,247,0.3)',
                    }}
                  >
                    {item.type}
                  </span>
                  <span className="text-xs text-slate-500">{formatTimestamp(item.created_at || item.date || item.updated_at)}</span>
                </div>
                <p className="text-sm text-slate-700 leading-6">{extractReflectionText(item)}</p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
