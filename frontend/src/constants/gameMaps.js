export const ACTIVITY_TO_BACKEND = {
  revision: 'academic_study',
  assignment: 'assignment_work',
  project: 'project_development',
  internship: 'internship',
  sports: 'sports',
  club: 'club_participation',
};

export const MAP_DEFINITIONS = {
  knowledge_forest: {
    id: 'knowledge_forest',
    activityId: 'revision',
    name: 'Knowledge Forest',
    icon: '📚',
    description: 'Lecture revision through an enchanted forest of knowledge.',
    collectibles: ['book', 'note', 'knowledge_star'],
    collectibleLabel: 'Books',
    collectibleEmoji: '📚',
    xpReward: 100,
    bossName: 'Knowledge Guardian',
    bossEmoji: '🦉',
    durationMinutes: 3,
    skyColor: '#0a1628',
    fogColor: '#1a3a2a',
    groundColor: '#2d5a3d',
    accentColor: '#4ade80',
    ambientIntensity: 0.4,
    envType: 'forest',
  },
  assignment_dungeon: {
    id: 'assignment_dungeon',
    activityId: 'assignment',
    name: 'Assignment Dungeon',
    icon: '📝',
    description: 'Navigate stone corridors and collect assignment scrolls.',
    collectibles: ['scroll'],
    collectibleLabel: 'Scrolls',
    collectibleEmoji: '📝',
    xpReward: 100,
    bossName: 'Deadline Beast',
    bossEmoji: '⏰',
    durationMinutes: 3,
    skyColor: '#0f0a14',
    fogColor: '#2a1a3a',
    groundColor: '#3d3d4a',
    accentColor: '#f59e0b',
    ambientIntensity: 0.25,
    envType: 'dungeon',
  },
  project_laboratory: {
    id: 'project_laboratory',
    activityId: 'project',
    name: 'Project Laboratory',
    icon: '💻',
    description: 'Race through a futuristic lab collecting project chips.',
    collectibles: ['project_chip'],
    collectibleLabel: 'Chips',
    collectibleEmoji: '💻',
    xpReward: 100,
    bossName: 'Bug Monster',
    bossEmoji: '🐛',
    durationMinutes: 4,
    skyColor: '#0a0f1a',
    fogColor: '#1a2a4a',
    groundColor: '#1e293b',
    accentColor: '#38bdf8',
    ambientIntensity: 0.35,
    envType: 'lab',
  },
  internship_city: {
    id: 'internship_city',
    activityId: 'internship',
    name: 'Internship City',
    icon: '🏢',
    description: 'Sprint through the modern city collecting career tokens.',
    collectibles: ['career_token'],
    collectibleLabel: 'Tokens',
    collectibleEmoji: '🏢',
    xpReward: 100,
    bossName: 'Work Challenge',
    bossEmoji: '💼',
    durationMinutes: 3,
    skyColor: '#0c1222',
    fogColor: '#1e3a5f',
    groundColor: '#334155',
    accentColor: '#818cf8',
    ambientIntensity: 0.3,
    envType: 'city',
  },
  activity_arena: {
    id: 'activity_arena',
    activityId: 'club',
    name: 'Activity Arena',
    icon: '⚽',
    description: 'Dash across the arena collecting activity gems.',
    collectibles: ['activity_gem'],
    collectibleLabel: 'Gems',
    collectibleEmoji: '⚽',
    xpReward: 100,
    bossName: 'Competition Beast',
    bossEmoji: '🏆',
    durationMinutes: 3,
    skyColor: '#0a1420',
    fogColor: '#1a3050',
    groundColor: '#1a472a',
    accentColor: '#f472b6',
    ambientIntensity: 0.4,
    envType: 'arena',
  },
};

const ACTIVITY_TO_MAP_KEY = {
  revision: 'knowledge_forest',
  assignment: 'assignment_dungeon',
  project: 'project_laboratory',
  internship: 'internship_city',
  sports: 'activity_arena',
  club: 'activity_arena',
};

export function buildMapSequence(selectedActivityIds) {
  const seen = new Set();
  const maps = [];

  for (const activityId of selectedActivityIds) {
    const mapKey = ACTIVITY_TO_MAP_KEY[activityId];
    if (!mapKey || seen.has(mapKey)) continue;
    seen.add(mapKey);
    maps.push({ ...MAP_DEFINITIONS[mapKey], missionActivityId: activityId });
  }

  return maps;
}

export const LEVEL_TITLES = [
  'Fresh Explorer',
  'Active Learner',
  'Knowledge Seeker',
  'Consistent Scholar',
  'Master Adventurer',
  'Legendary Scholar',
];

export function getLevelTitle(level) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] || 'Legendary Scholar';
}

export function buildBackendActivities(missions) {
  return missions
    .map((m) => ACTIVITY_TO_BACKEND[m.id] || ACTIVITY_TO_BACKEND[m.missionActivityId])
    .filter(Boolean);
}

export const LANES = [-2, 0, 2];
export const RUN_SPEED = 14;
export const JUMP_FORCE = 10;
export const MAP_COMPLETE_DISTANCE = 160;
export const MIN_COLLECTIBLES_FOR_CHECKPOINT = 8;
