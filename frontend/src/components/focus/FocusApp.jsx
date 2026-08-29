import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATE_CFG, LEVEL_DATA, ACHIEVEMENTS_LIST, pickChallengeType, challengePointsFor, levelIndexFromPoints } from "./focusData";
import { useFocusCamera } from "../../hooks/useFocusCamera";
import { saveFocusSession, getDailyReport, getWeeklyReport, getFocusProfile, flushFocusSession, getLeaderboard, pingFocusPresence, leaveFocusPresence } from "../../lib/focusApi";
import { combineHM, mergeLiveWeek } from "../../lib/focusTime";
import FocusHeader from "./FocusHeader";
import FocusFooter from "./FocusFooter";
import IntModal from "./IntModal";
import TreeSVG from "./TreeSVG";
import TabDashboard from "./views/Dashboard";
import TabMonitoring from "./views/Monitoring";
import TabTree from "./views/Tree";
import TabAchievements from "./views/Achievements";
import TabLeaderboard from "./views/Leaderboard";
import TabReport from "./views/Report";
import TabProfile from "./views/Profile";
import { readStoredUser } from "../../services/userApi";

const MANUAL_OVERRIDE_LOCK_MS = 5000;
const HIGH_CONFIDENCE = 0.70;
const CHALLENGE_SUSTAIN_MS = 5 * 60 * 1000;
const SPRINT_STREAK_MIN = 25;
const FOCUS_BOOST_STREAK_MIN = 5;
const TREE_FX_MS = 2000;
const CHECKIN_INTERVAL_MS = 5 * 60 * 1000;
const CHECKIN_TIMEOUT_MS = 15 * 1000;
const SAVE_INTERVAL_MS = 60 * 1000;
const TODAY_GOAL = 120;
const CHECKIN_PROMPT = "Are you focusing right now?";
const CHECKIN_YES_REPLY = "Great! Keep going!";
const CHECKIN_NO_REPLY = "Let's try a quick challenge!";
const CHECKIN_PAUSE_REPLY = "Your session is paused. Resume when you are ready.";
const HEARTBEAT_MS = 20 * 1000;
const LEADERBOARD_POLL_MS = 15 * 1000;

const FEMALE_VOICE_RE = /aria|jenny|zira|samantha|karen|moira|tessa|fiona|veena|raveena|susan|hazel|catherine|zosia|ana|linda|heera|google us english female|microsoft.*(aria|jenny|zira|sara)|female/i;
const MALE_VOICE_RE = /\b(david|mark|guy|james|george|daniel|thomas|fred|male|man)\b/i;

function pickClearFemaleVoice(voices) {
  const english = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;
  const female = pool.filter((v) => FEMALE_VOICE_RE.test(v.name) && !MALE_VOICE_RE.test(v.name));
  const rank = (v) => {
    const n = v.name.toLowerCase();
    const local = v.localService ? 2 : 0;
    if (/aria|jenny/.test(n)) return 50 + local;
    if (/zira/.test(n)) return 45 + local;
    if (/samantha/.test(n)) return 40 + local;
    if (/natural|online|neural/.test(n)) return 35 + local;
    if (v.lang.toLowerCase() === "en-us") return 25 + local;
    return 10 + local;
  };
  const ranked = (female.length ? female : pool).slice().sort((a, b) => rank(b) - rank(a));
  return ranked[0] || null;
}

function speakCheckIn(text = CHECKIN_PROMPT) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const speak = () => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.92;
    utter.pitch = 1.08;
    const voice = pickClearFemaleVoice(synth.getVoices());
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang || "en-US";
    }
    synth.speak(utter);
  };

  // Chrome often drops the first speak() if it runs in the same tick as cancel().
  const run = () => {
    if (synth.getVoices().length) {
      setTimeout(speak, 60);
      return;
    }
    synth.addEventListener("voiceschanged", () => setTimeout(speak, 60), { once: true });
  };
  run();
}

export default function FocusApp() {
  const [tab, setTab] = useState("dashboard");
  const [state, setState] = useState("Focused");
  const [sessionFocusMin, setSessionFocusMin] = useState(0);
  const [sessionDistMin, setSessionDistMin] = useState(0);
  const [todayBaseFocus, setTodayBaseFocus] = useState(0);
  const [todayBaseDist, setTodayBaseDist] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sessionStatus, setSessionStatus] = useState("active"); // active | paused | ended
  const [reportFocusMin, setReportFocusMin] = useState(null);
  const [reportDistMin, setReportDistMin] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [challengeType, setChallengeType] = useState("Fatigue");
  const [challengesTaken, setChallengesTaken] = useState(0);
  const [focusBoosts, setFocusBoosts] = useState(0);
  const [treeFx, setTreeFx] = useState(null);
  const [treeFxNonce, setTreeFxNonce] = useState(0);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInAns, setCheckInAns] = useState(null);
  const [showPauseNotice, setShowPauseNotice] = useState(false);
  const [interventionCounts, setInterventionCounts] = useState({ Fatigue: 0, Anxiety: 0, Boredom: 0 });
  const [everSprint25, setEverSprint25] = useState(false);
  const [weekly, setWeekly] = useState(null);
  const [savedAchievements, setSavedAchievements] = useState([]);
  const [lifetimeBaseMin, setLifetimeBaseMin] = useState(0);
  const [account] = useState(() => readStoredUser());
  const [boardRows, setBoardRows] = useState([]);
  const [boardLoading, setBoardLoading] = useState(true);

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
  const challengesTakenRef = useRef(0);
  const focusBoostsRef = useRef(0);
  const boostTierRef = useRef(0);
  const treeFxTimerRef = useRef(null);
  const persistSessionRef = useRef(async () => {});
  useEffect(() => { showModalRef.current = showModal; }, [showModal]);

  const playTreeFx = useCallback((kind) => {
    setTreeFx(kind);
    setTreeFxNonce((n) => n + 1);
    if (treeFxTimerRef.current) clearTimeout(treeFxTimerRef.current);
    treeFxTimerRef.current = setTimeout(() => {
      setTreeFx(null);
      treeFxTimerRef.current = null;
    }, TREE_FX_MS);
  }, []);

  useEffect(() => () => {
    if (treeFxTimerRef.current) clearTimeout(treeFxTimerRef.current);
  }, []);

  const sessionOn = sessionStatus === "active";

  useEffect(() => {
    countingRef.current = sessionOn;
  }, [sessionOn]);

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
    if (!showCheckIn) {
      window.speechSynthesis?.cancel();
      return;
    }
    if (checkInAns === true) {
      speakCheckIn(CHECKIN_YES_REPLY);
      return () => window.speechSynthesis?.cancel();
    }
    if (checkInAns === false) {
      speakCheckIn(CHECKIN_NO_REPLY);
      return () => window.speechSynthesis?.cancel();
    }
    speakCheckIn(CHECKIN_PROMPT);
    return () => window.speechSynthesis?.cancel();
  }, [showCheckIn, checkInAns]);

  useEffect(() => {
    if (!showCheckIn || checkInAns !== null) return;
    const id = setTimeout(() => {
      setShowCheckIn(false);
      setCheckInAns(null);
      setShowModal(false);
      setSessionStatus((s) => (s === "active" ? "paused" : s));
      setShowPauseNotice(true);
    }, CHECKIN_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [showCheckIn, checkInAns]);

  useEffect(() => {
    if (!showPauseNotice) return;
    speakCheckIn(CHECKIN_PAUSE_REPLY);
    return () => window.speechSynthesis?.cancel();
  }, [showPauseNotice]);

  const todayGoal = TODAY_GOAL;
  const todayFocusMin = todayBaseFocus + sessionFocusMin;
  const todayDistMin = todayBaseDist + sessionDistMin;

  const sessionPayload = useCallback(() => ({
    focus_minutes: todayBaseFocusRef.current + sessionFocusRef.current,
    distraction_minutes: todayBaseDistRef.current + sessionDistRef.current,
    longest_streak_minutes: longestStreakRef.current,
    today_goal: todayGoal,
    calm_quest_count: calmQuestRef.current,
    challenges_taken: challengesTakenRef.current,
    focus_boosts: focusBoostsRef.current,
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

  useEffect(() => { persistSessionRef.current = persistSession; }, [persistSession]);

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
        const taken = report.challenges_taken || 0;
        challengesTakenRef.current = taken;
        setChallengesTaken(taken);
        const boosts = report.focus_boosts || 0;
        focusBoostsRef.current = boosts;
        setFocusBoosts(boosts);
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
        if (!cancelled) countingRef.current = sessionStatus === "active";
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
    const beat = async () => {
      try {
        await pingFocusPresence();
      } catch {
        // ignore
      }
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    const onLeave = () => leaveFocusPresence();
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      leaveFocusPresence();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBoard = async () => {
      try {
        const rows = await getLeaderboard();
        if (!cancelled) {
          setBoardRows(Array.isArray(rows) ? rows : []);
          setBoardLoading(false);
        }
      } catch {
        if (!cancelled) setBoardLoading(false);
      }
    };
    loadBoard();
    const id = setInterval(loadBoard, LEADERBOARD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const pauseSession = useCallback(() => setSessionStatus("paused"), []);
  const resumeSession = useCallback(() => {
    if (sessionStatus === "ended") return;
    setSessionStatus("active");
  }, [sessionStatus]);

  const startSession = useCallback(() => {
    sessionFocusRef.current = 0;
    sessionDistRef.current = 0;
    setSessionFocusMin(0);
    setSessionDistMin(0);
    focusStreakRef.current = 0;
    boostTierRef.current = 0;
    setStreak(0);
    sprintBonusReadyRef.current = true;
    setSessionStatus("active");
  }, []);

  const endSession = useCallback(async () => {
    if (sessionStatus === "ended") return;
    countingRef.current = false;
    const focus = sessionFocusRef.current;
    const dist = sessionDistRef.current;
    setReportFocusMin(focus);
    setReportDistMin(dist);
    setShowCheckIn(false);
    await persistSession();
    todayBaseFocusRef.current += focus;
    todayBaseDistRef.current += dist;
    setTodayBaseFocus(todayBaseFocusRef.current);
    setTodayBaseDist(todayBaseDistRef.current);
    sessionFocusRef.current = 0;
    sessionDistRef.current = 0;
    setSessionFocusMin(0);
    setSessionDistMin(0);
    focusStreakRef.current = 0;
    boostTierRef.current = 0;
    setStreak(0);
    setSessionStatus("ended");
  }, [sessionStatus, persistSession]);

  useEffect(() => {
    const onLeave = () => {
      if (!persistReadyRef.current) return;
      flushFocusSession(sessionPayload());
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [sessionPayload]);

  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const treeFocusMin = sessionStatus === "ended" ? (reportFocusMin ?? 0) : sessionFocusMin;
  const treeDistMin = sessionStatus === "ended" ? (reportDistMin ?? 0) : sessionDistMin;
  // Tree mood follows the session total, not the live frame: happy while
  // focused time is ahead (or tied), sad once overall distraction overtakes it.
  const treeState = treeFocusMin >= treeDistMin ? "Focused" : "Boredom";
  const lifetimeMin = lifetimeBaseMin + todayFocusMin;
  const challengePoints = challengePointsFor(challengesTaken, focusBoosts);
  const lv = levelIndexFromPoints(challengePoints);

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

  const openChallenge = useCallback((type) => {
    if (showModalRef.current) return;
    showModalRef.current = true;
    setChallengeType(pickChallengeType(type));
    setShowModal(true);
    challengesTakenRef.current += 1;
    setChallengesTaken(challengesTakenRef.current);
    playTreeFx("wilt");
    persistSession();
  }, [persistSession, playTreeFx]);

  const handleStateSelect = (nextState) => {
    if (sessionStatus !== "active") return;
    lastManualRef.current = Date.now();
    setState(nextState);
    if (["Fatigue", "Anxiety", "Boredom"].includes(nextState)) openChallenge(nextState);
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

      const streakMin = focusStreakRef.current / 60000;
      const tier = Math.floor(streakMin / FOCUS_BOOST_STREAK_MIN);
      if (tier > boostTierRef.current) {
        const gained = tier - boostTierRef.current;
        boostTierRef.current = tier;
        focusBoostsRef.current += gained;
        setFocusBoosts(focusBoostsRef.current);
        playTreeFx("water");
        persistSessionRef.current();
      }
    } else {
      focusStreakRef.current = 0;
      boostTierRef.current = 0;
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
        openChallenge(nextState);
        dstreak.ms = 0;
      }
    } else {
      distractionStreakRef.current = { state: null, ms: 0 };
    }
  }, [openChallenge, playTreeFx]);

  const handleInterventionComplete = useCallback((type) => {
    setInterventionCounts((c) => {
      const next = { ...c, [type]: (c[type] || 0) + 1 };
      if (type === "Anxiety") calmQuestRef.current = next.Anxiety;
      return next;
    });
    setShowModal(false);
    showModalRef.current = false;
  }, []);

  const camera = useFocusCamera(sessionOn, handleDetection);
  const { captureVideoRef, canvasRef } = camera;

  const headerCfg = sessionOn && camera.camStatus === "live" && !camera.faceDetected
    ? STATE_CFG.NoFace
    : cfg;

  const VIEWS = {
    dashboard: (
      <TabDashboard
        state={treeState}
        focusMin={todayFocusMin}
        streak={streak}
        ACHIEVEMENTS_LIST={liveAchievements}
        LEVEL_DATA={LEVEL_DATA}
        todayGoal={todayGoal}
        distMin={todayDistMin}
        week={liveWeek}
        challengePoints={challengePoints}
        treeFx={treeFx}
        treeFxNonce={treeFxNonce}
        userName={account?.name}
      />
    ),
    monitoring: (
      <TabMonitoring
        state={state}
        handleStateSelect={handleStateSelect}
        camera={camera}
        sessionStatus={sessionStatus}
        sessionOn={sessionOn}
        pauseSession={pauseSession}
        resumeSession={resumeSession}
        startSession={startSession}
        endSession={endSession}
        distMin={sessionDistMin}
        focusMin={sessionFocusMin}
      />
    ),
    tree: (
      <TabTree
        state={treeState}
        streak={streak}
        focusMin={todayFocusMin}
        LEVEL_DATA={LEVEL_DATA}
        challengePoints={challengePoints}
        treeFx={treeFx}
        treeFxNonce={treeFxNonce}
      />
    ),
    achievements: <TabAchievements ACHIEVEMENTS_LIST={liveAchievements} />,
    leaderboard: (
      <TabLeaderboard
        rows={boardRows}
        loading={boardLoading}
        focusMin={todayFocusMin}
        distMin={todayDistMin}
        lifetimeMin={lifetimeMin}
      />
    ),
    report: (
      <TabReport
        sessionEnded={reportFocusMin != null}
        focusMin={reportFocusMin ?? 0}
        distMin={reportDistMin ?? 0}
        todayFocusMin={todayFocusMin}
        todayDistMin={todayDistMin}
        todayGoal={todayGoal}
        week={liveWeek}
      />
    ),
    profile: (
      <TabProfile
        user={account}
        focusMin={todayFocusMin}
        distMin={todayDistMin}
        challengePoints={challengePoints}
        streak={streak}
        lifetimeMin={lifetimeMin}
        ACHIEVEMENTS_LIST={liveAchievements}
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

      <FocusHeader
        tab={tab}
        setTab={setTab}
        cfg={headerCfg}
        focusMin={sessionStatus === "ended" ? (reportFocusMin ?? 0) : sessionFocusMin}
        sessionStatus={sessionStatus}
        sessionOn={sessionOn}
        pauseSession={pauseSession}
        resumeSession={resumeSession}
        startSession={startSession}
        setShowCheckIn={setShowCheckIn}
        challengePoints={challengePoints}
        userName={account?.name}
        onOpenProfile={() => setTab("profile")}
      />

      <video ref={captureVideoRef} autoPlay playsInline muted
        style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div key={tab} className="max-w-7xl mx-auto px-4 py-6">{VIEWS[tab]}</div>

      {treeFx && tab !== "dashboard" && tab !== "tree" && (
        <div
          className="fixed bottom-24 right-6 z-40 pointer-events-none rounded-3xl px-3 pt-2 pb-1 border shadow-xl"
          style={{ background: "rgba(255,255,255,0.94)", borderColor: "rgba(148,163,184,0.35)", backdropFilter: "blur(12px)" }}
        >
          <TreeSVG state={treeState} points={challengePoints} size={132} fx={treeFx} fxKey={treeFxNonce} />
        </div>
      )}

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
                <button onClick={() => { setCheckInAns(true); setTimeout(() => { setShowCheckIn(false); setCheckInAns(null); }, 2500); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-green-500 text-white hover:bg-green-400 transition-all">✅ Yes</button>
                <button onClick={() => { setCheckInAns(false); setTimeout(() => { setShowCheckIn(false); setCheckInAns(null); openChallenge(state); }, 2500); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all">😔 No</button>
              </div>
            ) : (
              <p className={`text-sm font-semibold text-center py-1 ${checkInAns ? "text-green-600" : "text-orange-600"}`}>{checkInAns ? "Great! Keep going! 🌱" : "Let's try a quick challenge! 💪"}</p>
            )}
          </div>
        </div>
      )}

      {showPauseNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.35)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-3xl border p-6 shadow-2xl" style={{ backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#f59e0b50" }}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⏸</span>
                <div>
                  <p className="text-xs text-amber-600 uppercase tracking-widest">Session paused</p>
                  <p className="text-xl font-bold text-slate-900">Still there?</p>
                </div>
              </div>
              <button onClick={() => setShowPauseNotice(false)} className="text-slate-400 hover:text-slate-900 text-xl">✕</button>
            </div>
            <p className="text-slate-700 text-sm mb-5">
              No check-in reply in 15 seconds, so tracking is paused. Your focus and distraction totals are saved. Resume when you are ready — this session is not ended.
            </p>
            <button
              onClick={() => {
                setShowPauseNotice(false);
                resumeSession();
              }}
              className="w-full py-2.5 rounded-xl font-semibold text-sm border transition-all"
              style={{ backgroundColor: "#22c55e15", borderColor: "#22c55e40", color: "#22c55e" }}
            >
              ▶ Resume Session
            </button>
          </div>
        </div>
      )}

      <IntModal open={showModal} type={challengeType} onClose={() => { showModalRef.current = false; setShowModal(false); }} onComplete={handleInterventionComplete} />

      <FocusFooter />
    </div>
  );
}
