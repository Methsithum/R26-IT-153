import axios from 'axios'
import { addDays, format } from 'date-fns'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 10000,
})

const delay = (payload, ms = 800) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(payload), ms)
  })

const BADGES = [
  { id: 'starter', name: 'Starter Scribe', icon: 'Scroll', condition: 'Complete your first daily quest', earned: true },
  { id: 'streak3', name: '3-Day Flame', icon: 'Flame', condition: 'Maintain a 3-day streak', earned: true },
  { id: 'focus', name: 'Focus Scholar', icon: 'Target', condition: 'Log 10 focused study sessions', earned: true },
  { id: 'reflection', name: 'Weekly Sage', icon: 'BookOpen', condition: 'Submit 4 weekly reflections', earned: false },
  { id: 'mentor', name: 'Peer Mentor', icon: 'Users', condition: 'Track 8 collaboration activities', earned: false },
  { id: 'legend', name: 'Semester Legend', icon: 'Crown', condition: 'Complete all semester reflections', earned: false },
]

const ACTIVITY_CATALOG = [
  { id: 'study_lecture', label: 'Studying Lecture Notes', category: 'Academic', icon: 'BookOpen' },
  { id: 'assignment', label: 'Working on Assignment', category: 'Academic', icon: 'ClipboardList' },
  { id: 'project_dev', label: 'Project Development', category: 'Academic', icon: 'Rocket' },
  { id: 'exam_prep', label: 'Exam Preparation', category: 'Academic', icon: 'GraduationCap' },
  { id: 'lab_work', label: 'Lab Work', category: 'Academic', icon: 'FlaskConical' },
  { id: 'intern_apply', label: 'Internship Application', category: 'Internship', icon: 'Send' },
  { id: 'interview_prep', label: 'Interview Preparation', category: 'Internship', icon: 'Briefcase' },
  { id: 'intern_work', label: 'Internship Work', category: 'Internship', icon: 'Building2' },
  { id: 'sports', label: 'Sports Practice', category: 'Extra-Curricular', icon: 'Dumbbell' },
  { id: 'club', label: 'Club Meeting', category: 'Extra-Curricular', icon: 'Users' },
  { id: 'cultural', label: 'Cultural Event', category: 'Extra-Curricular', icon: 'Music2' },
  { id: 'community', label: 'Community Service', category: 'Extra-Curricular', icon: 'HeartHandshake' },
]

const BASE_QUESTIONS = [
  {
    id: 'q_duration',
    text: 'How much time did you spend on your most important task today?',
    type: 'duration_picker',
  },
  {
    id: 'q_subject',
    text: 'Which subjects or modules did you focus on?',
    type: 'multi_select',
    options: ['AI and ML', 'Database Systems', 'Software Engineering', 'Computer Networks'],
  },
  {
    id: 'q_progress',
    text: 'Select the current progress stage of your primary academic task.',
    type: 'progress_select',
    options: ['Not started', 'In progress', 'Report completed', 'Viva pending', 'Completed'],
  },
  {
    id: 'q_deadline',
    text: 'How close is your nearest deadline?',
    type: 'single_select',
    options: ['Within 24 hours', 'Within 3 days', 'Within 1 week', 'No urgent deadline'],
  },
  {
    id: 'q_note',
    text: 'Write a short note on your biggest challenge today.',
    type: 'text_input',
    placeholder: 'Example: Had trouble balancing assignment and club work.',
  },
]

const INTERNSHIP_QUESTION = {
  id: 'q_internship',
  text: 'What is your internship pipeline status?',
  type: 'single_select',
  options: ['Searching', 'Applied', 'Interview scheduled', 'Offer received'],
}

function buildQuestionSet(selectedActivities = []) {
  const hasInternship = selectedActivities.some((item) => item.category === 'Internship')
  return hasInternship ? [...BASE_QUESTIONS, INTERNSHIP_QUESTION] : BASE_QUESTIONS
}

export async function getNextQuestion(studentId, currentState) {
  try {
    const selectedActivities = currentState?.selectedActivities || []
    const askedIds = new Set((currentState?.questionHistory || []).map((q) => q.questionId))
    const questions = buildQuestionSet(selectedActivities)
    const next = questions.find((question) => !askedIds.has(question.id))

    if (!next) {
      return await delay({ hasMore: false, sessionComplete: true, totalQuestions: questions.length })
    }

    return await delay({ hasMore: true, totalQuestions: questions.length, question: next })
  } catch (error) {
    throw new Error(error?.message || 'Failed to fetch next question')
  }
}

export async function submitAnswer(studentId, questionId, answer) {
  try {
    return await delay({
      success: true,
      questionId,
      answer,
      xpGain: 10,
      message: 'Answer recorded successfully',
    })
  } catch (error) {
    throw new Error(error?.message || 'Failed to submit answer')
  }
}

export async function getDailyJournal(studentId, date) {
  try {
    return await delay({
      journalText:
        'Today you balanced core academic commitments with personal development activities. Your tracked progress shows meaningful movement on key tasks while maintaining consistency in daily engagement.',
      xpEarnedToday: 50,
      newBadges: [{ id: 'quest_complete', name: 'Quest Finisher', icon: 'Award', condition: 'Complete a full daily flow' }],
      date,
    })
  } catch (error) {
    throw new Error(error?.message || 'Failed to fetch daily journal')
  }
}

export async function getWeeklyReflection(studentId) {
  try {
    return await delay({
      questions: [
        { id: 'wr1', prompt: 'Which study strategy worked best this week?', maxLength: 220 },
        { id: 'wr2', prompt: 'What major obstacle reduced your productivity?', maxLength: 220 },
        { id: 'wr3', prompt: 'How will you improve next week?', maxLength: 220 },
      ],
    })
  } catch (error) {
    throw new Error(error?.message || 'Failed to load weekly reflection questions')
  }
}

export async function submitReflection(studentId, type, responses) {
  try {
    return await delay({
      success: true,
      type,
      responses,
      message: 'Reflection submitted successfully',
    })
  } catch (error) {
    throw new Error(error?.message || 'Failed to submit reflection')
  }
}

export async function getStudentProfile(studentId) {
  try {
    return await delay({
      studentId,
      name: 'Ashan Jayasinghe',
      program: 'BSc (Hons) in Information Technology',
      level: 7,
      xp: 740,
      xpToNextLevel: 1000,
      streak: 9,
      badges: BADGES.filter((badge) => badge.earned),
      allBadges: BADGES,
      quickStats: {
        studyHoursThisWeek: 18,
        pendingTasks: 4,
      },
      stats: {
        totalJournalDays: 62,
        totalStudyHours: 211,
        totalTasksCompleted: 47,
        longestStreak: 14,
      },
      activityCatalog: ACTIVITY_CATALOG,
    })
  } catch (error) {
    throw new Error(error?.message || 'Failed to load student profile')
  }
}

export async function getDashboardData(studentId) {
  try {
    const weekStart = new Date()
    const streakCalendar = Array.from({ length: 7 }, (_, index) => {
      const current = addDays(weekStart, index - 6)
      return {
        day: format(current, 'EEE'),
        completed: index !== 2,
      }
    })

    return await delay({
      weeklyStudyHours: [
        { day: 'Mon', hours: 2 },
        { day: 'Tue', hours: 3 },
        { day: 'Wed', hours: 2.5 },
        { day: 'Thu', hours: 4 },
        { day: 'Fri', hours: 3.5 },
        { day: 'Sat', hours: 2 },
        { day: 'Sun', hours: 1.5 },
      ],
      activityBreakdown: [
        { name: 'Academic', value: 58 },
        { name: 'Internship', value: 22 },
        { name: 'Extra-Curricular', value: 20 },
      ],
      taskProgress: [
        {
          id: 'task1',
          name: 'ML Mini Project',
          subject: 'AI and ML',
          deadline: '2026-04-24',
          stages: ['Not started', 'In progress', 'Report completed', 'Viva pending', 'Completed'],
          currentStage: 2,
        },
        {
          id: 'task2',
          name: 'DBMS Assignment',
          subject: 'Database Systems',
          deadline: '2026-04-22',
          stages: ['Not started', 'In progress', 'Completed'],
          currentStage: 1,
        },
      ],
      weeklyStats: {
        completionRate: 84,
        averageSessionLength: 18,
      },
      streakCalendar,
    })
  } catch (error) {
    throw new Error(error?.message || 'Failed to load dashboard data')
  }
}

export async function getActivityCatalog(studentId) {
  try {
    return await delay({ activities: ACTIVITY_CATALOG })
  } catch (error) {
    throw new Error(error?.message || 'Failed to load activity catalog')
  }
}

export { api }
