import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from '../../components/student-journaling/Dashboard';
import ActivitySelection from '../../components/student-journaling/ActivitySelection';
import AdventurePreview from './AdventurePreview';
import AdventureComplete from './AdventureComplete';
import JournalPage from './JournalPage';
import JournalHistoryPage from './JournalHistoryPage';
import WeeklyReflection from './WeeklyReflection';
import SemesterReflection from './SemesterReflection';
import GameLoadingScreen from './GameLoadingScreen';
import AchievementPopup from '../../components/student-journaling/AchievementPopup';
import { analyzeBehavior, getUserGamification, getUserMissions, saveUserMissions } from '../../services/api';
import { startGameSession } from '../../services/gameApi';
import { buildMapSequence, ACTIVITY_TO_BACKEND, buildBackendActivities } from '../../constants/gameMaps';
import { isDemoUser, createDemoSession } from '../../constants/demoMode';
import { isLocalFirstJourneyComplete } from '../../constants/firstJourneyLocal';

const GamePage = lazy(() => import('./GamePage'));
const FirstJourneyPage = lazy(() => import('./FirstJourneyPage'));

const AUTH_STORAGE_KEY = 'smart-uni-guide-user-id';

const SCREENS = [
  'first-journey',
  'dashboard',
  'activities',
  'preview',
  'game',
  'adventure-complete',
  'journal',
  'journal-history',
  'weekly',
  'semester',
];

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

const buildStudentState = (user = null) => {
  const totalXP = user?.total_xp ?? 0;
  const completedSessions = user?.completed_sessions ?? user?.total_sessions ?? 0;
  return {
    id: user?.id,
    name: user?.name || 'Adventurer',
    email: user?.email,
    total_xp: totalXP,
    xp: totalXP,
    level: Math.floor(totalXP / 250) + 1,
    current_streak: user?.current_streak ?? 0,
    streak: user?.current_streak ?? 0,
    longest_streak: user?.longest_streak ?? 0,
    badges: user?.badges ?? [],
    missionsCompleted: completedSessions,
    completed_sessions: completedSessions,
    total_sessions: user?.total_sessions ?? completedSessions,
  };
};

export default function StudentJournalingPage({ user = null, onSignOut }) {
  const [screen, setScreen] = useState('dashboard');
  const [direction, setDirection] = useState(1);
  const [missions, setMissions] = useState([]);
  const [mapSequence, setMapSequence] = useState([]);
  const [student, setStudent] = useState(buildStudentState(user));
  const [journeySession, setJourneySession] = useState(null);
  const [completionResult, setCompletionResult] = useState(null);
  const [achievement, setAchievement] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const achievementTimers = useRef([]);

  useEffect(() => () => {
    achievementTimers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (user) setStudent(buildStudentState(user));
  }, [user]);

  const handleStartFromDashboard = () => {
    const userId = student.id || user?.id || localStorage.getItem(AUTH_STORAGE_KEY);
    if (userId && isDemoUser(userId) && !isLocalFirstJourneyComplete()) {
      navigate('first-journey');
      return;
    }
    navigate('activities');
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const userId = user?.id || localStorage.getItem(AUTH_STORAGE_KEY);
      if (!userId || isDemoUser(userId)) return;
      try {
        const [gamification, missionState] = await Promise.all([
          getUserGamification(userId),
          getUserMissions(userId),
        ]);
        if (cancelled) return;
        setStudent(buildStudentState({ ...user, id: userId, ...gamification }));
        if (Array.isArray(missionState?.missions) && missionState.missions.length > 0) {
          setMissions(missionState.missions);
        }
      } catch (_e) {
        /* keep defaults */
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const navigate = (to) => {
    const fromIdx = SCREENS.indexOf(screen);
    const toIdx = SCREENS.indexOf(to);
    setDirection(toIdx >= fromIdx ? 1 : -1);
    setScreen(to);
  };

  const persistMissions = async (missionsToSave) => {
    const userId = student.id || user?.id || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!userId || isDemoUser(userId)) return;
    try {
      await saveUserMissions(userId, missionsToSave);
    } catch (_e) { /* offline ok */ }
  };

  const handleActivitiesComplete = (newMissions) => {
    setMissions(newMissions);
    persistMissions(newMissions);
    setMapSequence(buildMapSequence(newMissions.map((m) => m.id)));
    navigate('preview');
  };

  const handleStartAdventure = async () => {
    const userId = student.id || user?.id || localStorage.getItem(AUTH_STORAGE_KEY);
    const activities = buildBackendActivities(missions);

    setSessionLoading(true);
    try {
      if (isDemoUser(userId)) {
        setJourneySession(createDemoSession());
        navigate('game');
        return;
      }

      let session = null;
      if (userId) {
        session = await startGameSession({
          userId,
          selectedActivities: activities.length ? activities : ['other'],
        });
        setJourneySession(session);
      }
      navigate('game');
    } catch (_e) {
      if (isDemoUser(userId)) {
        setJourneySession(createDemoSession());
      } else {
        setJourneySession(null);
      }
      navigate('game');
    } finally {
      setSessionLoading(false);
    }
  };

  const handleMissionComplete = (result) => {
    setMissions((prev) => {
      const updated = prev.map((m, i) => {
        if (i !== result.mapIndex) return m;
        return { ...m, progress: 100, status: 'done' };
      });
      persistMissions(updated);
      return updated;
    });
  };

  const handleAdventureComplete = async (result) => {
    setCompletionResult(result);
    navigate('adventure-complete');

    const userId = student.id;
    if (userId && !isDemoUser(userId)) {
      analyzeBehavior({ user_id: userId }).catch(() => {});
      try {
        const gamification = await getUserGamification(userId);
        setStudent(buildStudentState({ ...student, ...gamification }));
      } catch (_e) {
        if (result?.xp_earned) {
          const updatedXP = (student.total_xp || 0) + result.xp_earned;
          setStudent((prev) => ({
            ...prev,
            total_xp: updatedXP,
            xp: updatedXP,
            level: Math.floor(updatedXP / 250) + 1,
          }));
        }
      }
    }

    if (result?.new_badges?.length) {
      const t = setTimeout(() => {
        setAchievement({
          icon: '🏆',
          name: result.new_badges[0],
          desc: 'New badge unlocked!',
        });
        achievementTimers.current.push(setTimeout(() => setAchievement(null), 4000));
      }, 1200);
      achievementTimers.current.push(t);
    }
  };

  const isFullscreen = screen === 'game' || screen === 'first-journey';

  return (
    <div className={`min-h-screen ${isFullscreen ? '' : 'game-bg'}`}>
      {!isFullscreen && (
        <header
          className="sticky top-0 z-20 border-b border-violet-500/10 backdrop-blur-md px-4 py-3 flex items-center justify-between"
          style={{ background: 'rgba(10,10,18,0.85)' }}
        >
          <p className="text-xs font-semibold text-violet-300">Smart Uni Guide</p>
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs text-slate-500 hover:text-rose-400 transition px-3 py-1.5 rounded-lg border border-white/5"
          >
            Sign Out
          </button>
        </header>
      )}

      <main className={isFullscreen ? 'fixed inset-0' : 'relative overflow-hidden'}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={screen}
            custom={direction}
            variants={isFullscreen ? undefined : slideVariants}
            initial={isFullscreen ? undefined : 'enter'}
            animate={isFullscreen ? undefined : 'center'}
            exit={isFullscreen ? undefined : 'exit'}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className={isFullscreen ? 'h-full' : ''}
          >
            {screen === 'first-journey' && (
              <Suspense fallback={<GameLoadingScreen />}>
                <FirstJourneyPage
                  userId={student.id}
                  onComplete={() => navigate('dashboard')}
                  onExit={() => navigate('dashboard')}
                />
              </Suspense>
            )}

            {screen === 'dashboard' && (
              <Dashboard
                student={student}
                missions={missions}
                onStartJourney={handleStartFromDashboard}
                onJournal={() => navigate('journal-history')}
                onWeeklyReflection={() => navigate('weekly')}
                onSemesterReflection={() => navigate('semester')}
              />
            )}

            {screen === 'activities' && (
              <ActivitySelection
                onContinue={handleActivitiesComplete}
                onBack={() => navigate('dashboard')}
              />
            )}

            {screen === 'preview' && (
              <AdventurePreview
                maps={mapSequence}
                onStart={handleStartAdventure}
                onBack={() => navigate('activities')}
                isLoading={sessionLoading}
              />
            )}

            {screen === 'game' && (
              sessionLoading ? (
                <GameLoadingScreen />
              ) : (
                <Suspense fallback={<GameLoadingScreen />}>
                  <GamePage
                    maps={mapSequence}
                    missions={missions}
                    userId={student.id}
                    userId={student.id}
                    session={journeySession}
                    onMissionComplete={handleMissionComplete}
                    onAdventureComplete={handleAdventureComplete}
                    onExit={() => navigate('dashboard')}
                  />
                </Suspense>
              )
            )}

            {screen === 'adventure-complete' && (
              <AdventureComplete
                result={completionResult}
                sessionXp={completionResult?.xp_earned}
                streak={student.current_streak || student.streak}
                onViewJournal={() => navigate('journal')}
                onHome={() => navigate('dashboard')}
              />
            )}

            {screen === 'journal' && (
              <JournalPage
                result={completionResult}
                student={student}
                activities={missions}
                onHome={() => navigate('dashboard')}
                onViewHistory={() => navigate('journal-history')}
              />
            )}

            {screen === 'journal-history' && (
              <JournalHistoryPage
                userId={student.id}
                onBack={() => navigate('dashboard')}
                onOpenJournal={(s) => {
                  setCompletionResult({ journal_entry: s.journal_entry, xp_earned: 0 });
                  navigate('journal');
                }}
              />
            )}

            {screen === 'weekly' && (
              <WeeklyReflection
                userId={student.id}
                studentName={student.name}
                onBack={() => navigate('dashboard')}
              />
            )}

            {screen === 'semester' && (
              <SemesterReflection
                userId={student.id}
                student={student}
                onBack={() => navigate('dashboard')}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <AchievementPopup achievement={achievement} onClose={() => setAchievement(null)} />
      </main>
    </div>
  );
}

export { ACTIVITY_TO_BACKEND, buildMapSequence };
