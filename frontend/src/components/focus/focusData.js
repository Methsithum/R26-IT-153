export const CLASSES = ["Focused","Fatigue","Anxiety","Boredom"];

export const STATE_CFG = {
  Focused: { color:"#22c55e", bg:"#22c55e12", border:"#22c55e35", icon:"🎯", label:"Focused"  },
  Fatigue: { color:"#f97316", bg:"#f9731612", border:"#f9731635", icon:"😴", label:"Fatigue"  },
  Anxiety: { color:"#ef4444", bg:"#ef444412", border:"#ef444435", icon:"😰", label:"Anxiety"  },
  Boredom: { color:"#3b82f6", bg:"#3b82f612", border:"#3b82f635", icon:"😑", label:"Boredom"  },
  // Not a model class (deliberately absent from CLASSES, so it never gets a
  // probability bar) -- the display stand-in for "the camera is live but there
  // is no face to read", which otherwise showed the last state as if current.
  NoFace:  { color:"#94a3b8", bg:"#94a3b812", border:"#94a3b835", icon:"👤", label:"No face" },
};

export const TREE_MOOD = {
  Focused: { emoji: "😊", line: "Your tree is happy — you're in the zone!" },
  Fatigue: { emoji: "😴", line: "Your tree is sleepy — a short rest would help." },
  Anxiety: { emoji: "😟", line: "Your tree is uneasy — take a slow breath." },
  Boredom: { emoji: "😔", line: "Your tree looks sad — mix the task up a bit." },
  NoFace:  { emoji: "😶", line: "Your tree is waiting until you're back in frame." },
};

export const LEVEL_DATA = [
  { name: "Seedling",      min: 0,  max: 30,  icon: "🌱" },
  { name: "Growing Plant", min: 30, max: 60,  icon: "🌿" },
  { name: "Focus Tree",    min: 60, max: 85,  icon: "🌳" },
  { name: "Golden Tree",   min: 85, max: 100, icon: "✨" },
];

export function levelIndexFromPoints(points) {
  const xp = Math.max(0, Number(points) || 0);
  return Math.max(0, LEVEL_DATA.filter((l) => xp >= l.min).length - 1);
}

// Achievement definitions only — `earned` is computed from persisted Mongo
// history (weekly days, streaks, interventions) in FocusApp, not hardcoded.
export const ACHIEVEMENTS_LIST = [
  { id:1, key:"sprint25",     name:"25-min Sprint",   icon:"⚡", desc:"Focus 25 min straight",      pts:50  },
  { id:2, key:"calmQuest5",   name:"Stress Buster",   icon:"🧘", desc:"Complete 5 Calm Quests",     pts:30  },
  { id:3, key:"perfectWeek",  name:"Perfect Week",    icon:"🌟", desc:"Focus 5 days in a row",       pts:100 },
  { id:4, key:"earlyBird",    name:"Early Bird",      icon:"🌅", desc:"Study before 7 AM",           pts:40  },
  { id:5, key:"nightOwl",     name:"Night Owl",       icon:"🦉", desc:"Study after 9 PM",            pts:25  },
  { id:6, key:"teamPlayer",   name:"Team Player",     icon:"🤝", desc:"Top 2 in leaderboard",        pts:60  },
  { id:7, key:"treeWhisperer",name:"Tree Whisperer",  icon:"🌲", desc:"Reach Focus Tree level (60 XP)", pts:80  },
  { id:8, key:"unbreakable",  name:"Unbreakable",     icon:"💎", desc:"7-day focus streak",          pts:150 },
  { id:9, key:"zenMaster",    name:"Zen Master",      icon:"☯️", desc:"10 Calm Quests completed",    pts:70  },
];

export const INTERVENTIONS = {
  Focused: [
    {
      title: "Keep going",
      emoji: "🎯",
      msg: "You are doing well. Stay with this task a bit longer.",
      steps: ["Keep working on this task", "Write one thing you finished", "Give yourself a small smile"],
      reward: 10,
      timer: 30,
    },
  ],
  Fatigue: [
    {
      title: "Look far away",
      emoji: "👀",
      msg: "Your body is tired. Rest your eyes, then come back.",
      steps: ["Look at something far for 20 seconds", "Blink slowly 10 times", "Relax your jaw"],
      reward: 20,
      timer: 60,
    },
    {
      title: "Rest your eyes",
      emoji: "😴",
      msg: "Give your eyes a short rest.",
      steps: ["Rub your hands until they feel warm", "Cover your closed eyes for 20 seconds", "Open them and look at one thing"],
      reward: 20,
      timer: 45,
    },
    {
      title: "Move your shoulders",
      emoji: "💪",
      msg: "A small stretch can wake you up.",
      steps: ["Roll your shoulders 5 times", "Pull your chin in for 5 seconds", "Shake your hands"],
      reward: 15,
      timer: 45,
    },
    {
      title: "Stand up",
      emoji: "🧍",
      msg: "Get out of your chair for a moment.",
      steps: ["Stand up", "Stretch both arms up", "Sit down with both feet on the floor"],
      reward: 20,
      timer: 40,
    },
    {
      title: "Drink water",
      emoji: "💧",
      msg: "A sip of water can help you feel less sleepy.",
      steps: ["Take a sip of water", "Sit up straight", "Take one slow breath"],
      reward: 15,
      timer: 40,
    },
    {
      title: "Close your eyes",
      emoji: "😌",
      msg: "A tiny rest, then back to work.",
      steps: ["Close your eyes for 30 seconds", "Count 10 breaths", "Open them and say your next small task"],
      reward: 20,
      timer: 60,
    },
    {
      title: "Find some light",
      emoji: "☀️",
      msg: "A bit of light can help you wake up.",
      steps: ["Look toward a window or a lamp", "Blink 5 times", "Look back at the screen"],
      reward: 15,
      timer: 45,
    },
    {
      title: "Ease your neck",
      emoji: "🧘",
      msg: "Loosen a stiff neck so you feel less tired.",
      steps: ["Look left for 5 seconds", "Look right for 5 seconds", "Tilt your head to each shoulder"],
      reward: 15,
      timer: 50,
    },
    {
      title: "Feel the floor",
      emoji: "🦶",
      msg: "Wake up your body with your feet.",
      steps: ["Put both feet flat on the floor", "Press your toes, then your heels", "Feel the floor for 10 seconds"],
      reward: 15,
      timer: 40,
    },
    {
      title: "Tiny restart",
      emoji: "🔄",
      msg: "Do one small bit, then check how you feel.",
      steps: ["Set a 2-minute timer", "Do only the next line or problem", "Stop and check how you feel"],
      reward: 25,
      timer: 120,
    },
  ],
  Anxiety: [
    {
      title: "Slow breathing",
      emoji: "🌿",
      msg: "You feel tense. Slow down for a minute.",
      steps: ["Breathe in for 4 seconds", "Hold for 4 seconds", "Breathe out for 6 seconds. Do this 4 times"],
      reward: 15,
      timer: 60,
    },
    {
      title: "Box breathing",
      emoji: "📦",
      msg: "Four slow sides. Your body can calm down.",
      steps: ["Breathe in for 4 seconds", "Hold for 4 seconds", "Breathe out 4, hold 4. Do this 3 times"],
      reward: 15,
      timer: 60,
    },
    {
      title: "Name what is here",
      emoji: "👀",
      msg: "Look around. You are safe right now.",
      steps: ["Name 5 things you see", "Name 4 things you can touch", "Name 3 things you hear"],
      reward: 15,
      timer: 50,
    },
    {
      title: "Say it out loud",
      emoji: "💬",
      msg: "Name the feeling so it feels smaller.",
      steps: ["Say “I feel worried.”", "Say “This will pass.”", "Relax your stomach"],
      reward: 15,
      timer: 40,
    },
    {
      title: "Hand on chest",
      emoji: "❤️",
      msg: "Feel your breath. You do not have to rush.",
      steps: ["Put a hand on your chest", "Feel 5 heartbeats", "Breathe out longer than you breathe in"],
      reward: 15,
      timer: 45,
    },
    {
      title: "Drop your shoulders",
      emoji: "😮‍💨",
      msg: "Let the tightness leave your shoulders.",
      steps: ["Lift your shoulders for 3 seconds", "Drop them with a sigh", "Do this 3 times"],
      reward: 15,
      timer: 40,
    },
    {
      title: "Cool your hands",
      emoji: "🧊",
      msg: "A cool touch can help you settle.",
      steps: ["Put cool water or a cool object on your wrists", "Hold for 10 seconds", "Take one slow breath"],
      reward: 15,
      timer: 40,
    },
    {
      title: "One small step",
      emoji: "1️⃣",
      msg: "You do not need the whole task. Just the next bit.",
      steps: ["Write the next 2-minute task", "Do only that", "Ignore everything else for now"],
      reward: 20,
      timer: 90,
    },
    {
      title: "Safe words",
      emoji: "🛟",
      msg: "A short reminder that you are okay.",
      steps: ["Say “I am here. I am okay” three times", "Relax your forehead", "Relax your tongue"],
      reward: 15,
      timer: 40,
    },
    {
      title: "Squeeze and let go",
      emoji: "✊",
      msg: "Squeeze, then release. Let the worry go with it.",
      steps: ["Make fists for 5 seconds", "Open your hands", "Shake your fingers"],
      reward: 15,
      timer: 45,
    },
  ],
  Boredom: [
    {
      title: "Two-minute race",
      emoji: "⏱️",
      msg: "This feels dull. Make the next bit smaller and more fun.",
      steps: ["Pick one small part of the work", "Set 2 minutes", "Do only that until time is up"],
      reward: 25,
      timer: 120,
    },
    {
      title: "Teach it",
      emoji: "🗣️",
      msg: "Say it in your own words. That makes it less boring.",
      steps: ["Say the last idea in your own words", "Make it one sentence", "Write that sentence"],
      reward: 20,
      timer: 60,
    },
    {
      title: "Ask “what if?”",
      emoji: "❓",
      msg: "A new question can make the work feel fresh.",
      steps: ["Write one “what if…?” question", "Answer in one line", "Use that as your next step"],
      reward: 20,
      timer: 50,
    },
    {
      title: "Switch how you work",
      emoji: "🔀",
      msg: "Change the way you study for one minute.",
      steps: ["Switch: reading to writing, or writing to an example", "Do 1 minute this new way", "Write one new thing you noticed"],
      reward: 20,
      timer: 70,
    },
    {
      title: "Earn a break",
      emoji: "🎁",
      msg: "Do one hard step, then you get a short break.",
      steps: ["Name a 5-minute break you will take after", "Do the first hard step", "Tick it off"],
      reward: 25,
      timer: 60,
    },
    {
      title: "Find one cool fact",
      emoji: "✨",
      msg: "Look for one interesting thing in this topic.",
      steps: ["Find one interesting thing", "Say why it matters", "Keep going from there"],
      reward: 20,
      timer: 60,
    },
    {
      title: "Mark the next bit",
      emoji: "⭕",
      msg: "See the next small piece. Start only that.",
      steps: ["Circle the next heading or question", "Guess how many minutes it needs", "Start the first line"],
      reward: 20,
      timer: 45,
    },
    {
      title: "Change your seat",
      emoji: "🪑",
      msg: "A new sitting way can make the work feel new.",
      steps: ["Sit in a new way, or stand", "Look at your notes from this new spot", "Do 3 short bits only"],
      reward: 20,
      timer: 50,
    },
    {
      title: "Beat 60 seconds",
      emoji: "⭐",
      msg: "Race the clock on one small chunk.",
      steps: ["Count down 60 seconds", "Finish one small chunk", "Put a star next to it"],
      reward: 25,
      timer: 60,
    },
    {
      title: "Make a new example",
      emoji: "✏️",
      msg: "Change one number or word and solve it again.",
      steps: ["Take one example from your notes", "Change one number or word", "Solve this new one"],
      reward: 25,
      timer: 90,
    },
  ],
};

export const CHALLENGE_POINT_COST = 5;
export const DAILY_CHALLENGE_POINTS = 100;
export const DISTRACTION_TYPES = ["Fatigue", "Anxiety", "Boredom"];

export function challengePointsFor(taken, boosts = 0) {
  const raw = CHALLENGE_POINT_COST * Math.max(0, boosts || 0) - CHALLENGE_POINT_COST * Math.max(0, taken || 0);
  return Math.max(0, Math.min(DAILY_CHALLENGE_POINTS, raw));
}

export function pickChallengeType(current) {
  if (DISTRACTION_TYPES.includes(current)) return current;
  return DISTRACTION_TYPES[Math.floor(Math.random() * DISTRACTION_TYPES.length)];
}

const lastPickedIndex = {};

export function pickIntervention(type) {
  const list = INTERVENTIONS[type] || INTERVENTIONS.Focused;
  const color = STATE_CFG[type]?.color || STATE_CFG.Focused.color;
  if (!Array.isArray(list) || list.length === 0) return null;
  let idx = Math.floor(Math.random() * list.length);
  if (list.length > 1 && idx === lastPickedIndex[type]) {
    idx = (idx + 1) % list.length;
  }
  lastPickedIndex[type] = idx;
  return { ...list[idx], color };
}

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
  { id:"profile",     label:"Profile",         icon:"👤" },
];

export default {
  CLASSES, STATE_CFG, TREE_MOOD, LEVEL_DATA, levelIndexFromPoints, ACHIEVEMENTS_LIST, INTERVENTIONS, pickIntervention, pickChallengeType, CHALLENGE_POINT_COST, DAILY_CHALLENGE_POINTS, challengePointsFor, REPORT_TYPES, TABS
};
