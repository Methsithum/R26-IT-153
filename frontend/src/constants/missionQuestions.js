/** In-path questions per map — player picks answer by choosing a lane (4 options). */
export const MISSION_QUESTIONS = {
  knowledge_forest: [
    {
      question: 'Which subject did you revise today?',
      options: ['Database Systems', 'Networking', 'Software Engineering', 'OOP'],
    },
    {
      question: 'How long was your study session?',
      options: ['Under 30 min', '30–60 min', '1–2 hours', 'Over 2 hours'],
    },
    {
      question: 'How well do you understand today\'s topic?',
      options: ['Still confused', 'Getting there', 'Mostly clear', 'Confident'],
    },
  ],
  assignment_dungeon: [
    {
      question: 'How far is your assignment progress?',
      options: ['Just started', '25% done', 'Halfway done', 'Almost finished'],
    },
    {
      question: 'What blocked you most today?',
      options: ['Research', 'Writing', 'Formatting', 'Time pressure'],
    },
    {
      question: 'When is your deadline?',
      options: ['Today', 'This week', 'Next week', 'Later'],
    },
  ],
  project_laboratory: [
    {
      question: 'What did you work on today?',
      options: ['Planning', 'Coding', 'Testing', 'Documentation'],
    },
    {
      question: 'Team collaboration level?',
      options: ['Solo work', 'Pair work', 'Small team', 'Full team'],
    },
    {
      question: 'Biggest project challenge?',
      options: ['Scope creep', 'Technical bugs', 'Time management', 'Communication'],
    },
  ],
  internship_city: [
    {
      question: 'Main internship focus today?',
      options: ['Meetings', 'Technical tasks', 'Learning tools', 'Reporting'],
    },
    {
      question: 'Work environment today?',
      options: ['On-site', 'Remote', 'Hybrid', 'Field visit'],
    },
    {
      question: 'Skill you practiced most?',
      options: ['Communication', 'Coding', 'Problem solving', 'Leadership'],
    },
  ],
  activity_arena: [
    {
      question: 'Which activity did you do?',
      options: ['Sports', 'Club meeting', 'University event', 'Volunteering'],
    },
    {
      question: 'How active were you?',
      options: ['Light', 'Moderate', 'Very intense', 'Competition level'],
    },
    {
      question: 'Social engagement level?',
      options: ['Mostly alone', 'Small group', 'Medium group', 'Large group'],
    },
  ],
};

export function generateMissionGates(mapId) {
  const questions = MISSION_QUESTIONS[mapId] || MISSION_QUESTIONS.knowledge_forest;
  return questions.map((q, i) => ({
    id: `${mapId}-gate-${i}`,
    z: -(40 + i * 45),
    question: q.question,
    options: q.options.slice(0, 4),
  }));
}
