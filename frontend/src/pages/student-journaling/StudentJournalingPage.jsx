import { useState } from 'react';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from '../../components/student-journaling/Dashboard';
import ActivitySelection from '../../components/student-journaling/ActivitySelection';
import MissionGeneration from '../../components/student-journaling/MissionGeneration';
import AIGuidePopup from '../../components/student-journaling/AIGuidePopup';
import MissionComplete from '../../components/student-journaling/MissionComplete';
import AchievementPopup from '../../components/student-journaling/AchievementPopup';

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

export default function StudentJournalingPage() {
  const [screen, setScreen] = useState('dashboard');
  const [direction, setDirection] = useState(1);
  const [missions, setMissions] = useState(INITIAL_MISSIONS);
  const [activeMission, setActiveMission] = useState(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [completedMission, setCompletedMission] = useState(null);
  const [achievement, setAchievement] = useState(null);
  const [totalXP, setTotalXP] = useState(2340);
  const achievementTimers = useRef([]);

  useEffect(() => {
    return () => {
      achievementTimers.current.forEach((timer) => clearTimeout(timer));
      achievementTimers.current = [];
    };
  }, []);

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
      setGuideVisible(true);
    }
  };

  const handleMissionClick = (m) => {
    if (m.status === 'active') {
      setActiveMission(m);
      setGuideVisible(true);
    }
  };

  const handleGuideComplete = (answers) => {
    setGuideVisible(false);

    setMissions(prev => {
      const updated = prev.map(m =>
        m.id === activeMission.id ? { ...m, status: 'done', progress: 100 } : m
      );
      const lockedIdx = updated.findIndex(m => m.status === 'locked');
      if (lockedIdx !== -1) updated[lockedIdx] = { ...updated[lockedIdx], status: 'active' };
      return updated;
    });

    setTotalXP(x => x + (activeMission?.xp || 30));
    setCompletedMission(activeMission);
    navigate('complete');

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
              totalXP={totalXP}
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
              xpGained={completedMission.xp}
              onContinue={() => navigate('dashboard')}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* AI Guide popup overlay */}
      <AIGuidePopup
        visible={guideVisible}
        mission={activeMission}
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
