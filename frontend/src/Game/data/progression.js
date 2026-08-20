export const XP_PER_LEVEL = 500;

export function levelFromXp(xp = 0) {
  return Math.max(1, Math.floor(Math.max(0, Number(xp) || 0) / XP_PER_LEVEL) + 1);
}

export function xpIntoLevel(xp = 0) {
  return Math.max(0, Number(xp) || 0) % XP_PER_LEVEL;
}

export function xpToNextLevel(xp = 0) {
  return XP_PER_LEVEL - xpIntoLevel(xp);
}

export const BADGE_CATALOG = [
  {
    key: "first_journal",
    label: "First Journal Entry",
    icon: "📖",
    hint: "Complete your first campus day",
    accent: "from-amber-300 to-amber-600",
  },
  {
    key: "streak_3",
    label: "3-Day Streak",
    icon: "🔥",
    hint: "Journal three days in a row",
    accent: "from-orange-400 to-rose-500",
  },
  {
    key: "streak_7",
    label: "7-Day Streak",
    icon: "🌟",
    hint: "Keep the flame alive for a week",
    accent: "from-amber-400 to-orange-600",
  },
  {
    key: "streak_30",
    label: "30-Day Streak",
    icon: "🏆",
    hint: "A full month of campus days",
    accent: "from-yellow-300 to-amber-700",
  },
  {
    key: "journal_10",
    label: "10 Journals",
    icon: "📚",
    hint: "Ten days written into the book",
    accent: "from-sky-300 to-indigo-500",
  },
  {
    key: "journal_30",
    label: "30 Journals",
    icon: "🗓️",
    hint: "A month of recorded campus life",
    accent: "from-emerald-300 to-teal-600",
  },
  {
    key: "journal_50",
    label: "50 Journals",
    icon: "💎",
    hint: "Fifty days of honest check-ins",
    accent: "from-violet-300 to-fuchsia-600",
  },
  {
    key: "xp_500",
    label: "500 XP",
    icon: "⚡",
    hint: "Reach campus level 2",
    accent: "from-lime-300 to-emerald-600",
  },
  {
    key: "xp_1000",
    label: "1000 XP",
    icon: "✨",
    hint: "Reach campus level 3",
    accent: "from-cyan-300 to-sky-600",
  },
  {
    key: "xp_2500",
    label: "2500 XP",
    icon: "👑",
    hint: "A seasoned campus runner",
    accent: "from-amber-200 to-yellow-600",
  },
  {
    key: "tasks_5",
    label: "5 Tasks Completed",
    icon: "✅",
    hint: "Close five assignment quests",
    accent: "from-emerald-300 to-green-700",
  },
  {
    key: "tasks_10",
    label: "10 Tasks Completed",
    icon: "🎯",
    hint: "Ten assignments stamped done",
    accent: "from-teal-300 to-cyan-700",
  },
];

export function badgeMeta(key) {
  return BADGE_CATALOG.find((item) => item.key === key) || {
    key,
    label: key,
    icon: "🏅",
    hint: "Campus milestone",
    accent: "from-amber-300 to-amber-700",
  };
}

export function badgeByLabel(label) {
  return (
    BADGE_CATALOG.find((item) => item.label === label) || {
      key: label,
      label,
      icon: "🏅",
      hint: "Campus milestone",
      accent: "from-amber-300 to-amber-700",
    }
  );
}
