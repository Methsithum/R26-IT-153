export const DEMO_USER_ID = 'demo-test-user';

export function isDemoUser(userId) {
  return userId === DEMO_USER_ID;
}

/** Session for demo — questions are answered in-path, not via popup. */
export function createDemoSession() {
  return {
    session_id: 'demo-session',
    completed: false,
  };
}

/** Build journal completion from in-path answers collected during gameplay. */
export function buildDemoCompletion(maps, answers, sessionXp, correctAnswers, session) {
  const mapNames = maps.map((m) => m.name).join(', ');
  const reflections = answers
    .filter((a) => a.correct)
    .slice(0, 5)
    .map((a) => `"${a.question}" → ${a.answer}`)
    .join('; ');

  const summary = reflections
    || answers.map((a) => a.answer).slice(0, 3).join(', ')
    || 'my selected activities';

  return {
    session_id: session?.session_id || 'demo-session',
    completed: true,
    journal_entry:
      `Today I completed ${maps.length} mission${maps.length > 1 ? 's' : ''} through ${mapNames}. ` +
      `I answered ${answers.length} in-path questions (${correctAnswers} correct paths) while running, ` +
      `collecting rewards and avoiding obstacles. Key reflections: ${summary}. ` +
      `This game-based journey helped me track my learning activities naturally.`,
    xp_earned: Math.max(80, sessionXp),
    new_badges: correctAnswers >= answers.length * 0.7 ? ['path_master'] : ['demo_explorer'],
    level_up: false,
  };
}

/** @deprecated — questions are now in-path */
export function activateDemoCheckpoint() {
  return null;
}

/** @deprecated */
export function answerDemoSession() {
  return null;
}

/** @deprecated */
export function resetDemoForNextMap(session) {
  return session;
}
