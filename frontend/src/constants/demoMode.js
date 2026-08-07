export const DEMO_USER_ID = 'demo-test-user';

export function isDemoUser(userId) {
  return userId === DEMO_USER_ID;
}

/** Session starts WITHOUT questions — Luna speaks only at checkpoint after collecting. */
export function createDemoSession() {
  return {
    session_id: 'demo-session',
    completed: false,
    _demoStep: 0,
    _mapsAnswered: 0,
    question: null,
    options: null,
  };
}

const MAP_QUESTIONS = {
  knowledge_forest: {
    intro: (n) => `Nice run! You collected ${n} knowledge items in the forest.`,
    question: 'Which subject did you revise today?',
    options: ['Database Systems', 'Networking', 'Software Engineering', 'OOP'],
  },
  assignment_dungeon: {
    intro: (n) => `You gathered ${n} assignment scrolls from the dungeon!`,
    question: 'How far did you progress on your assignment?',
    options: ['Just started', 'Halfway done', 'Almost finished', 'Submitted'],
  },
  project_laboratory: {
    intro: (n) => `You collected ${n} project chips in the lab!`,
    question: 'What did you work on in your project today?',
    options: ['Planning & design', 'Coding', 'Testing & debugging', 'Documentation'],
  },
  internship_city: {
    intro: (n) => `You earned ${n} career tokens in the city!`,
    question: 'What internship task did you focus on?',
    options: ['Meetings & reporting', 'Technical tasks', 'Learning new tools', 'Team collaboration'],
  },
  activity_arena: {
    intro: (n) => `You collected ${n} activity gems in the arena!`,
    question: 'Which extracurricular activity did you do?',
    options: ['Sports training', 'Club meeting', 'University event', 'Volunteering'],
  },
};

const FOLLOWUP = {
  question: 'How focused were you during this activity?',
  options: ['Very focused', 'Mostly focused', 'Some distractions', 'Hard to focus'],
};

/** Called when checkpoint opens — generates Luna dialogue from collected items. */
export function activateDemoCheckpoint(session, mapDef, collectedCount) {
  const mapKey = mapDef?.id || 'knowledge_forest';
  const pack = MAP_QUESTIONS[mapKey] || MAP_QUESTIONS.knowledge_forest;
  const step = session._demoStep ?? 0;

  if (step === 0) {
    return {
      ...session,
      intro: pack.intro(collectedCount),
      question: pack.question,
      options: pack.options,
    };
  }

  return {
    ...session,
    intro: 'Great answer! One more thing before we defeat this boss...',
    question: FOLLOWUP.question,
    options: FOLLOWUP.options,
  };
}

export function answerDemoSession(session, answer, mapDef, collectedCount, isLastMap = true) {
  const nextStep = (session._demoStep ?? 0) + 1;

  if (nextStep < 2) {
    const next = activateDemoCheckpoint({ ...session, _demoStep: nextStep }, mapDef, collectedCount);
    return { ...next, _demoStep: nextStep, completed: false };
  }

  if (!isLastMap) {
    return {
      ...resetDemoForNextMap(session),
      _mapBossDone: true,
      completed: false,
    };
  }

  return {
    session_id: 'demo-session',
    completed: true,
    journal_entry:
      `Today I completed my academic adventure through ${mapDef?.name || 'the game world'}. ` +
      `I collected ${collectedCount} items and reflected on my work: "${answer}". ` +
      `I made steady progress on my selected activities and feel motivated for tomorrow.`,
    xp_earned: 150 + collectedCount * 5,
    new_badges: ['demo_explorer'],
    level_up: false,
    _demoStep: 0,
    question: null,
    options: null,
  };
}

/** Reset question after map transition for next map checkpoint. */
export function resetDemoForNextMap(session) {
  return {
    ...session,
    question: null,
    options: null,
    intro: null,
    _demoStep: 0,
    completed: false,
  };
}
