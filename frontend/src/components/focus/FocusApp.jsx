import { useState } from "react";
import { STATE_CFG, LEVEL_DATA, ACHIEVEMENTS_LIST, TEAM, INTERVENTIONS } from "./focusData";
import FocusHeader from "./FocusHeader";
import FocusFooter from "./FocusFooter";
import IntModal from "./IntModal";
import TabDashboard from "./views/Dashboard";
import TabMonitoring from "./views/Monitoring";
import TabTree from "./views/Tree";
import TabAchievements from "./views/Achievements";
import TabLeaderboard from "./views/Leaderboard";
import TabReport from "./views/Report";

export default function FocusApp() {
  const [tab, setTab] = useState("dashboard");
  const [state, setState] = useState("Focused");
  const [points, setPoints] = useState(1240);
  const [focusMin, setFocusMin] = useState(47);
  const [streak, setStreak] = useState(23);
  const [sessionOn, setSessionOn] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInAns, setCheckInAns] = useState(null);
  const [dist, setDist] = useState({ Fatigue: 12, Anxiety: 5, Boredom: 8 });

  const todayGoal = 120;
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const lv = LEVEL_DATA.filter((l) => points >= l.min).length - 1;
  const sortedTeam = [...TEAM].sort((a, b) => b.pts - a.pts);
  const myRank = sortedTeam.findIndex((m) => m.isMe) + 1;

  const handleStateSelect = (nextState) => {
    setState(nextState);
    if (["Fatigue", "Anxiety", "Boredom"].includes(nextState)) setShowModal(true);
  };

  const VIEWS = {
    dashboard: <TabDashboard state={state} points={points} focusMin={focusMin} streak={streak} TEAM={TEAM} ACHIEVEMENTS_LIST={ACHIEVEMENTS_LIST} LEVEL_DATA={LEVEL_DATA} todayGoal={todayGoal} dist={dist} myRank={myRank} />,
    monitoring: <TabMonitoring state={state} handleStateSelect={handleStateSelect} sessionOn={sessionOn} setSessionOn={setSessionOn} dist={dist} points={points} focusMin={focusMin} />,
    tree: <TabTree state={state} points={points} streak={streak} focusMin={focusMin} LEVEL_DATA={LEVEL_DATA} />,
    achievements: <TabAchievements />,
    leaderboard: <TabLeaderboard TEAM={TEAM} myRank={myRank} />,
    report: <TabReport focusMin={focusMin} points={points} dist={dist} myRank={myRank} />,
  };

  return (
    <div className="min-h-screen text-slate-900"
      style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #f0fdf4 50%, #fef3c7 100%)", fontFamily: "'DM Sans',system-ui,sans-serif" }}>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl transition-all duration-1000" style={{ backgroundColor: cfg.color, opacity: 0.08 }} />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: "#22c55e", opacity: 0.06 }} />
      </div>

      <FocusHeader tab={tab} setTab={setTab} cfg={cfg} points={points} sessionOn={sessionOn} setSessionOn={setSessionOn} setShowCheckIn={setShowCheckIn} />

      <div className="max-w-7xl mx-auto px-4 py-6">{VIEWS[tab]}</div>

      {showCheckIn && (
        <div className="fixed bottom-6 right-6 z-50 w-80">
          <div className="rounded-3xl p-5 border border-slate-200" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", boxShadow: "0 0 40px rgba(34,197,94,0.15)" }}>
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

      {showModal && ["Fatigue", "Anxiety", "Boredom"].includes(state) && (
        <IntModal state={state} onClose={() => setShowModal(false)} onComplete={() => { setPoints((p) => p + (INTERVENTIONS[state]?.reward || 20)); setShowModal(false); }} />
      )}

      <FocusFooter />
    </div>
  );
}
