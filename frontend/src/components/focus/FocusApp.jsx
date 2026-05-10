// frontend/src/components/focus/FocusApp.jsx
// Tabs: Dashboard | Live Monitoring | My Tree | Achievements | Leaderboard | Report

import { useState, useEffect, useRef } from "react";

// ─── Constants ───────────────────────────────────────────────
const CLASSES = ["Focused","Fatigue","Anxiety","Boredom"];

const STATE_CFG = {
  Focused: { color:"#22c55e", bg:"#22c55e12", border:"#22c55e35", icon:"🎯", label:"Focused"  },
  Fatigue: { color:"#f97316", bg:"#f9731612", border:"#f9731635", icon:"😴", label:"Fatigue"  },
  Anxiety: { color:"#ef4444", bg:"#ef444412", border:"#ef444435", icon:"😰", label:"Anxiety"  },
  Boredom: { color:"#3b82f6", bg:"#3b82f612", border:"#3b82f635", icon:"😑", label:"Boredom"  },
};

const LEVEL_DATA = [
  { name:"Seedling",      min:0,    max:500,  icon:"🌱" },
  { name:"Growing Plant", min:500,  max:1500, icon:"🌿" },
  { name:"Focus Tree",    min:1500, max:3000, icon:"🌳" },
  { name:"Golden Tree",   min:3000, max:9999, icon:"✨" },
];

const ACHIEVEMENTS_LIST = [
  { id:1, name:"25-min Sprint",   icon:"⚡", earned:true,  desc:"Focus 25 min straight",      pts:50  },
  { id:2, name:"Stress Buster",   icon:"🧘", earned:true,  desc:"Complete 5 Calm Quests",     pts:30  },
  { id:3, name:"Perfect Week",    icon:"🌟", earned:false, desc:"Focus 5 days in a row",       pts:100 },
  { id:4, name:"Early Bird",      icon:"🌅", earned:false, desc:"Study before 7 AM",           pts:40  },
  { id:5, name:"Night Owl",       icon:"🦉", earned:true,  desc:"Study after 9 PM",            pts:25  },
  { id:6, name:"Team Player",     icon:"🤝", earned:false, desc:"Top 2 in leaderboard",        pts:60  },
  { id:7, name:"Tree Whisperer",  icon:"🌲", earned:true,  desc:"Reach Focus Tree level",      pts:80  },
  { id:8, name:"Unbreakable",     icon:"💎", earned:false, desc:"7-day focus streak",          pts:150 },
  { id:9, name:"Zen Master",      icon:"☯️", earned:false, desc:"10 Calm Quests completed",    pts:70  },
];

const TEAM = [
  { id:1, name:"You",     pts:1240, avatar:"🧑‍💻", isMe:true,  focusToday:47, streak:3 },
  { id:2, name:"Kasun",   pts:1580, avatar:"👨‍🎓", isMe:false, focusToday:62, streak:5 },
  { id:3, name:"Nimasha", pts:980,  avatar:"👩‍💻", isMe:false, focusToday:38, streak:2 },
  { id:4, name:"Dilan",   pts:720,  avatar:"👨‍💻", isMe:false, focusToday:25, streak:1 },
];

const INTERVENTIONS = {
  Fatigue: {
    title:"Break Challenge", emoji:"😴", color:"#f97316",
    msg:"Your tree needs energy! Rest your eyes for 2 minutes.",
    steps:["Close your eyes gently","Take 3 deep breaths","Look 20 feet away"],
    reward:20, timer:120,
  },
  Anxiety: {
    title:"Calm Quest", emoji:"🌿", color:"#ef4444",
    msg:"Your tree is unsettled. Let's bring calm together.",
    steps:["Inhale for 4 seconds","Hold for 4 seconds","Exhale for 6 seconds"],
    reward:15, timer:60,
  },
  Boredom: {
    title:"Bonus Content", emoji:"🎯", color:"#3b82f6",
    msg:"Unlock a new scene! Watch this quick example.",
    steps:["Watch the 60-second video","Note one new thing learned","Apply it now"],
    reward:25, timer:60,
  },
};

const WEEKLY = [
  { day:"Mon", date:"2026-05-05", focus:82, dist:18, detail:{focus:98, fatigue:9, anxiety:3, boredom:6, note:"Strong start with few interruptions."} },
  { day:"Tue", date:"2026-05-06", focus:65, dist:35, detail:{focus:78, fatigue:12, anxiety:8, boredom:15, note:"Midweek fatigue started to build."} },
  { day:"Wed", date:"2026-05-07", focus:91, dist:9,  detail:{focus:112, fatigue:4, anxiety:2, boredom:3, note:"Best day of the week with steady focus."} },
  { day:"Thu", date:"2026-05-08", focus:74, dist:26, detail:{focus:86, fatigue:10, anxiety:6, boredom:10, note:"Balanced day with a few small breaks needed."} },
  { day:"Fri", date:"2026-05-09", focus:55, dist:45, detail:{focus:64, fatigue:18, anxiety:10, boredom:17, note:"Fatigue was highest late in the day."} },
  { day:"Sat", date:"2026-05-10", focus:88, dist:12, detail:{focus:105, fatigue:3, anxiety:2, boredom:7, note:"Weekend study session stayed productive."} },
  { day:"Sun", date:"2026-05-11", focus:47, dist:53, detail:{focus:54, fatigue:22, anxiety:11, boredom:20, note:"Lower focus day, mostly due to distraction spikes."} },
];

const REPORT_TYPES = [
  { key:"focus", label:"Focus", color:"#22c55e" },
  { key:"fatigue", label:"Fatigue", color:"#f97316" },
  { key:"anxiety", label:"Anxiety", color:"#ef4444" },
  { key:"boredom", label:"Boredom", color:"#3b82f6" },
];

const TABS = [
  { id:"dashboard",   label:"Dashboard",       icon:"📊" },
  { id:"monitoring",  label:"Live Monitoring", icon:"📷" },
  { id:"tree",        label:"My Tree",         icon:"🌳" },
  { id:"achievements",label:"Achievements",    icon:"🏅" },
  { id:"leaderboard", label:"Leaderboard",     icon:"🏆" },
  { id:"report",      label:"Report",          icon:"📈" },
];

// ─── Tree SVG ────────────────────────────────────────────────
function TreeSVG({ state, points, size=200 }) {
  const cfg = STATE_CFG[state] || STATE_CFG.Focused;
  const lv  = LEVEL_DATA.filter(l=>points>=l.min).length - 1;
  const isGolden = lv === 3;
  const leafFill = isGolden ? "#f59e0b" : cfg.color;

  return (
    <svg width={size} height={size*1.1} viewBox="0 0 200 220"
      style={{
        filter:`drop-shadow(0 0 16px ${cfg.color}44)`,
        animation: state==="Anxiety"
          ? "treeShake 0.4s ease-in-out infinite alternate"
          : "treeBob 3s ease-in-out infinite",
      }}>
      <ellipse cx="100" cy="212" rx="36" ry="7" fill={cfg.color} opacity="0.2"/>
      <rect x="90" y="150" width="20" height="64" rx="7"
        fill="#8B5E3C"
        style={{ transformOrigin:"100px 214px",
          animation:["Fatigue","Boredom"].includes(state)?"trunkDroop 2s ease-in-out infinite alternate":"none"
        }}/>
      {lv>=0&&<ellipse cx="100" cy="155" rx="44" ry="36" fill={leafFill} opacity="0.9"
        style={{transformOrigin:"100px 155px",animation:"leafSway 4s ease-in-out infinite"}}/>}
      {lv>=1&&<ellipse cx="100" cy="114" rx="36" ry="28" fill={leafFill} opacity="0.92"
        style={{transformOrigin:"100px 114px",animation:"leafSway 3.5s ease-in-out infinite 0.3s"}}/>}
      {lv>=2&&<ellipse cx="100" cy="78" rx="27" ry="22" fill={leafFill} opacity="0.88"
        style={{transformOrigin:"100px 78px",animation:"leafSway 3s ease-in-out infinite 0.6s"}}/>}
      {lv>=3&&<>
        <ellipse cx="100" cy="50" rx="18" ry="15" fill="#fbbf24"
          style={{animation:"leafSway 2.5s ease-in-out infinite 0.9s"}}/>
        <path d="M100,28 L102,36 L110,36 L104,41 L106,49 L100,44 L94,49 L96,41 L90,36 L98,36 Z"
          fill="#fbbf24" style={{animation:"starPulse 1.5s ease-in-out infinite"}}/>
      </>}
      <style>{`
        @keyframes treeBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes treeShake{0%{transform:rotate(-2.5deg)}100%{transform:rotate(2.5deg)}}
        @keyframes leafSway{0%,100%{transform:rotate(-2deg)scale(1)}50%{transform:rotate(2deg)scale(1.03)}}
        @keyframes trunkDroop{0%{transform:rotate(0)}100%{transform:rotate(2.5deg)}}
        @keyframes starPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.2)}}
      `}</style>
    </svg>
  );
}

// ─── Intervention Modal ───────────────────────────────────────
function IntModal({ state, onClose, onComplete }) {
  const cfg = INTERVENTIONS[state];
  if (!cfg) return null;
  const [t, setT] = useState(cfg.timer);
  const [done, setDone] = useState([]);
  useEffect(()=>{
    if(t<=0)return;
    const id=setInterval(()=>setT(p=>p-1),1000);
    return()=>clearInterval(id);
  },[t]);
  const finished = t<=0 || done.length===cfg.steps.length;
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{backgroundColor:"rgba(0,0,0,0.8)",backdropFilter:"blur(8px)"}}>
      <div className="w-full max-w-md rounded-3xl border p-6"
        style={{background:`linear-gradient(135deg,${cfg.color}10,#050d1a)`,borderColor:`${cfg.color}40`,boxShadow:`0 0 50px ${cfg.color}25`}}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{cfg.emoji}</span>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest">{state} Detected</p>
              <p className="text-xl font-bold text-white">{cfg.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>
        <p className="text-slate-300 text-sm mb-4">{cfg.msg}</p>
        <div className="space-y-2 mb-4">
          {cfg.steps.map((s,i)=>(
            <button key={i} onClick={()=>setDone(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])}
              className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
              style={{borderColor:done.includes(i)?cfg.color:"rgba(255,255,255,0.08)",backgroundColor:done.includes(i)?`${cfg.color}15`:"rgba(255,255,255,0.02)"}}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{backgroundColor:done.includes(i)?cfg.color:"transparent",border:`2px solid ${done.includes(i)?cfg.color:"rgba(255,255,255,0.2)"}`,color:"#fff"}}>
                {done.includes(i)?"✓":i+1}
              </div>
              <span className={`text-sm ${done.includes(i)?"text-white":"text-slate-400"}`}>{s}</span>
            </button>
          ))}
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Timer</span>
            <span style={{color:cfg.color}}>{finished?"Done!":`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{width:`${((cfg.timer-t)/cfg.timer)*100}%`,backgroundColor:cfg.color,boxShadow:`0 0 8px ${cfg.color}`}}/>
          </div>
        </div>
        <button onClick={()=>onComplete&&onComplete()} disabled={!finished}
          className="w-full py-3 rounded-2xl font-bold text-sm transition-all"
          style={{backgroundColor:finished?cfg.color:"rgba(255,255,255,0.05)",color:finished?"#fff":"rgba(255,255,255,0.3)",cursor:finished?"pointer":"not-allowed",boxShadow:finished?`0 0 20px ${cfg.color}50`:"none"}}>
          {finished?`✓ Claim +${cfg.reward} pts`:"Complete steps to claim reward"}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────
export default function FocusApp() {
  const [tab,           setTab]           = useState("dashboard");
  const [state,         setState]         = useState("Focused");
  const [points,        setPoints]        = useState(1240);
  const [focusMin,      setFocusMin]      = useState(47);
  const [streak,        setStreak]        = useState(23);
  const [sessionOn,     setSessionOn]     = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [showCheckIn,   setShowCheckIn]   = useState(false);
  const [checkInAns,    setCheckInAns]    = useState(null);
  const [dist,          setDist]          = useState({Fatigue:12,Anxiety:5,Boredom:8});
  const todayGoal = 120;
  const cfg = STATE_CFG[state]||STATE_CFG.Focused;
  const lv  = LEVEL_DATA.filter(l=>points>=l.min).length-1;
  const sortedTeam = [...TEAM].sort((a,b)=>b.pts-a.pts);
  const myRank = sortedTeam.findIndex(m=>m.isMe)+1;
  const goalPct = Math.min((focusMin/todayGoal)*100,100);
  const lvPts  = [0,500,1500,3000];
  const nextPts= lvPts[lv+1]||3000;
  const lvPct  = lv<3?((points-lvPts[lv])/(nextPts-lvPts[lv]))*100:100;

  const handleStateSelect = (nextState) => {
    setState(nextState);
    if (["Fatigue", "Anxiety", "Boredom"].includes(nextState)) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  };

  // ─── TABS ───
  const Card = ({children,className=""})=>(
    <div className={`rounded-2xl border border-white/5 ${className}`}
      style={{background:"rgba(13,31,53,0.75)",backdropFilter:"blur(12px)"}}>
      {children}
    </div>
  );

  // ──────────── DASHBOARD TAB ──────────────────────────────────
  const TabDashboard = ()=>(
    <div className="grid grid-cols-12 gap-4">
      {/* State + mini tree */}
      <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
        <Card className="p-5 transition-all duration-700"
          style={{background:`linear-gradient(135deg,${cfg.color}12,rgba(5,13,26,0.97))`,borderColor:cfg.border,boxShadow:`0 0 30px ${cfg.color}12`}}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{cfg.icon}</span>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest">Current State</p>
              <p className="text-2xl font-bold" style={{color:cfg.color}}>{cfg.label}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {Object.entries(STATE_CFG).map(([s,c])=>(
              <div key={s} className="flex-1 h-1.5 rounded-full transition-all duration-500"
                style={{backgroundColor:state===s?c.color:`${c.color}25`}}/>
            ))}
          </div>
        </Card>

        <Card className="p-5 flex justify-center">
          <div>
            <TreeSVG state={state} points={points} size={160}/>
            <div className="text-center mt-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full border"
                style={{color:LEVEL_DATA[lv].icon==="✨"?"#f59e0b":cfg.color,borderColor:`${cfg.color}40`,backgroundColor:`${cfg.color}10`}}>
                {LEVEL_DATA[lv].icon} {LEVEL_DATA[lv].name}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-400">Level {lv+1} Progress</span>
            <span className="text-yellow-400">{points}/{nextPts}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div className="h-full rounded-full transition-all duration-700"
              style={{width:`${lvPct}%`,background:"linear-gradient(90deg,#22c55e,#f59e0b)",boxShadow:"0 0 8px #22c55e50"}}/>
          </div>
          <p className="text-xs text-slate-600 mt-1">{lv<3?`${nextPts-points} pts to ${LEVEL_DATA[lv+1].name}`:"Max Level!"}</p>
        </Card>
      </div>

      {/* Center stats */}
      <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            {label:"Focus Time",value:`${focusMin}m`,icon:"⏱",color:"#22c55e"},
            {label:"Streak",value:`${streak}m`,icon:"🔥",color:"#f59e0b"},
            {label:"Rank",value:`#${myRank}`,icon:"🏆",color:"#a855f7"},
          ].map(s=>(
            <Card key={s.label} className="p-4 text-center">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-2xl font-bold" style={{color:s.color}}>{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold text-white">Daily Goal</h3>
              <p className="text-xs text-slate-400">{focusMin} / {todayGoal} min</p>
            </div>
            <span className="text-2xl font-bold text-green-400">{Math.round(goalPct)}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full relative transition-all duration-700"
              style={{width:`${goalPct}%`,background:"linear-gradient(90deg,#22c55e,#86efac)",boxShadow:"0 0 10px #22c55e40"}}>
              <div className="absolute inset-0 bg-white/10 animate-pulse"/>
            </div>
          </div>
          {goalPct>=100&&<p className="text-xs text-green-400 mt-2">🎉 Goal achieved! +100 bonus pts</p>}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-white mb-4">Today's Distraction Breakdown</h3>
          <div className="space-y-3">
            {[{k:"Fatigue",icon:"😴",c:"#f97316"},{k:"Anxiety",icon:"😰",c:"#ef4444"},{k:"Boredom",icon:"😑",c:"#3b82f6"}].map(d=>{
              const total=Object.values(dist).reduce((a,b)=>a+b,0)||1;
              const pct=Math.round((dist[d.k]/total)*100);
              return(
                <div key={d.k}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{d.icon} {d.k}</span>
                    <span style={{color:d.c}}>{dist[d.k]}m ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800">
                    <div className="h-full rounded-full transition-all"
                      style={{width:`${pct}%`,backgroundColor:d.c,boxShadow:`0 0 6px ${d.c}50`}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-white mb-3 text-sm">Recent Achievements</h3>
          <div className="flex gap-2 flex-wrap">
            {ACHIEVEMENTS_LIST.filter(a=>a.earned).slice(0,4).map(a=>(
              <div key={a.id} title={a.desc}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold"
                style={{borderColor:"#f59e0b35",backgroundColor:"#f59e0b08",color:"#f59e0b"}}>
                {a.icon} {a.name}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right leaderboard */}
      <div className="col-span-12 md:col-span-3">
        <Card className="p-5 h-full">
          <h3 className="font-semibold text-white mb-4">🏆 Team</h3>
          <div className="space-y-2">
            {sortedTeam.map((m,i)=>(
              <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl border transition-all"
                style={{borderColor:m.isMe?"#22c55e30":"rgba(255,255,255,0.05)",backgroundColor:m.isMe?"#22c55e08":"transparent"}}>
                <span className="text-sm w-5 text-center font-bold"
                  style={{color:i===0?"#f59e0b":i===1?"#94a3b8":"#78716c"}}>
                  {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                </span>
                <span className="text-lg">{m.avatar}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{color:m.isMe?"#22c55e":"#e2e8f0"}}>
                    {m.name}{m.isMe?" (You)":""}
                  </p>
                  <div className="h-1 rounded-full bg-slate-800 mt-0.5">
                    <div className="h-full rounded-full" style={{width:`${(m.pts/sortedTeam[0].pts)*100}%`,backgroundColor:m.isMe?"#22c55e":"#334155"}}/>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-bold">{m.pts}</span>
              </div>
            ))}
          </div>
          {myRank>1&&(
            <div className="mt-3 p-2.5 rounded-xl border border-green-500/15 bg-green-500/5">
              <p className="text-xs text-green-400">💪 {sortedTeam[myRank-2].pts-sortedTeam[myRank-1].pts} pts to #{myRank-1}!</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  // ──────────── LIVE MONITORING TAB ────────────────────────────
  const TabMonitoring = ()=>(
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-7">
        <Card className="p-5 mb-4">
          {/* Webcam placeholder */}
          <div className="rounded-2xl overflow-hidden relative"
            style={{paddingBottom:"56.25%",background:"#0a1628",border:"1px solid rgba(255,255,255,0.06)"}}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <span className="text-6xl opacity-30">📷</span>
              <p className="text-slate-500 text-sm">Webcam Feed</p>
              <p className="text-xs text-slate-600">Connect backend to enable live detection</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                <span className="text-xs text-green-400">Ready to connect</span>
              </div>
            </div>
            {/* Overlay corners */}
            {["top-3 left-3","top-3 right-3","bottom-3 left-3","bottom-3 right-3"].map((pos,i)=>(
              <div key={i} className={`absolute ${pos} w-6 h-6`}
                style={{
                  borderTop:   i<2?"2px solid #22c55e60":"none",
                  borderBottom:i>=2?"2px solid #22c55e60":"none",
                  borderLeft:  [0,2].includes(i)?"2px solid #22c55e60":"none",
                  borderRight: [1,3].includes(i)?"2px solid #22c55e60":"none",
                }}/>
            ))}
          </div>
        </Card>

        {/* Confidence bars */}
        <Card className="p-5">
          <h3 className="font-semibold text-white mb-4">State Confidence</h3>
          <div className="space-y-4">
            {CLASSES.map(cls=>{
              const mock={Focused:0.82,Fatigue:0.10,Anxiety:0.05,Boredom:0.03};
              const active=state===cls;
              return(
                <div key={cls}>
                  <div className="flex justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-sm"
                      style={{color:active?STATE_CFG[cls].color:"#94a3b8",fontWeight:active?700:400}}>
                      {STATE_CFG[cls].icon} {cls}
                    </span>
                    <span className="text-sm font-bold" style={{color:STATE_CFG[cls].color}}>
                      {Math.round((mock[cls]||0)*100)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-800">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width:`${(mock[cls]||0)*100}%`,
                        backgroundColor:STATE_CFG[cls].color,
                        boxShadow:active?`0 0 12px ${STATE_CFG[cls].color}70`:"none",
                      }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
        {/* Current state big */}
        <Card className="p-6 text-center transition-all duration-700"
          style={{background:`linear-gradient(135deg,${cfg.color}15,rgba(5,13,26,0.98))`,borderColor:cfg.border,boxShadow:`0 0 40px ${cfg.color}15`}}>
          <div className="text-6xl mb-3">{cfg.icon}</div>
          <p className="text-3xl font-bold mb-1" style={{color:cfg.color}}>{cfg.label}</p>
          <p className="text-xs text-slate-400 uppercase tracking-widest">Detected State</p>
          <div className="mt-4 px-4 py-2 rounded-xl inline-block text-xs font-semibold"
            style={{backgroundColor:`${cfg.color}15`,color:cfg.color,border:`1px solid ${cfg.color}30`}}>
            Confidence: 82%
          </div>
        </Card>

        {/* State test */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-widest">Simulate State</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATE_CFG).map(([s,c])=>(
              <button key={s} onClick={()=>handleStateSelect(s)}
                className="py-3 px-4 rounded-xl text-sm font-semibold border transition-all"
                style={{
                  borderColor:state===s?c.color:"rgba(255,255,255,0.08)",
                  backgroundColor:state===s?`${c.color}18`:"rgba(255,255,255,0.02)",
                  color:state===s?c.color:"#64748b",
                  boxShadow:state===s?`0 0 15px ${c.color}25`:"none",
                }}>
                {c.icon} {s}
              </button>
            ))}
          </div>
        </Card>

        {/* Session info */}
        <Card className="p-5">
          <h3 className="font-semibold text-white mb-3">Session Info</h3>
          <div className="space-y-2 text-sm">
            {[
              {label:"Session Status", value:sessionOn?"Active":"Paused", color:sessionOn?"#22c55e":"#94a3b8"},
              {label:"Focus Today",    value:`${focusMin} min`,           color:"#22c55e"},
              {label:"Distractions",   value:`${Object.values(dist).reduce((a,b)=>a+b,0)} min`, color:"#f97316"},
              {label:"Points Earned",  value:`${points}`,                 color:"#f59e0b"},
            ].map(r=>(
              <div key={r.label} className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">{r.label}</span>
                <span className="font-semibold" style={{color:r.color}}>{r.value}</span>
              </div>
            ))}
          </div>
          <button onClick={()=>setSessionOn(s=>!s)}
            className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm border transition-all"
            style={{
              backgroundColor:sessionOn?"#ef444415":"#22c55e15",
              borderColor:sessionOn?"#ef444440":"#22c55e40",
              color:sessionOn?"#ef4444":"#22c55e",
            }}>
            {sessionOn?"⏸ Pause Session":"▶ Resume Session"}
          </button>
        </Card>
      </div>
    </div>
  );

  // ──────────── MY TREE TAB ─────────────────────────────────────
  const TabTree = ()=>(
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
        <Card className="p-8 flex flex-col items-center transition-all duration-700"
          style={{background:`linear-gradient(180deg,${cfg.color}08,rgba(5,13,26,0.98))`,borderColor:cfg.border}}>
          <TreeSVG state={state} points={points} size={220}/>
          <div className="text-center mt-4">
            <p className="text-2xl font-bold text-white mb-1">{LEVEL_DATA[lv].icon} {LEVEL_DATA[lv].name}</p>
            <p className="text-sm text-slate-400">Your Focus Tree</p>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-white mb-3">Level Progress</h3>
          <div className="space-y-3">
            {LEVEL_DATA.map((lvl,i)=>{
              const active=i===lv;
              const passed=i<lv;
              return(
                <div key={lvl.name} className="flex items-center gap-3">
                  <span className="text-xl w-8 text-center">{passed?"✅":active?lvl.icon:"🔒"}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{color:active?"#f59e0b":passed?"#22c55e":"#475569",fontWeight:active?700:400}}>
                        {lvl.name}
                      </span>
                      <span className="text-slate-500">{lvl.min}–{lvl.max} pts</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width:passed?"100%":active?`${lvPct}%`:"0%",
                          background:passed?"#22c55e":active?"linear-gradient(90deg,#22c55e,#f59e0b)":"transparent",
                        }}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            {label:"Total Points",  value:points,     icon:"✦",  color:"#f59e0b", unit:"pts"},
            {label:"Focus Today",   value:focusMin,   icon:"⏱",  color:"#22c55e", unit:"min"},
            {label:"Streak",        value:streak,     icon:"🔥",  color:"#f97316", unit:"min"},
            {label:"Trees Planted", value:lv+1,       icon:"🌱",  color:"#22c55e", unit:""},
          ].map(s=>(
            <Card key={s.label} className="p-5 text-center">
              <p className="text-3xl mb-2">{s.icon}</p>
              <p className="text-3xl font-bold" style={{color:s.color}}>{s.value}<span className="text-lg ml-1">{s.unit}</span></p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <h3 className="font-semibold text-white mb-4">Tree State Guide</h3>
          <div className="space-y-3">
            {Object.entries(STATE_CFG).map(([s,c])=>(
              <div key={s} className="flex items-start gap-3 p-3 rounded-xl border transition-all"
                style={{borderColor:state===s?c.color:"rgba(255,255,255,0.05)",backgroundColor:state===s?`${c.color}10`:"transparent"}}>
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className="text-sm font-semibold" style={{color:c.color}}>{s}</p>
                  <p className="text-xs text-slate-400">
                    {s==="Focused"?"Tree grows and sparkles with energy!":
                     s==="Fatigue"?"Tree droops and loses vibrancy...":
                     s==="Anxiety"?"Tree shakes and trembles nervously...":
                     "Tree becomes sparse and still..."}
                  </p>
                </div>
                {state===s&&<span className="ml-auto text-xs px-2 py-0.5 rounded-full"
                  style={{backgroundColor:`${c.color}20`,color:c.color}}>Now</span>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-white mb-3">Points Guide</h3>
          <div className="space-y-2 text-sm">
            {[
              {action:"Focus 1 minute",pts:"+10",color:"#22c55e"},
              {action:"25-min continuous focus",pts:"+50 bonus",color:"#f59e0b"},
              {action:"Complete daily goal",pts:"+100 bonus",color:"#a855f7"},
              {action:"Complete Break Challenge",pts:"+20",color:"#f97316"},
              {action:"Complete Calm Quest",pts:"+15",color:"#ef4444"},
              {action:"Complete Bonus Content",pts:"+25",color:"#3b82f6"},
            ].map(p=>(
              <div key={p.action} className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-300">{p.action}</span>
                <span className="font-bold" style={{color:p.color}}>{p.pts}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  // ──────────── ACHIEVEMENTS TAB ────────────────────────────────
  const TabAchievements = ()=>(
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12">
        <div className="flex gap-4 mb-4">
          {[
            {label:"Earned",   value:ACHIEVEMENTS_LIST.filter(a=>a.earned).length, color:"#22c55e"},
            {label:"Locked",   value:ACHIEVEMENTS_LIST.filter(a=>!a.earned).length,color:"#64748b"},
            {label:"Total Pts",value:ACHIEVEMENTS_LIST.filter(a=>a.earned).reduce((s,a)=>s+a.pts,0),color:"#f59e0b"},
          ].map(s=>(
            <Card key={s.label} className="flex-1 p-4 text-center">
              <p className="text-2xl font-bold" style={{color:s.color}}>{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ACHIEVEMENTS_LIST.map(a=>(
            <Card key={a.id} className="p-5 transition-all"
              style={{
                borderColor:a.earned?"#f59e0b30":"rgba(255,255,255,0.05)",
                backgroundColor:a.earned?"rgba(245,158,11,0.04)":"rgba(13,31,53,0.75)",
                opacity:a.earned?1:0.55,
              }}>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                  style={{backgroundColor:a.earned?"#f59e0b15":"rgba(255,255,255,0.04)",border:`1px solid ${a.earned?"#f59e0b30":"rgba(255,255,255,0.06)"}`}}>
                  {a.earned?a.icon:"🔒"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm mb-0.5" style={{color:a.earned?"#f59e0b":"#64748b"}}>{a.name}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{a.desc}</p>
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{backgroundColor:a.earned?"#f59e0b15":"rgba(255,255,255,0.04)",color:a.earned?"#f59e0b":"#475569"}}>
                    ✦ {a.pts} pts
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  // ──────────── LEADERBOARD TAB ─────────────────────────────────
  const TabLeaderboard = ()=>(
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-7">
        <Card className="p-6">
          <h3 className="font-semibold text-white mb-5 flex items-center gap-2">🏆 Team Rankings</h3>
          <div className="space-y-3">
            {sortedTeam.map((m,i)=>(
              <div key={m.id} className="flex items-center gap-4 p-4 rounded-2xl border transition-all"
                style={{
                  borderColor:m.isMe?"#22c55e40":"rgba(255,255,255,0.06)",
                  backgroundColor:m.isMe?"#22c55e08":"rgba(255,255,255,0.02)",
                  boxShadow:i===0?"0 0 20px rgba(245,158,11,0.08)":"none",
                }}>
                <div className="text-2xl w-8 text-center">
                  {i===0?"🥇":i===1?"🥈":i===2?"🥉":<span className="text-slate-500 font-bold text-lg">{i+1}</span>}
                </div>
                <span className="text-3xl">{m.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="font-bold" style={{color:m.isMe?"#22c55e":"#e2e8f0"}}>
                      {m.name}{m.isMe?" (You)":""}
                    </p>
                    {m.isMe&&<span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">Me</span>}
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width:`${(m.pts/sortedTeam[0].pts)*100}%`,
                        backgroundColor:m.isMe?"#22c55e":i===0?"#f59e0b":"#334155",
                        boxShadow:m.isMe?"0 0 8px #22c55e60":i===0?"0 0 8px #f59e0b60":"none",
                      }}/>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg" style={{color:m.isMe?"#22c55e":"#e2e8f0"}}>{m.pts}</p>
                  <p className="text-xs text-slate-500">points</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
        <Card className="p-5">
          <h3 className="font-semibold text-white mb-4">Team Stats</h3>
          <div className="space-y-3">
            {sortedTeam.map((m,i)=>(
              <div key={m.id} className="flex items-center gap-3">
                <span className="text-lg">{m.avatar}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{color:m.isMe?"#22c55e":"#94a3b8"}}>{m.name}</span>
                    <span className="text-slate-400">{m.focusToday}m today</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800">
                    <div className="h-full rounded-full"
                      style={{width:`${(m.focusToday/sortedTeam.reduce((a,b)=>a.focusToday>b.focusToday?a:b).focusToday)*100}%`,backgroundColor:m.isMe?"#22c55e":"#334155"}}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {myRank>1&&(
          <Card className="p-5" style={{borderColor:"#22c55e20",background:"#22c55e05"}}>
            <h3 className="font-semibold text-green-400 mb-2">💪 Motivation</h3>
            <p className="text-sm text-slate-300">
              You need <span className="text-green-400 font-bold">{sortedTeam[myRank-2].pts-sortedTeam[myRank-1].pts} more points</span> to reach #{myRank-1}!
              Focus for <span className="text-green-400 font-bold">{Math.ceil((sortedTeam[myRank-2].pts-sortedTeam[myRank-1].pts)/10)} more minutes</span> to climb the leaderboard.
            </p>
          </Card>
        )}
      </div>
    </div>
  );

  // ──────────── REPORT TAB ──────────────────────────────────────
  const TabReport = ()=>{
    const [selectedDate, setSelectedDate] = useState(WEEKLY[2].date);
    const selectedDay = WEEKLY.find(d=>d.date===selectedDate) || WEEKLY[2];
    const maxFocus=Math.max(...WEEKLY.map(d=>d.focus));
    const dailySummary = [
      {label:"Focus", value:focusMin, unit:"min", color:"#22c55e", pct:Math.round((focusMin/todayGoal)*100)},
      {label:"Fatigue", value:dist.Fatigue, unit:"min", color:"#f97316", pct:Math.round((dist.Fatigue/Object.values(dist).reduce((a,b)=>a+b,0))*100)},
      {label:"Anxiety", value:dist.Anxiety, unit:"min", color:"#ef4444", pct:Math.round((dist.Anxiety/Object.values(dist).reduce((a,b)=>a+b,0))*100)},
      {label:"Boredom", value:dist.Boredom, unit:"min", color:"#3b82f6", pct:Math.round((dist.Boredom/Object.values(dist).reduce((a,b)=>a+b,0))*100)},
    ];
    return(
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              {label:"Daily Focus",   value:`${focusMin}m`, icon:"⏱", color:"#22c55e"},
              {label:"Weekly Focus",  value:"8.2h",       icon:"📊", color:"#3b82f6"},
              {label:"Best Day",      value:"Wed",        icon:"🏆", color:"#f59e0b"},
              {label:"Focus Score",   value:"74%",        icon:"🎯", color:"#a855f7"},
            ].map(s=>(
              <Card key={s.label} className="p-4 text-center">
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className="text-2xl font-bold" style={{color:s.color}}>{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-white">Daily Summary</h3>
                  <p className="text-xs text-slate-400">Today’s focus and distraction split</p>
                </div>
                <div className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-slate-400">
                  {new Date().toLocaleDateString("en-US", { month:"short", day:"numeric" })}
                </div>
              </div>
              <div className="space-y-3">
                {dailySummary.map(item=>(
                  <div key={item.label} className="rounded-xl border border-white/5 p-3" style={{backgroundColor:`${item.color}08`,borderColor:`${item.color}20`}}>
                    <div className="flex justify-between text-sm mb-2">
                      <span style={{color:item.color}}>{item.label}</span>
                      <span className="font-bold" style={{color:item.color}}>{item.value}{item.unit}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${Math.min(item.pct,100)}%`,backgroundColor:item.color,boxShadow:`0 0 10px ${item.color}55`}} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-white">Weekly Summary</h3>
                  <p className="text-xs text-slate-400">Pick a date to see the day details</p>
                </div>
                <select
                  value={selectedDate}
                  onChange={(e)=>setSelectedDate(e.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none"
                >
                  {WEEKLY.map(d=>(
                    <option key={d.date} value={d.date}>{d.date} - {d.day}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-7 gap-2 items-end h-44 mb-5">
                {WEEKLY.map(d=>{
                  const active = d.date===selectedDate;
                  return (
                    <button
                      key={d.date}
                      onClick={()=>setSelectedDate(d.date)}
                      className="flex h-full flex-col items-center justify-end gap-1 text-left"
                    >
                      <span className="text-[10px] text-slate-400">{d.focus}%</span>
                      <div
                        className="w-full rounded-t-lg transition-all duration-300"
                        style={{
                          height:`${(d.focus/100)*140}px`,
                          background:active
                            ? "linear-gradient(180deg,#a855f7,#7c3aed)"
                            : "linear-gradient(180deg,#22c55e,#16a34a)",
                          boxShadow:active ? "0 0 14px #a855f744" : "0 0 12px #22c55e30",
                          border: active ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.05)",
                        }}
                      />
                      <span className="text-[10px] text-slate-400">{d.day}</span>
                    </button>
                  );
                })}
              </div>
              <div className="rounded-2xl border border-white/5 p-4" style={{background:`linear-gradient(135deg,${selectedDay.focus >= 85 ? "#22c55e" : "#3b82f6"}12,rgba(13,31,53,0.7))`}}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedDay.date}</p>
                    <p className="text-xs text-slate-400">{selectedDay.day}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{backgroundColor:"rgba(255,255,255,0.06)",color:selectedDay.focus >= 85 ? "#22c55e" : "#3b82f6"}}>
                    {selectedDay.detail.note}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {REPORT_TYPES.map(type=>{
                    const value = selectedDay.detail[type.key];
                    return (
                      <div key={type.key} className="rounded-xl border p-3" style={{backgroundColor:`${type.color}08`,borderColor:`${type.color}25`}}>
                        <p className="text-[11px] uppercase tracking-widest" style={{color:type.color}}>{type.label}</p>
                        <p className="mt-1 text-2xl font-bold" style={{color:type.color}}>{value}</p>
                        <p className="text-[11px] text-slate-400">minutes</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold text-white mb-4">Daily Report</h3>
              <div className="space-y-2 text-sm">
                {[
                  {label:"Focus Time",     value:`${focusMin} min`,    color:"#22c55e"},
                  {label:"Total Points",   value:`${points} pts`,      color:"#f59e0b"},
                  {label:"Fatigue Events", value:`${dist.Fatigue} min`, color:"#f97316"},
                  {label:"Anxiety Events", value:`${dist.Anxiety} min`, color:"#ef4444"},
                  {label:"Boredom Events", value:`${dist.Boredom} min`, color:"#3b82f6"},
                  {label:"Team Rank",      value:`#${myRank}`,         color:"#a855f7"},
                ].map(r=>(
                  <div key={r.label} className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">{r.label}</span>
                    <span className="font-bold" style={{color:r.color}}>{r.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-white mb-4">💡 Personalized Insights</h3>
              <div className="space-y-3">
                {[
                  {icon:"📉",text:"Friday had most distractions due to fatigue. You studied 4 hours continuously. Try adding short breaks next Friday.",color:"#f97316"},
                  {icon:"🌟",text:"Wednesday was your best focus day this week with 91% focus rate!",color:"#22c55e"},
                  {icon:"🎯",text:"Your Boredom episodes peak after 45-min study blocks. Consider switching topics then.",color:"#3b82f6"},
                ].map((ins,i)=>(
                  <div key={i} className="flex gap-3 p-3 rounded-xl border"
                    style={{borderColor:`${ins.color}25`,backgroundColor:`${ins.color}08`}}>
                    <span className="text-xl shrink-0">{ins.icon}</span>
                    <p className="text-xs text-slate-300 leading-relaxed">{ins.text}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const VIEWS = {
    dashboard:   <TabDashboard/>,
    monitoring:  <TabMonitoring/>,
    tree:        <TabTree/>,
    achievements:<TabAchievements/>,
    leaderboard: <TabLeaderboard/>,
    report:      <TabReport/>,
  };

  return(
    <div className="min-h-screen text-white"
      style={{background:"radial-gradient(ellipse at 15% 15%,#0d2518 0%,#050d1a 50%,#080416 100%)",fontFamily:"'DM Sans',system-ui,sans-serif"}}>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl transition-all duration-1000"
          style={{backgroundColor:cfg.color,opacity:0.05}}/>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{backgroundColor:"#22c55e",opacity:0.03}}/>
      </div>

      {/* HEADER */}
      <div className="sticky top-0 z-40 border-b border-white/5"
        style={{background:"rgba(5,13,26,0.9)",backdropFilter:"blur(16px)"}}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="text-xl">🌱</span>
              <span className="font-bold text-white">FocusForest</span>
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{backgroundColor:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}`}}>
                {cfg.icon} {cfg.label}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={()=>setSessionOn(s=>!s)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{backgroundColor:sessionOn?"#22c55e12":"rgba(255,255,255,0.04)",borderColor:sessionOn?"#22c55e35":"rgba(255,255,255,0.08)",color:sessionOn?"#22c55e":"#64748b"}}>
                {sessionOn?"● Active":"○ Paused"}
              </button>
              <div className="px-3 py-1.5 rounded-lg text-xs font-bold border border-yellow-500/25"
                style={{backgroundColor:"#f59e0b10",color:"#f59e0b"}}>
                ✦ {points.toLocaleString()}
              </div>
              <button onClick={()=>setShowCheckIn(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/8 text-slate-400 hover:text-white hover:border-white/20 transition-all">
                Check-in
              </button>
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-1 pb-0 overflow-x-auto scrollbar-hide">
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all"
                style={{
                  borderBottomColor:tab===t.id?cfg.color:"transparent",
                  color:tab===t.id?cfg.color:"#64748b",
                }}>
                <span className="text-base">{t.icon}</span>
                <span className="hidden md:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {VIEWS[tab]}
      </div>

      {/* CHECK-IN */}
      {showCheckIn&&(
        <div className="fixed bottom-6 right-6 z-50 w-80">
          <div className="rounded-3xl p-5 border border-white/10"
            style={{background:"rgba(13,31,53,0.97)",backdropFilter:"blur(20px)",boxShadow:"0 0 40px rgba(34,197,94,0.12)"}}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-white">Quick Check-in 📋</p>
                <p className="text-xs text-slate-400">Are you focusing right now?</p>
              </div>
              <button onClick={()=>setShowCheckIn(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            {checkInAns===null?(
              <div className="flex gap-2">
                <button onClick={()=>{setCheckInAns(true);setTimeout(()=>{setShowCheckIn(false);setCheckInAns(null);},2000);}}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-green-500 text-white hover:bg-green-400 transition-all">
                  ✅ Yes
                </button>
                <button onClick={()=>{setCheckInAns(false);setTimeout(()=>{setShowCheckIn(false);setShowModal(true);setCheckInAns(null);},2000);}}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-white/10 text-slate-300 hover:bg-white/5 transition-all">
                  😔 No
                </button>
              </div>
            ):(
              <p className={`text-sm font-semibold text-center py-1 ${checkInAns?"text-green-400":"text-orange-400"}`}>
                {checkInAns?"Great! Keep going! 🌱":"Let's try a quick challenge! 💪"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* INTERVENTION */}
      {showModal&&["Fatigue","Anxiety","Boredom"].includes(state)&&(
        <IntModal state={state} onClose={()=>setShowModal(false)}
          onComplete={()=>{setPoints(p=>p+INTERVENTIONS[state]?.reward||20);setShowModal(false);}}/>
      )}
    </div>
  );
}