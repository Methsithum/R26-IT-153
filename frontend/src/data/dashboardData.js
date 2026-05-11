export const studentData = {
  name: 'Alex Johnson',
  id: 'STU-2024-0891',
  program: 'BSc Computer Science',
  year: 3,
  semester: 2,
  gpa: 3.72,
  totalCredits: 18,
  completedCredits: 12,
  weeklyStudyGoal: 35,
}

export const modules = [
  { id: 1, name: 'Data Structures & Algorithms', code: 'CS301', grade: 88, predictedGrade: 91, credits: 4, color: '#6366f1', studyHours: 10, weakArea: false },
  { id: 2, name: 'Machine Learning Fundamentals', code: 'CS355', grade: 76, predictedGrade: 80, credits: 4, color: '#8b5cf6', studyHours: 8, weakArea: true },
  { id: 3, name: 'Web Development', code: 'CS280', grade: 92, predictedGrade: 94, credits: 3, color: '#06b6d4', studyHours: 6, weakArea: false },
  { id: 4, name: 'Database Systems', code: 'CS320', grade: 70, predictedGrade: 74, credits: 4, color: '#f59e0b', studyHours: 7, weakArea: true },
  { id: 5, name: 'AI Ethics & Society', code: 'CS390', grade: 85, predictedGrade: 87, credits: 3, color: '#10b981', studyHours: 4, weakArea: false },
]

export const initialTasks = [
  { id: 1, moduleName: 'Data Structures & Algorithms', moduleCode: 'CS301', task: 'Complete Binary Trees Lab', deadline: '2026-05-13', priority: 'high', completed: false, type: 'assignment' },
  { id: 2, moduleName: 'Machine Learning Fundamentals', moduleCode: 'CS355', task: 'Submit Neural Network Report', deadline: '2026-05-14', priority: 'high', completed: false, type: 'report' },
  { id: 3, moduleName: 'Web Development', moduleCode: 'CS280', task: 'Build REST API Project', deadline: '2026-05-16', priority: 'medium', completed: false, type: 'project' },
  { id: 4, moduleName: 'Database Systems', moduleCode: 'CS320', task: 'Practice SQL Queries', deadline: '2026-05-17', priority: 'medium', completed: false, type: 'practice' },
  { id: 5, moduleName: 'AI Ethics & Society', moduleCode: 'CS390', task: 'Read Chapter 8 - AI Bias', deadline: '2026-05-18', priority: 'low', completed: false, type: 'reading' },
  { id: 6, moduleName: 'Data Structures & Algorithms', moduleCode: 'CS301', task: 'Review AVL Trees', deadline: '2026-05-15', priority: 'medium', completed: false, type: 'review' },
  { id: 7, moduleName: 'Machine Learning Fundamentals', moduleCode: 'CS355', task: 'Watch SVM Tutorial', deadline: '2026-05-12', priority: 'low', completed: true, type: 'video' },
  { id: 8, moduleName: 'Database Systems', moduleCode: 'CS320', task: 'ER Diagram Assignment', deadline: '2026-05-13', priority: 'high', completed: false, type: 'assignment' },
]

export const weeklySchedule = [
  { day: 'Mon', date: 'May 11', sessions: [{ time: '9:00 AM', module: 'Data Structures', duration: '2h', type: 'ai-suggested', priority: 'high', reason: 'Upcoming deadline' }, { time: '2:00 PM', module: 'Machine Learning', duration: '1.5h', type: 'scheduled', priority: 'medium', reason: '' }] },
  { day: 'Tue', date: 'May 12', sessions: [{ time: '10:00 AM', module: 'Database Systems', duration: '2h', type: 'ai-suggested', priority: 'high', reason: 'Weak subject focus' }, { time: '3:00 PM', module: 'Web Development', duration: '1h', type: 'scheduled', priority: 'low', reason: '' }] },
  { day: 'Wed', date: 'May 13', sessions: [{ time: '8:00 AM', module: 'Data Structures', duration: '2.5h', type: 'ai-suggested', priority: 'high', reason: 'Binary Trees Lab due' }, { time: '1:00 PM', module: 'AI Ethics', duration: '1h', type: 'scheduled', priority: 'low', reason: '' }] },
  { day: 'Thu', date: 'May 14', sessions: [{ time: '11:00 AM', module: 'Machine Learning', duration: '2h', type: 'ai-suggested', priority: 'high', reason: 'Neural Network Report' }] },
  { day: 'Fri', date: 'May 15', sessions: [{ time: '9:00 AM', module: 'Data Structures', duration: '1.5h', type: 'scheduled', priority: 'medium', reason: '' }, { time: '2:00 PM', module: 'Database Systems', duration: '2h', type: 'ai-suggested', priority: 'medium', reason: 'ER Diagram due' }] },
  { day: 'Sat', date: 'May 16', sessions: [{ time: '10:00 AM', module: 'Web Development', duration: '3h', type: 'ai-suggested', priority: 'medium', reason: 'REST API Project' }] },
  { day: 'Sun', date: 'May 17', sessions: [{ time: '4:00 PM', module: 'Database Systems', duration: '1.5h', type: 'scheduled', priority: 'low', reason: '' }] },
]

export const priorityConfig = {
  high: { label: 'High Priority', accent: 'text-red-600', chip: 'bg-red-100 text-red-700', ring: 'ring-red-200', dot: 'bg-red-500' },
  medium: { label: 'Medium Priority', accent: 'text-amber-600', chip: 'bg-amber-100 text-amber-700', ring: 'ring-amber-200', dot: 'bg-amber-500' },
  low: { label: 'Low Priority', accent: 'text-emerald-600', chip: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
}

export const navItems = [
  { id: 'dashboard', label: 'Dashboard', badge: null },
  { id: 'planner', label: 'Study Planner', badge: null },
  { id: 'tasks', label: 'Tasks', badge: 'count' },
  { id: 'analytics', label: 'Analytics', badge: null },
  { id: 'profile', label: 'Profile', badge: null },
  { id: 'settings', label: 'Settings', badge: null },
]

export const getGreeting = () => {
  const hour = new Date().getHours()

  if (hour < 12) return { text: 'Good Morning', emoji: 'Morning', sub: 'Ready to push your goals forward today?' }
  if (hour < 17) return { text: 'Good Afternoon', emoji: 'Afternoon', sub: 'Keep the momentum going.' }
  if (hour < 21) return { text: 'Good Evening', emoji: 'Evening', sub: 'Finish the day strong.' }
  return { text: 'Good Night', emoji: 'Night', sub: 'Late session? Stay focused and pace yourself.' }
}

export const getTodayIso = () => new Date().toISOString().split('T')[0]

export const formatDeadline = (deadline) =>
  new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })