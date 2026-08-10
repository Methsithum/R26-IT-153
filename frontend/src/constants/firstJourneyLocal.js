const STORAGE_KEY = 'smart-uni-first-journey';

/** Local First Journey for demo / offline testing (mirrors backend steps). */
export const FIRST_JOURNEY_STEPS = [
  {
    id: 'study_year',
    question: 'Which year of study are you in?',
    options: ['Year 1', 'Year 2', 'Year 3', 'Year 4+'],
    question_type: 'lane',
    profile_key: 'study_year',
  },
  {
    id: 'study_area',
    question: 'What is your main study area?',
    options: ['Computing / IT', 'Engineering', 'Business', 'Other field'],
    question_type: 'lane',
    profile_key: 'study_area',
  },
  {
    id: 'has_gpa',
    question: 'Have you received a university GPA yet?',
    options: ['Yes, I have a GPA', 'Not yet', 'First year — N/A', 'Prefer not to say'],
    question_type: 'lane',
    profile_key: 'has_gpa',
  },
  {
    id: 'gpa_value',
    question: 'Enter your current GPA (e.g. 3.21)',
    options: [],
    question_type: 'number',
    profile_key: 'gpa',
    skip_unless: { has_gpa: 'Yes, I have a GPA' },
  },
  {
    id: 'subjects',
    question: 'What are you mainly studying right now?',
    options: ['Core modules', 'Electives', 'Mixed subjects', 'Exam prep'],
    question_type: 'lane',
    profile_key: 'current_subjects',
  },
  {
    id: 'study_pattern',
    question: 'When do you usually study?',
    options: ['Morning', 'Afternoon', 'Evening', 'Late night'],
    question_type: 'lane',
    profile_key: 'study_pattern',
  },
  {
    id: 'confidence',
    question: 'How confident do you feel academically?',
    options: ['Still building', 'Fairly confident', 'Very confident', 'It varies'],
    question_type: 'lane',
    profile_key: 'academic_confidence',
  },
  {
    id: 'extracurricular',
    question: 'Are you involved in extracurricular activities?',
    options: ['Sports', 'Clubs / societies', 'Both', 'Not currently'],
    question_type: 'lane',
    profile_key: 'extracurricular',
  },
];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { profile: {}, answered: [], completed: false };
  } catch {
    return { profile: {}, answered: [], completed: false };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function shouldSkip(step, profile) {
  if (!step.skip_unless) return false;
  return Object.entries(step.skip_unless).some(([k, v]) => profile[k] !== v);
}

export function getLocalFirstJourneyStatus() {
  const state = loadState();
  if (state.completed) return { completed: true, profile: state.profile };

  const answeredIds = state.answered.map((a) => a.question_id);
  const next = FIRST_JOURNEY_STEPS.find(
    (s) => !answeredIds.includes(s.id) && !shouldSkip(s, state.profile),
  );

  if (!next) {
    state.completed = true;
    saveState(state);
    return { completed: true, profile: state.profile };
  }

  return {
    completed: false,
    question_id: next.id,
    question: next.question,
    options: next.options,
    question_type: next.question_type,
    profile: state.profile,
  };
}

export function answerLocalFirstJourney(questionId, answer) {
  const state = loadState();
  const step = FIRST_JOURNEY_STEPS.find((s) => s.id === questionId);
  if (!step) throw new Error('Invalid question');

  const key = step.profile_key || step.id;
  if (step.question_type === 'number') {
    state.profile[key] = parseFloat(answer) || null;
  } else if (step.id === 'has_gpa') {
    state.profile[key] = answer;
    state.profile.gpa_available = answer === 'Yes, I have a GPA';
    if (answer !== 'Yes, I have a GPA') state.profile.gpa = null;
  } else {
    state.profile[key] = answer;
  }

  state.answered.push({ question_id: questionId, answer });
  saveState(state);
  return getLocalFirstJourneyStatus();
}

export function resetLocalFirstJourney() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isLocalFirstJourneyComplete() {
  return loadState().completed;
}

export function getLocalFirstJourneyProgress() {
  const state = loadState();
  const applicable = FIRST_JOURNEY_STEPS.filter(
    (s) => !shouldSkip(s, state.profile),
  );
  return {
    answered: state.answered.length,
    total: applicable.length,
    completed: state.completed,
  };
}
