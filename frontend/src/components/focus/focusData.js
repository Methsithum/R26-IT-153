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

export const ACHIEVEMENTS_LIST = [
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

export const TEAM = [
  { id:1, name:"You",     pts:1240, avatar:"🧑‍💻", isMe:true,  focusToday:47, streak:3 },
  { id:2, name:"Kasun",   pts:1580, avatar:"👨‍🎓", isMe:false, focusToday:62, streak:5 },
  { id:3, name:"Nimasha", pts:980,  avatar:"👩‍💻", isMe:false, focusToday:38, streak:2 },
  { id:4, name:"Dilan",   pts:720,  avatar:"👨‍💻", isMe:false, focusToday:25, streak:1 },
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

export const WEEKLY = [
  { day:"Mon", date:"2026-05-05", focus:82, dist:18, detail:{focus:98, fatigue:9, anxiety:3, boredom:6, note:"Strong start with few interruptions."} },
  { day:"Tue", date:"2026-05-06", focus:65, dist:35, detail:{focus:78, fatigue:12, anxiety:8, boredom:15, note:"Midweek fatigue started to build."} },
  { day:"Wed", date:"2026-05-07", focus:91, dist:9,  detail:{focus:112, fatigue:4, anxiety:2, boredom:3, note:"Best day of the week with steady focus."} },
  { day:"Thu", date:"2026-05-08", focus:74, dist:26, detail:{focus:86, fatigue:10, anxiety:6, boredom:10, note:"Balanced day with a few small breaks needed."} },
  { day:"Fri", date:"2026-05-09", focus:55, dist:45, detail:{focus:64, fatigue:18, anxiety:10, boredom:17, note:"Fatigue was highest late in the day."} },
  { day:"Sat", date:"2026-05-10", focus:88, dist:12, detail:{focus:105, fatigue:3, anxiety:2, boredom:7, note:"Weekend study session stayed productive."} },
  { day:"Sun", date:"2026-05-11", focus:47, dist:53, detail:{focus:54, fatigue:22, anxiety:11, boredom:20, note:"Lower focus day, mostly due to distraction spikes."} },
];

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
  CLASSES, STATE_CFG, LEVEL_DATA, ACHIEVEMENTS_LIST, TEAM, INTERVENTIONS, WEEKLY, REPORT_TYPES, TABS
};
