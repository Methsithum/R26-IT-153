import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATE_CFG, LEVEL_DATA, ACHIEVEMENTS_LIST } from "./focusData";
import { useFocusCamera } from "../../hooks/useFocusCamera";
import { saveFocusSession, getDailyReport, getWeeklyReport, getFocusProfile, flushFocusSession } from "../../lib/focusApi";
import { combineHM, mergeLiveWeek } from "../../lib/focusTime";
import FocusHeader from "./FocusHeader";
import FocusFooter from "./FocusFooter";
import IntModal from "./IntModal";
import TabDashboard from "./views/Dashboard";
import TabMonitoring from "./views/Monitoring";
import TabTree from "./views/Tree";
import TabAchievements from "./views/Achievements";
import TabLeaderboard from "./views/Leaderboard";
import TabReport from "./views/Report";

const MANUAL_OVERRIDE_LOCK_MS = 5000;
const HIGH_CONFIDENCE = 0.70;
const CHALLENGE_SUSTAIN_MS = 5 * 60 * 1000;
const SPRINT_STREAK_MIN = 25;
const CHECKIN_INTERVAL_MS = 5 * 60 * 1000;
const SAVE_INTERVAL_MS = 60 * 1000;
const TODAY_GOAL = 120;
const CHECKIN_PROMPT = "Are you focusing right now?";

function speakCheckIn(text = CHECKIN_PROMPT) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const speak = () => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 1;
    utter.pitch = 1;
    const voices = synth.getVoices();
    const en = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (en) utter.voice = en;
    synth.speak(utter);
  };

  if (synth.getVoices().length) {
    speak();
    return;
  }
  synth.addEventListener("voiceschanged", speak, { once: true });
}

export default function FocusApp() {
  const [tab, setTab] = useState("dashboard");
  const [state, setState] = useState("Focused");
  const [sessionFocusMin, setSessionFocusMin] = useState(0);
  const [sessionDistMin, setSessionDistMin] = useState(0);
  const [todayBaseFocus, setTodayBaseFocus] = useState(0);
  const [todayBaseDist, setTodayBaseDist] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sessionOn, setSessionOn] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInAns, setCheckInAns] = useState(null);
  const [interventionCounts, setInterventionCounts] = useState({ Fatigue: 0, Anxiety: 0, Boredom: 0 });
  const [everSprint25, setEverSprint25] = useState(false);
  const [weekly, setWeekly] = useState(null);
  const [savedAchievements, setSavedAchievements] = useState([]);
  const [lifetimeBaseMin, setLifetimeBaseMin] = useState(0);

  const showModalRef = useRef(showModal);
  const lastManualRef = useRef(0);
  const distractionStreakRef = useRef({ state: null, ms: 0 });
  const focusStreakRef = useRef(0);
  const todayBaseFocusRef = useRef(0);
  const todayBaseDistRef = useRef(0);
  const sessionFocusRef = useRef(0);
  const sessionDistRef = useRef(0);
  const longestStreakRef = useRef(0);
  const countingRef = useRef(false);
  const persistReadyRef = useRef(false);
  const sprintBonusReadyRef = useRef(true);
  const firstHourRef = useRef(null);
  const calmQuestRef = useRef(0);
  useEffect(() => { showModalRef.current = showModal; }, [showModal]);

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

  useEffect(() => {
    if (!showCheckIn || checkInAns !== null) {
      window.speechSynthesis?.cancel();
      return;
    }
    speakCheckIn(CHECKIN_PROMPT);
    return () => window.speechSynthesis?.cancel();
  }, [showCheckIn, checkInAns]);

  const todayGoal = TODAY_GOAL;
  const todayFocusMin = todayBaseFocus + sessionFocusMin;
  const todayDistMin = todayBaseDist + sessionDistMin;

  const sessionPayload = useCallback(() => ({
    focus_minutes: todayBaseFocusRef.current + sessionFocusRef.current,
    distraction_minutes: todayBaseDistRef.current + sessionDistRef.current,
    longest_streak_minutes: longestStreakRef.current,
    today_goal: todayGoal,
    calm_quest_count: calmQuestRef.current,
    first_hour: firstHourRef.current,
  }), [todayGoal]);

  const persistSession = useCallback(async () => {
    if (!persistReadyRef.current) return;
    try {
      const saved = await saveFocusSession(sessionPayload());
      if (saved?.achievements_unlocked) setSavedAchievements(saved.achievements_unlocked);
    } catch (err) {
      console.warn("Failed to save focus session", err);
    }
  }, [sessionPayload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [report, week, profile] = await Promise.all([
          getDailyReport(),
          getWeeklyReport(),
          getFocusProfile(),
        ]);
        if (cancelled) return;
        const focus = combineHM(report.focus_hours, report.focus_minutes);
        const dist = combineHM(report.distraction_hours, report.distraction_minutes);
        const lifetime = combineHM(profile.total_focus_hours, profile.total_focus_minutes);
        todayBaseFocusRef.current = focus;
        todayBaseDistRef.current = dist;
        setTodayBaseFocus(focus);
        setTodayBaseDist(dist);
        sessionFocusRef.current = 0;
        sessionDistRef.current = 0;
        setSessionFocusMin(0);
        setSessionDistMin(0);
        longestStreakRef.current = Math.max(report.longest_streak_minutes || 0, profile.longest_streak_minutes || 0);
        firstHourRef.current = report.first_hour ?? null;
        const calm = report.calm_quest_count || 0;
        calmQuestRef.current = calm;
        setInterventionCounts((c) => ({ ...c, Anxiety: calm }));
        if ((report.longest_streak_minutes || 0) >= SPRINT_STREAK_MIN || (profile.achievements_unlocked || []).includes("sprint25")) {
          setEverSprint25(true);
        }
        setLifetimeBaseMin(Math.max(0, lifetime - focus));
        setWeekly(week);
        setSavedAchievements(profile.achievements_unlocked || []);
        persistReadyRef.current = true;
      } catch (err) {
        console.warn("Failed to load focus data", err);
      } finally {
        if (!cancelled) countingRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sessionOn) {
      persistSession();
      return;
    }
    const id = setInterval(persistSession, SAVE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      persistSession();
    };
  }, [sessionOn, persistSession]);

  useEffect(() => {
    if (tab === "report" || tab === "leaderboard") persistSession();
  }, [tab, persistSession]);

  useEffect(() => {
    const onLeave = () => {
      if (!persistReadyRef.current) return;
      flushFocusSession(sessionPayload());
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [sessionPayload]);

  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const lifetimeMin = lifetimeBaseMin + todayFocusMin;
  const lv = LEVEL_DATA.filter((l) => lifetimeMin >= l.min).length - 1;

  const liveWeek = useMemo(
    () => mergeLiveWeek(weekly, todayFocusMin, todayDistMin),
    [weekly, todayFocusMin, todayDistMin],
  );

  const calmQuestCount = interventionCounts.Anxiety || 0;
  const weekFocusDays = (liveWeek.days || []).filter((d) => combineHM(d.focus_hours, d.focus_minutes) > 0).length;
  const unbreakable = (liveWeek.days || []).length === 7
    && (liveWeek.days || []).every((d) => combineHM(d.focus_hours, d.focus_minutes) > 0);
  const hour = firstHourRef.current;
  const earnedByKey = {
    sprint25: everSprint25 || longestStreakRef.current >= SPRINT_STREAK_MIN || savedAchievements.includes("sprint25"),
    calmQuest5: calmQuestCount >= 5 || savedAchievements.includes("calmQuest5"),
    zenMaster: calmQuestCount >= 10 || savedAchievements.includes("zenMaster"),
    treeWhisperer: lv >= 2 || savedAchievements.includes("treeWhisperer"),
    teamPlayer: todayFocusMin > 0 || savedAchievements.includes("teamPlayer"),
    perfectWeek: weekFocusDays >= 5 || savedAchievements.includes("perfectWeek"),
    earlyBird: (hour !== null && hour < 7) || savedAchievements.includes("earlyBird"),
    nightOwl: (hour !== null && hour >= 21) || savedAchievements.includes("nightOwl"),
    unbreakable: unbreakable || savedAchievements.includes("unbreakable"),
  };
  const liveAchievements = ACHIEVEMENTS_LIST.map((a) => ({ ...a, earned: !!earnedByKey[a.key] }));

  const handleStateSelect = (nextState) => {
    lastManualRef.current = Date.now();
    setState(nextState);
    if (["Fatigue", "Anxiety", "Boredom"].includes(nextState)) setShowModal(true);
  };

  const handleDetection = useCallback((nextState, _probs, elapsedMs, confidence) => {
    if (!countingRef.current) return;
    if (Date.now() - lastManualRef.current < MANUAL_OVERRIDE_LOCK_MS) return;

    setState(nextState);
    const minutes = elapsedMs / 60000;
    if (firstHourRef.current === null && minutes > 0) {
      firstHourRef.current = new Date().getHours();
    }

    if (nextState === "Focused") {
      focusStreakRef.current += elapsedMs;
      const newStreak = Math.floor(focusStreakRef.current / 60000);
      setStreak(newStreak);
      if (newStreak > longestStreakRef.current) longestStreakRef.current = newStreak;

      sessionFocusRef.current += minutes;
      setSessionFocusMin(+sessionFocusRef.current.toFixed(2));

      if (focusStreakRef.current / 60000 >= SPRINT_STREAK_MIN && sprintBonusReadyRef.current) {
        sprintBonusReadyRef.current = false;
        setEverSprint25(true);
      }
    } else {
      focusStreakRef.current = 0;
      sprintBonusReadyRef.current = true;
      setStreak(0);
      sessionDistRef.current += minutes;
      setSessionDistMin(+sessionDistRef.current.toFixed(2));
    }

    const isDistracted = nextState !== "Focused";
    const isHighConfidence = (confidence || 0) >= HIGH_CONFIDENCE;

    if (isDistracted && isHighConfidence) {
      const dstreak = distractionStreakRef.current;
      dstreak.ms = dstreak.state === nextState ? dstreak.ms + elapsedMs : elapsedMs;
      dstreak.state = nextState;

      if (dstreak.ms >= CHALLENGE_SUSTAIN_MS && !showModalRef.current) {
        setShowModal(true);
        dstreak.ms = 0;
      }
    } else {
      distractionStreakRef.current = { state: null, ms: 0 };
    }
  }, []);

  const handleInterventionComplete = useCallback((type) => {
    setInterventionCounts((c) => {
      const next = { ...c, [type]: (c[type] || 0) + 1 };
      if (type === "Anxiety") calmQuestRef.current = next.Anxiety;
      return next;
    });
    setShowModal(false);
  }, []);

  const camera = useFocusCamera(sessionOn, handleDetection);
  const { captureVideoRef, canvasRef } = camera;

  const headerCfg = sessionOn && camera.camStatus === "live" && !camera.faceDetected
    ? STATE_CFG.NoFace
    : cfg;

  const VIEWS = {
    dashboard: (
      <TabDashboard
        state={state}
        focusMin={todayFocusMin}
        streak={streak}
        ACHIEVEMENTS_LIST={liveAchievements}
        LEVEL_DATA={LEVEL_DATA}
        todayGoal={todayGoal}
        distMin={todayDistMin}
        lifetimeMin={lifetimeMin}
        week={liveWeek}
      />
    ),
    monitoring: (
      <TabMonitoring
        state={state}
        handleStateSelect={handleStateSelect}
        camera={camera}
        sessionOn={sessionOn}
        setSessionOn={setSessionOn}
        distMin={sessionDistMin}
        focusMin={sessionFocusMin}
      />
    ),
    tree: (
      <TabTree
        state={state}
        lifetimeMin={lifetimeMin}
        streak={streak}
        focusMin={todayFocusMin}
        LEVEL_DATA={LEVEL_DATA}
      />
    ),
    achievements: <TabAchievements ACHIEVEMENTS_LIST={liveAchievements} />,
    leaderboard: (
      <TabLeaderboard
        focusMin={todayFocusMin}
        distMin={todayDistMin}
        streak={streak}
        longestStreak={longestStreakRef.current}
        lifetimeMin={lifetimeMin}
        week={liveWeek}
      />
    ),
    report: (
      <TabReport
        focusMin={sessionFocusMin}
        distMin={sessionDistMin}
        todayFocusMin={todayFocusMin}
        todayDistMin={todayDistMin}
        todayGoal={todayGoal}
        week={liveWeek}
      />
    ),
  };

  return (
    <div className="min-h-screen text-slate-900"
      style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #f0fdf4 50%, #fef3c7 100%)", fontFamily: "'DM Sans',system-ui,sans-serif" }}>

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl transition-all duration-1000" style={{ backgroundColor: cfg.color, opacity: 0.08 }} />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: "#22c55e", opacity: 0.06 }} />
      </div>

      <FocusHeader tab={tab} setTab={setTab} cfg={headerCfg} focusMin={sessionFocusMin} sessionOn={sessionOn} setSessionOn={setSessionOn} setShowCheckIn={setShowCheckIn} />

      <video ref={captureVideoRef} autoPlay playsInline muted
        style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

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
