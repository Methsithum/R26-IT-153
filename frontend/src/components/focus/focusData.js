export const CLASSES = ["Focused","Fatigue","Anxiety","Boredom"];

export const STATE_CFG = {
  Focused: { color:"#22c55e", bg:"#22c55e12", border:"#22c55e35", icon:"🎯", label:"Focused"  },
  Fatigue: { color:"#f97316", bg:"#f9731612", border:"#f9731635", icon:"😴", label:"Fatigue"  },
  Anxiety: { color:"#ef4444", bg:"#ef444412", border:"#ef444435", icon:"😰", label:"Anxiety"  },
  Boredom: { color:"#3b82f6", bg:"#3b82f612", border:"#3b82f635", icon:"😑", label:"Boredom"  },
};

export const LEVEL_DATA = [
  { name:"Seedling",      min:0,    max:500,  icon:"🌱" },
  { name:"Growing Plant", min:500,  max:1500, icon:"🌿" },
  { name:"Focus Tree",    min:1500, max:3000, icon:"🌳" },
  { name:"Golden Tree",   min:3000, max:9999, icon:"✨" },
];

// Achievement definitions only — no hardcoded `earned` flag. FocusApp computes
// `earned` per achievement from real live-session metrics (see FocusApp.jsx)
// since this app has no persistence: multi-day achievements (Perfect Week,
// Early Bird, Night Owl, Unbreakable) can't honestly be "earned" within a
// single session and always render locked.
export const ACHIEVEMENTS_LIST = [
  { id:1, key:"sprint25",     name:"25-min Sprint",   icon:"⚡", desc:"Focus 25 min straight",      pts:50  },
  { id:2, key:"calmQuest5",   name:"Stress Buster",   icon:"🧘", desc:"Complete 5 Calm Quests",     pts:30  },
  { id:3, key:"perfectWeek",  name:"Perfect Week",    icon:"🌟", desc:"Focus 5 days in a row",       pts:100 },
  { id:4, key:"earlyBird",    name:"Early Bird",      icon:"🌅", desc:"Study before 7 AM",           pts:40  },
  { id:5, key:"nightOwl",     name:"Night Owl",       icon:"🦉", desc:"Study after 9 PM",            pts:25  },
  { id:6, key:"teamPlayer",   name:"Team Player",     icon:"🤝", desc:"Top 2 in leaderboard",        pts:60  },
  { id:7, key:"treeWhisperer",name:"Tree Whisperer",  icon:"🌲", desc:"Reach Focus Tree level",      pts:80  },
  { id:8, key:"unbreakable",  name:"Unbreakable",     icon:"💎", desc:"7-day focus streak",          pts:150 },
  { id:9, key:"zenMaster",    name:"Zen Master",      icon:"☯️", desc:"10 Calm Quests completed",    pts:70  },
];

export const INTERVENTIONS = {
  Focused: {
    title:"Keep It Up", emoji:"🎯", color:"#22c55e",
    msg:"You're in the zone! Maintain this momentum.",
    steps:["Continue your current task","Take a note of progress","Celebrate this focus time"],
    reward:10, timer:30,
  },
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

export const REPORT_TYPES = [
  { key:"focus", label:"Focus", color:"#22c55e" },
  { key:"fatigue", label:"Fatigue", color:"#f97316" },
  { key:"anxiety", label:"Anxiety", color:"#ef4444" },
  { key:"boredom", label:"Boredom", color:"#3b82f6" },
];

export const TABS = [
  { id:"dashboard",   label:"Dashboard",       icon:"📊" },
  { id:"monitoring",  label:"Live Monitoring", icon:"📷" },
  { id:"tree",        label:"My Tree",         icon:"🌳" },
  { id:"achievements",label:"Achievements",    icon:"🏅" },
  { id:"leaderboard", label:"Leaderboard",     icon:"🏆" },
  { id:"report",      label:"Report",          icon:"📈" },
];

export default {
  CLASSES, STATE_CFG, LEVEL_DATA, ACHIEVEMENTS_LIST, INTERVENTIONS, REPORT_TYPES, TABS
};
