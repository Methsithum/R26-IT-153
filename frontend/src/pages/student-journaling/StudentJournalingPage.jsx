import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from '../../components/student-journaling/Dashboard';
import ActivitySelection from '../../components/student-journaling/ActivitySelection';
import MissionGeneration from '../../components/student-journaling/MissionGeneration';
import AIGuidePopup from '../../components/student-journaling/AIGuidePopup';
import MissionComplete from '../../components/student-journaling/MissionComplete';
import AchievementPopup from '../../components/student-journaling/AchievementPopup';
import { analyzeBehavior, getUserGamification, startDailySession } from '../../services/api';

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
  };
};

const buildBackendActivityList = (missionsList) => {
  const selected = missionsList
    .filter((mission) => mission.status === 'active')
    .map((mission) => ACTIVITY_TO_BACKEND[mission.id])
    .filter(Boolean);

  return selected.length > 0 ? selected : ['other'];
};

export default function StudentJournalingPage({ user = null }) {
  const [screen, setScreen] = useState('dashboard');
  const [direction, setDirection] = useState(1);
  const [missions, setMissions] = useState(INITIAL_MISSIONS);
  const [activeMission, setActiveMission] = useState(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [completedMission, setCompletedMission] = useState(null);
  const [completionResult, setCompletionResult] = useState(null);
  const [achievement, setAchievement] = useState(null);
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

        if (!cancelled) {
          setStudent((prev) => buildStudentState({ ...prev, ...user, id: activeUserId, ...gamification }));
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

  const handleActivitiesComplete = (newMissions) => {
    setMissions(prev => {
      const ids = new Set(newMissions.map(m => m.id));
      const merged = prev.filter(m => !ids.has(m.id));
      return [...newMissions, ...merged];
    });
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

    setMissions(prev => {
      const updated = prev.map(m =>
        m.id === activeMission.id ? { ...m, status: 'done', progress: 100 } : m
      );
      const lockedIdx = updated.findIndex(m => m.status === 'locked');
      if (lockedIdx !== -1) updated[lockedIdx] = { ...updated[lockedIdx], status: 'active' };
      return updated;
    });

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
    <div className="relative overflow-hidden" style={{ background: '#0d0f1a', minHeight: '100vh' }}>
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

      {/* AI Guide popup overlay */}
      <AIGuidePopup
        visible={guideVisible}
        mission={activeMission}
        session={journeySession}
        onSessionUpdate={setJourneySession}
        onComplete={handleGuideComplete}
        onClose={() => setGuideVisible(false)}
      />

      {/* Achievement toast */}
      <AchievementPopup
        achievement={achievement}
        onClose={() => setAchievement(null)}
      />
    </div>
  );
}
