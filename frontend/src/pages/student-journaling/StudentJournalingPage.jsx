import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from '../../components/student-journaling/Dashboard';
import ActivitySelection from '../../components/student-journaling/ActivitySelection';
import MissionGeneration from '../../components/student-journaling/MissionGeneration';
import AIGuidePopup from '../../components/student-journaling/AIGuidePopup';
import MissionComplete from '../../components/student-journaling/MissionComplete';
import AchievementPopup from '../../components/student-journaling/AchievementPopup';
import ReflectionsPanel from '../../components/student-journaling/ReflectionsPanel';
import { analyzeBehavior, getUserGamification, getUserMissions, saveUserMissions, startDailySession } from '../../services/api';

const INITIAL_MISSIONS = [
  { id: 'oop', name: 'OOP Revision', subject: 'Object-Oriented Programming', type: 'revision', xp: 25, difficulty: 'Easy', status: 'done', icon: '📚', progress: 100 },
  { id: 'se', name: 'SE Assignment', subject: 'Software Engineering', type: 'assignment', xp: 30, difficulty: 'Medium', status: 'active', icon: '📝', progress: 60 },
  { id: 'proj', name: 'Smart Uni Guide Project', subject: 'Final Year Project', type: 'project', xp: 40, difficulty: 'Hard', status: 'locked', icon: '💻', progress: 0 },
];

const SCREENS = ['dashboard', 'activities', 'missions', 'journey', 'complete'];

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

const AUTH_STORAGE_KEY = 'smart-uni-guide-user-id';
const DEMO_USER = {
  name: 'Ashan Perera',
  email: 'demo@smartuniguide.local',
};

const ACTIVITY_TO_BACKEND = {
  assignment: 'assignment_work',
  project: 'project_development',
  revision: 'academic_study',
  internship: 'internship',
  club: 'club_participation',
  lab: 'academic_study',
};

const buildStudentState = (user = null) => {
  // Use provided user data, fallback to DEMO_USER for fields that might be missing
  const userData = user || DEMO_USER;
  const totalXP = user?.total_xp ?? 2340;
  const completedSessions = user?.completed_sessions ?? user?.total_sessions ?? 24;

  return {
    id: user?.id,
    name: userData.name || DEMO_USER.name,
    email: userData.email || DEMO_USER.email,
    total_xp: totalXP,
    xp: totalXP,
    level: Math.floor(totalXP / 250) + 1,
    current_streak: user?.current_streak ?? 12,
    streak: user?.current_streak ?? 12,
    longest_streak: user?.longest_streak ?? 12,
    badges: user?.badges ?? [],
    achievements: user?.badges?.length ?? 8,
    missionsCompleted: completedSessions,
    completed_sessions: completedSessions,
    total_sessions: user?.total_sessions ?? completedSessions,
  };
};

const buildBackendActivityList = (missionsList) => {
  const selected = missionsList
    .filter((mission) => mission.status === 'active')
    .map((mission) => ACTIVITY_TO_BACKEND[mission.id])
    .filter(Boolean);

  return selected.length > 0 ? selected : ['other'];
};

export default function StudentJournalingPage({ user = null, onSignOut }) {
  const [screen, setScreen] = useState('dashboard');
  const [direction, setDirection] = useState(1);
  const [missions, setMissions] = useState(INITIAL_MISSIONS);
  const [activeMission, setActiveMission] = useState(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [completedMission, setCompletedMission] = useState(null);
  const [completionResult, setCompletionResult] = useState(null);
  const [achievement, setAchievement] = useState(null);
  const [sidebarView, setSidebarView] = useState('journal');
  const [student, setStudent] = useState(buildStudentState(user));
  const [journeySession, setJourneySession] = useState(null);
  const achievementTimers = useRef([]);

  useEffect(() => {
    return () => {
      achievementTimers.current.forEach((timer) => clearTimeout(timer));
      achievementTimers.current = [];
    };
  }, []);

  // Update student data when user prop changes
  useEffect(() => {
    if (user) {
      setStudent(buildStudentState(user));
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapUser = async () => {
      try {
        const activeUserId = user?.id || localStorage.getItem(AUTH_STORAGE_KEY);
        if (!activeUserId) {
          if (!cancelled) {
            setStudent(buildStudentState(user));
          }
          return;
        }

        const gamification = await getUserGamification(activeUserId);
        const missionState = await getUserMissions(activeUserId);

        if (!cancelled) {
          setStudent((prev) => buildStudentState({ ...prev, ...user, id: activeUserId, ...gamification }));
          if (Array.isArray(missionState?.missions) && missionState.missions.length > 0) {
            setMissions(missionState.missions);
          }
        }
      } catch (_error) {
        if (!cancelled) {
          setStudent(buildStudentState(user));
        }
      }
    };

    bootstrapUser();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const navigate = (to) => {
    const fromIdx = SCREENS.indexOf(screen);
    const toIdx = SCREENS.indexOf(to);
    setDirection(toIdx >= fromIdx ? 1 : -1);
    setScreen(to);
  };

  const handleStartJourney = () => navigate('activities');

  const persistMissions = async (missionsToSave) => {
    const activeUserId = student.id || user?.id || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!activeUserId) {
      return;
    }

    try {
      await saveUserMissions(activeUserId, missionsToSave);
    } catch (_error) {
      // Keep the local flow working even if persistence is temporarily unavailable.
    }
  };

  const handleActivitiesComplete = (newMissions) => {
    // Replace existing missions with the newly generated missions
    setMissions(newMissions);
    persistMissions(newMissions);
    navigate('missions');
  };

  const handleBeginJourney = () => {
    const first = missions.find(m => m.status === 'active');
    if (first) {
      setActiveMission(first);
      const storedUserId = student.id || user?.id || localStorage.getItem(AUTH_STORAGE_KEY);
      const selectedActivities = buildBackendActivityList(missions);

      if (!storedUserId) {
        setJourneySession(null);
        setGuideVisible(true);
        return;
      }

      startDailySession({
        user_id: storedUserId,
        date: new Date().toISOString(),
        selected_activities: selectedActivities,
      })
        .then((session) => {
          setJourneySession(session);
          setGuideVisible(true);
        })
        .catch(() => {
          setJourneySession(null);
          setGuideVisible(true);
        });
    }
  };

  const handleMissionClick = (m) => {
    if (m.status === 'active') {
      setActiveMission(m);
      setGuideVisible(true);
    }
  };

  const handleGuideComplete = async ({ result } = {}) => {
    setGuideVisible(false);

    const updatedMissions = missions.map((m) => (
      m.id === activeMission.id ? { ...m, status: 'done', progress: 100 } : m
    ));
    const lockedIdx = updatedMissions.findIndex((m) => m.status === 'locked');
    if (lockedIdx !== -1) {
      updatedMissions[lockedIdx] = { ...updatedMissions[lockedIdx], status: 'active' };
    }

    setMissions(updatedMissions);
    persistMissions(updatedMissions);

    setCompletedMission(activeMission);
    setCompletionResult(result || null);
    setJourneySession(null);
    navigate('complete');

    if (student.id) {
      analyzeBehavior({ user_id: student.id }).catch(() => {
        // Behavior analysis is analytics-only; do not block the journal flow.
      });
    }

    if (student.id) {
      try {
        const gamification = await getUserGamification(student.id);
        setStudent(buildStudentState({ ...student, ...gamification }));
      } catch (_error) {
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

    const revealTimer = setTimeout(() => {
      setAchievement({ icon: '🏆', name: 'Consistent Scholar', desc: 'Completed 3 missions in a row' });
      const hideTimer = setTimeout(() => setAchievement(null), 4000);
      achievementTimers.current.push(hideTimer);
    }, 1500);
    achievementTimers.current.push(revealTimer);
  };

  return (
    <div className="min-h-screen" style={{ background: '#ffffff' }}>
      <div className="mx-auto flex w-full max-w-375 gap-4 px-3 py-3 sm:px-4 sm:py-4">
        <aside className="sticky top-3 h-[calc(100vh-1.5rem)] w-56 shrink-0 rounded-2xl border p-3 hidden md:flex md:flex-col" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Smart Uni Guide</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">Student Menu</p>
          </div>

          <button
            onClick={() => setSidebarView('journal')}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors"
            style={{
              background: sidebarView === 'journal' ? 'rgba(59,130,246,0.1)' : '#ffffff',
              borderColor: sidebarView === 'journal' ? 'rgba(59,130,246,0.3)' : '#e2e8f0',
              color: sidebarView === 'journal' ? '#1d4ed8' : '#334155',
            }}
          >
            Dashboard
          </button>

          <button
            onClick={() => setSidebarView('reflections')}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border mt-2 transition-colors"
            style={{
              background: sidebarView === 'reflections' ? 'rgba(168,85,247,0.1)' : '#ffffff',
              borderColor: sidebarView === 'reflections' ? 'rgba(168,85,247,0.3)' : '#e2e8f0',
              color: sidebarView === 'reflections' ? '#7e22ce' : '#334155',
            }}
          >
            Reflections
          </button>

          <div className="mt-auto">
            <button
              onClick={onSignOut}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors"
              style={{
                background: 'rgba(244,63,94,0.08)',
                borderColor: 'rgba(244,63,94,0.28)',
                color: '#be123c',
              }}
            >
              Sign Out
            </button>
          </div>
        </aside>

        <main className="relative overflow-hidden flex-1 rounded-2xl border" style={{ background: '#ffffff', borderColor: '#e2e8f0' }}>
          {sidebarView === 'journal' ? (
            <>
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={screen}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                >
                  {screen === 'dashboard' && (
                    <Dashboard
                      missions={missions}
                      student={student}
                      onStartJourney={handleStartJourney}
                      onMissionClick={handleMissionClick}
                    />
                  )}
                  {screen === 'activities' && (
                    <ActivitySelection onContinue={handleActivitiesComplete} />
                  )}
                  {screen === 'missions' && (
                    <MissionGeneration
                      missions={missions.filter(m => m.status !== 'done')}
                      onBeginJourney={handleBeginJourney}
                    />
                  )}
                  {screen === 'complete' && completedMission && (
                    <MissionComplete
                      mission={completedMission}
                      xpGained={completionResult?.xp_earned || completedMission.xp}
                      result={completionResult}
                      onContinue={() => navigate('dashboard')}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <AIGuidePopup
                visible={guideVisible}
                mission={activeMission}
                session={journeySession}
                onSessionUpdate={setJourneySession}
                onComplete={handleGuideComplete}
                onClose={() => setGuideVisible(false)}
              />

              <AchievementPopup
                achievement={achievement}
                onClose={() => setAchievement(null)}
              />
            </>
          ) : (
            <ReflectionsPanel userId={student.id || user?.id} />
          )}
        </main>
      </div>
    </div>
  );
}
