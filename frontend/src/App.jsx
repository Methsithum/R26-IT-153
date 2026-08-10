import { useEffect, useState } from 'react';
import StudentJournalingPage from './pages/student-journaling/StudentJournalingPage';
import LoginPage from './pages/auth/LoginPage';
import { loginUser, registerUser, getUser, getUserGamification } from './services/api';
import { DEMO_USER_ID } from './constants/demoMode';

const AUTH_STORAGE_KEY = 'smart-uni-guide-user-id';

const DEMO_USER = {
  id: DEMO_USER_ID,
  name: 'Demo Player',
  email: 'demo@test.local',
  total_xp: 500,
  xp: 500,
  level: 3,
  current_streak: 3,
  streak: 3,
  longest_streak: 5,
  badges: [],
  completed_sessions: 0,
  total_sessions: 0,
  first_journey_completed: false,
};

async function loadUserProfile(userId) {
  if (userId === DEMO_USER_ID) {
    return { ...DEMO_USER };
  }

  const [user, gamification] = await Promise.all([
    getUser(userId),
    getUserGamification(userId),
  ]);

  return {
    ...user,
    ...gamification,
  };
}

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const storedUserId = localStorage.getItem(AUTH_STORAGE_KEY);

      if (!storedUserId) {
        // Testing mode: skip login, go straight to demo game
        if (!cancelled) {
          localStorage.setItem(AUTH_STORAGE_KEY, DEMO_USER_ID);
          setAuthUser({ ...DEMO_USER });
          setAuthLoading(false);
        }
        return;
      }

      try {
        const profile = await loadUserProfile(storedUserId);
        if (!cancelled) {
          setAuthUser(profile);
        }
      } catch (_error) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAuth = async ({ name, email, password }) => {
    setAuthError('');
    setAuthLoading(true);

    try {
      let user;
      if (isRegisterMode) {
        user = await registerUser({ name, email, password });
      } else {
        user = await loginUser({ email, password });
      }
      const profile = await loadUserProfile(user.id);
      localStorage.setItem(AUTH_STORAGE_KEY, user.id);
      setAuthUser(profile);
    } catch (error) {
      const message = error?.response?.data?.detail || error?.response?.data?.message || (isRegisterMode ? 'Failed to create account.' : 'Invalid email or password.');
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setAuthError('');
  };

  const handleSignOut = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthUser(null);
    setAuthError('');
    setAuthLoading(false);
  };

  const handleDemoPlay = () => {
    localStorage.setItem(AUTH_STORAGE_KEY, DEMO_USER_ID);
    setAuthUser({ ...DEMO_USER });
    setAuthError('');
    setAuthLoading(false);
  };

  if (authLoading && !authUser) {
    return <LoginPage onSubmit={() => {}} isLoading isRegister={isRegisterMode} />;
  }

  if (!authUser) {
    return (
      <div>
        <LoginPage onSubmit={handleAuth} isLoading={authLoading} error={authError} isRegister={isRegisterMode} />
        <div className="fixed bottom-4 left-0 right-0 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleDemoPlay}
            className="text-sm font-semibold text-violet-300 hover:text-violet-100 transition px-5 py-2.5 rounded-xl border border-violet-500/40 bg-violet-500/10"
          >
            🎮 Test Game (Skip Login)
          </button>
          <button
            onClick={toggleMode}
            className="text-xs text-slate-400 hover:text-slate-200 transition"
          >
            {isRegisterMode ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    );
  }

  return <StudentJournalingPage user={authUser} onSignOut={handleSignOut} />;
}
