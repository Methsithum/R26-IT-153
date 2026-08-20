import { useCallback, useEffect, useRef, useState } from "react";
import { STATE_CFG, LEVEL_DATA, ACHIEVEMENTS_LIST, INTERVENTIONS } from "./focusData";
import { useFocusCamera } from "../../hooks/useFocusCamera";
import FocusHeader from "./FocusHeader";
import FocusFooter from "./FocusFooter";
import IntModal from "./IntModal";
import TabDashboard from "./views/Dashboard";
import TabMonitoring from "./views/Monitoring";
import TabTree from "./views/Tree";
import TabAchievements from "./views/Achievements";
import TabLeaderboard from "./views/Leaderboard";
import TabReport from "./views/Report";

const MANUAL_OVERRIDE_LOCK_MS = 5000; // ignore auto-detection briefly after a manual override click
const HIGH_CONFIDENCE = 0.70;         // only count a detection toward the challenge streak above this confidence
const CHALLENGE_SUSTAIN_MS = 5 * 60 * 1000; // how long the same distracted state must persist before a challenge pops up
const SPRINT_STREAK_MIN = 25;         // continuous focused minutes for the "25-min Sprint" bonus
const POINTS_PER_FOCUS_MIN = 10;
const SPRINT_BONUS_POINTS  = 50;
const GOAL_BONUS_POINTS    = 100;
const CHECKIN_INTERVAL_MS  = 5 * 60 * 1000; // auto-prompt "are you focusing?" every 5 minutes

// Everything below is derived purely from this session's real webcam detections —
// there's no persistence, so the app always starts at zero rather than showing
// stale/sample numbers from a previous "day".
export default function FocusApp() {
  const [tab, setTab] = useState("dashboard");
  const [state, setState] = useState("Focused");
  const [points, setPoints] = useState(0);
  const [focusMin, setFocusMin] = useState(0);
  const [streak, setStreak] = useState(0); // continuous focused-minutes streak, resets on any distraction
  const [sessionOn, setSessionOn] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInAns, setCheckInAns] = useState(null);
  const [dist, setDist] = useState({});
  const [interventionCounts, setInterventionCounts] = useState({ Fatigue: 0, Anxiety: 0, Boredom: 0 });
  const [everSprint25, setEverSprint25] = useState(false); // sticky flag for the achievement, independent of the live streak resetting

  const showModalRef  = useRef(showModal);
  const lastManualRef = useRef(0);
  const distractionStreakRef = useRef({ state: null, ms: 0 }); // sustained high-confidence distraction streak, for the challenge modal
  const focusStreakRef  = useRef(0); // ms of continuous focus
  const focusMinRef     = useRef(0); // total session focus minutes
  const lastAwardedMinRef  = useRef(0); // whole focus-minutes already paid out, avoids double-awarding
  const sprintBonusReadyRef = useRef(true); // one +50 bonus per continuous 25-min streak
  const goalBonusAwardedRef = useRef(false); // one +100 bonus per session
  useEffect(() => { showModalRef.current = showModal; }, [showModal]);

  // Auto-prompt the "are you focusing?" check-in every 5 minutes while the session
  // is active. Skips a beat if a challenge is already open rather than stacking modals.
  useEffect(() => {
    if (!sessionOn) return;
    const id = setInterval(() => {
      if (!showModalRef.current) {
        setCheckInAns(null);
        setShowCheckIn(true);
      }
    }, CHECKIN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [sessionOn]);

  const todayGoal = 120; // target focus minutes for today — a configured goal, not tracked data
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const lv = LEVEL_DATA.filter((l) => points >= l.min).length - 1;

  // Single-user "team" — this app has no accounts/backend, so the leaderboard
  // only ever has real data for you, not fabricated teammates.
  const TEAM = [{ id: "me", name: "You", pts: points, avatar: "🧑‍💻", isMe: true, focusToday: Math.round(focusMin), streak }];
  const sortedTeam = [...TEAM].sort((a, b) => b.pts - a.pts);
  const myRank = sortedTeam.findIndex((m) => m.isMe) + 1;

  const calmQuestCount = interventionCounts.Anxiety || 0;
  const earnedByKey = {
    sprint25: everSprint25,
    calmQuest5: calmQuestCount >= 5,
    zenMaster: calmQuestCount >= 10,
    treeWhisperer: lv >= 2,
    teamPlayer: myRank <= 2,
    // Multi-day achievements need persisted history this app doesn't have —
    // always locked rather than faked.
    perfectWeek: false,
    earlyBird: false,
    nightOwl: false,
    unbreakable: false,
  };
  const liveAchievements = ACHIEVEMENTS_LIST.map((a) => ({ ...a, earned: !!earnedByKey[a.key] }));

  const handleStateSelect = (nextState) => {
    lastManualRef.current = Date.now();
    setState(nextState);
    if (["Fatigue", "Anxiety", "Boredom"].includes(nextState)) setShowModal(true);
  };

  // Live prediction from the webcam, via the backend /focus/predict endpoint.
  // Owned here (not inside the Monitoring tab) so the camera session survives tab switches.
  //
  // The displayed state updates on every detection, but the challenge modal only pops
  // once the SAME distracted state has been detected with high confidence continuously
  // for CHALLENGE_SUSTAIN_MS — a state change or a low-confidence read resets the streak.
  const handleDetection = useCallback((nextState, _probs, elapsedMs, confidence) => {
    // A manual override click wins for a few seconds so it isn't instantly stomped
    // by the next auto-detection tick.
    if (Date.now() - lastManualRef.current < MANUAL_OVERRIDE_LOCK_MS) return;

    setState(nextState);
    const minutes = elapsedMs / 60000;

    if (nextState === "Focused") {
      focusStreakRef.current += elapsedMs;
      setStreak(Math.floor(focusStreakRef.current / 60000));

      focusMinRef.current += minutes;
      setFocusMin(+focusMinRef.current.toFixed(2));

      const wholeMinutesNow = Math.floor(focusMinRef.current);
      if (wholeMinutesNow > lastAwardedMinRef.current) {
        const newlyEarned = wholeMinutesNow - lastAwardedMinRef.current;
        lastAwardedMinRef.current = wholeMinutesNow;
        setPoints((p) => p + newlyEarned * POINTS_PER_FOCUS_MIN);
      }

      if (focusStreakRef.current / 60000 >= SPRINT_STREAK_MIN && sprintBonusReadyRef.current) {
        sprintBonusReadyRef.current = false;
        setPoints((p) => p + SPRINT_BONUS_POINTS);
        setEverSprint25(true);
      }

      if (focusMinRef.current >= todayGoal && !goalBonusAwardedRef.current) {
        goalBonusAwardedRef.current = true;
        setPoints((p) => p + GOAL_BONUS_POINTS);
      }
    } else {
      focusStreakRef.current = 0;
      sprintBonusReadyRef.current = true;
      setStreak(0);
      setDist((d) => ({ ...d, [nextState]: +((d[nextState] || 0) + minutes).toFixed(2) }));
    }

    const isDistracted = nextState !== "Focused";
    const isHighConfidence = (confidence || 0) >= HIGH_CONFIDENCE;

    if (isDistracted && isHighConfidence) {
      const dstreak = distractionStreakRef.current;
      dstreak.ms = dstreak.state === nextState ? dstreak.ms + elapsedMs : elapsedMs;
      dstreak.state = nextState;

      if (dstreak.ms >= CHALLENGE_SUSTAIN_MS && !showModalRef.current) {
        setShowModal(true);
        dstreak.ms = 0; // don't immediately re-trigger once this challenge is dismissed
      }
    } else {
      distractionStreakRef.current = { state: null, ms: 0 };
    }
  }, []);

  const handleInterventionComplete = useCallback((type) => {
    setPoints((p) => p + (INTERVENTIONS[type]?.reward || 20));
    setInterventionCounts((c) => ({ ...c, [type]: (c[type] || 0) + 1 }));
    setShowModal(false);
  }, []);

  const camera = useFocusCamera(sessionOn, handleDetection);
  const { captureVideoRef, canvasRef } = camera;

  // The header chip asserts a current state, so it follows the same rule as the
  // Monitoring card: with the camera live and no face in frame, no prediction is
  // running and `state` is only the last reading -- say "No face" instead of it.
  // `state` itself is left alone; it still drives interventions, the tree and scoring.
  const headerCfg = sessionOn && camera.camStatus === "live" && !camera.faceDetected
    ? STATE_CFG.NoFace
    : cfg;

  const VIEWS = {
    dashboard: <TabDashboard state={state} points={points} focusMin={focusMin} streak={streak} TEAM={TEAM} ACHIEVEMENTS_LIST={liveAchievements} LEVEL_DATA={LEVEL_DATA} todayGoal={todayGoal} dist={dist} myRank={myRank} />,
    monitoring: <TabMonitoring state={state} handleStateSelect={handleStateSelect} camera={camera} sessionOn={sessionOn} setSessionOn={setSessionOn} dist={dist} points={points} focusMin={focusMin} />,
    tree: <TabTree state={state} points={points} streak={streak} focusMin={focusMin} LEVEL_DATA={LEVEL_DATA} />,
    achievements: <TabAchievements ACHIEVEMENTS_LIST={liveAchievements} />,
    leaderboard: <TabLeaderboard TEAM={TEAM} myRank={myRank} />,
    report: <TabReport focusMin={focusMin} points={points} dist={dist} myRank={myRank} todayGoal={todayGoal} />,
  };

  return (
    <div className="min-h-screen text-slate-900"
      style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #f0fdf4 50%, #fef3c7 100%)", fontFamily: "'DM Sans',system-ui,sans-serif" }}>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl transition-all duration-1000" style={{ backgroundColor: cfg.color, opacity: 0.08 }} />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: "#22c55e", opacity: 0.06 }} />
      </div>

      <FocusHeader tab={tab} setTab={setTab} cfg={headerCfg} points={points} sessionOn={sessionOn} setSessionOn={setSessionOn} setShowCheckIn={setShowCheckIn} />

      {/* Hidden capture source for useFocusCamera — kept mounted here (not inside the
          Monitoring tab) so the webcam session survives switching tabs. */}
      <video ref={captureVideoRef} autoPlay playsInline muted
        style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Keyed on `tab` so the view's entrance animation replays on every switch. */}
      <div key={tab} className="max-w-7xl mx-auto px-4 py-6">{VIEWS[tab]}</div>

      {showCheckIn && (
        <div className="fixed bottom-6 right-6 z-50 w-80 fu-view">
          <div className="rounded-3xl p-5 border border-slate-200" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", boxShadow: "0 12px 40px -8px rgba(15,23,42,0.18), 0 0 40px rgba(34,197,94,0.15)" }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-slate-900">Quick Check-in 📋</p>
                <p className="text-xs text-slate-600">Are you focusing right now?</p>
              </div>
              <button onClick={() => setShowCheckIn(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>
            {checkInAns === null ? (
              <div className="flex gap-2">
                <button onClick={() => { setCheckInAns(true); setTimeout(() => { setShowCheckIn(false); setCheckInAns(null); }, 2000); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-green-500 text-white hover:bg-green-400 transition-all">✅ Yes</button>
                <button onClick={() => { setCheckInAns(false); setTimeout(() => { setShowCheckIn(false); setShowModal(true); setCheckInAns(null); }, 2000); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all">😔 No</button>
              </div>
            ) : (
              <p className={`text-sm font-semibold text-center py-1 ${checkInAns ? "text-green-600" : "text-orange-600"}`}>{checkInAns ? "Great! Keep going! 🌱" : "Let's try a quick challenge! 💪"}</p>
            )}
          </div>
        </div>
      )}

      {["Fatigue", "Anxiety", "Boredom"].includes(state) && (
        <IntModal open={showModal} type={state} onClose={() => setShowModal(false)} onComplete={handleInterventionComplete} />
      )}

      <FocusFooter />
    </div>
  );
}
