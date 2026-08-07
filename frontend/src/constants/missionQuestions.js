/** In-path questions per map — player picks answer by choosing a lane. */
export const MISSION_QUESTIONS = {
  knowledge_forest: [
    {
      question: 'Which subject did you revise today?',
      options: ['Database Systems', 'Networking', 'Software Engineering'],
      correctLane: 0,
    },
    {
      question: 'How long was your study session?',
      options: ['Under 30 min', '30–60 min', 'Over 1 hour'],
      correctLane: 1,
    },
    {
      question: 'How well do you understand today\'s topic?',
      options: ['Still confused', 'Getting there', 'Confident'],
      correctLane: 2,
    },
  ],
  assignment_dungeon: [
    {
      question: 'How far is your assignment progress?',
      options: ['Just started', 'Halfway done', 'Almost finished'],
      correctLane: 1,
    },
    {
      question: 'What blocked you most today?',
      options: ['Research', 'Writing', 'Formatting'],
      correctLane: 0,
    },
    {
      question: 'When is your deadline?',
      options: ['This week', 'Next week', 'Later'],
      correctLane: 0,
    },
  ],
  project_laboratory: [
    {
      question: 'What did you work on today?',
      options: ['Planning', 'Coding', 'Testing'],
      correctLane: 1,
    },
    {
      question: 'Team collaboration level?',
      options: ['Solo work', 'Pair work', 'Full team'],
      correctLane: 1,
    },
    {
      question: 'Biggest project challenge?',
      options: ['Scope creep', 'Technical bugs', 'Time management'],
      correctLane: 2,
    },
  ],
  internship_city: [
    {
      question: 'Main internship focus today?',
      options: ['Meetings', 'Technical tasks', 'Learning tools'],
      correctLane: 1,
    },
    {
      question: 'Work environment today?',
      options: ['On-site', 'Remote', 'Hybrid'],
      correctLane: 2,
    },
    {
      question: 'Skill you practiced most?',
      options: ['Communication', 'Coding', 'Problem solving'],
      correctLane: 2,
    },
  ],
  activity_arena: [
    {
      question: 'Which activity did you do?',
      options: ['Sports', 'Club meeting', 'University event'],
      correctLane: 0,
    },
    {
      question: 'How active were you?',
      options: ['Light', 'Moderate', 'Very intense'],
      correctLane: 1,
    },
    {
      question: 'Social engagement level?',
      options: ['Mostly alone', 'Small group', 'Large group'],
      correctLane: 1,
    },
  ],
};

export function generateMissionGates(mapId) {
  const questions = MISSION_QUESTIONS[mapId] || MISSION_QUESTIONS.knowledge_forest;
  return questions.map((q, i) => ({
    id: `${mapId}-gate-${i}`,
    z: -(40 + i * 45),
    question: q.question,
    options: q.options,
    correctLane: q.correctLane,
  }));
}
