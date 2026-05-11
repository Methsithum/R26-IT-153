import { useCallback, useMemo, useState } from 'react'
import { AnalyticsView, DashboardView, ProfileView, SettingsView, StudyPlannerView, TasksView } from '../components/dashboard/DashboardViews.jsx'
import MobileHeader from '../components/layout/MobileHeader.jsx'
import Sidebar from '../components/layout/Sidebar.jsx'
import { getGreeting, getTodayIso, initialTasks, modules, studentData, weeklySchedule } from '../data/dashboardData.js'

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tasks, setTasks] = useState(initialTasks)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showRescheduleModal, setShowRescheduleModal] = useState(null)

  const greeting = useMemo(() => getGreeting(), [])
  const todayIso = getTodayIso()

  const completedTasks = useMemo(() => tasks.filter((task) => task.completed).length, [tasks])
  const totalTasks = tasks.length
  const pendingTasks = tasks.filter((task) => !task.completed)
  const highPriorityPending = pendingTasks.filter((task) => task.priority === 'high').length
  const upcomingDeadlines = pendingTasks.filter((task) => {
    const diffDays = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= 5
  }).length
  const weeklyStudyHours = modules.reduce((total, module) => total + module.studyHours, 0)
  const todayTasks = tasks.filter((task) => task.deadline === todayIso && !task.completed)
  const missedTasks = tasks.filter((task) => task.deadline < todayIso && !task.completed)

  const toggleTask = useCallback((taskId) => {
    setTasks((currentTasks) => currentTasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)))
  }, [])

  const rescheduleTask = useCallback((taskId, newDate) => {
    setTasks((currentTasks) => currentTasks.map((task) => (task.id === taskId ? { ...task, deadline: newDate, completed: false } : task)))
    setShowRescheduleModal(null)
  }, [])

  const renderView = () => {
    if (activeTab === 'planner') return <StudyPlannerView weeklySchedule={weeklySchedule} missedTasks={missedTasks} rescheduleTask={rescheduleTask} showRescheduleModal={showRescheduleModal} setShowRescheduleModal={setShowRescheduleModal} />
    if (activeTab === 'tasks') return <TasksView tasks={tasks} toggleTask={toggleTask} completedTasks={completedTasks} totalTasks={totalTasks} missedTasks={missedTasks} rescheduleTask={rescheduleTask} showRescheduleModal={showRescheduleModal} setShowRescheduleModal={setShowRescheduleModal} />
    if (activeTab === 'analytics') return <AnalyticsView modules={modules} studentData={studentData} weeklyStudyHours={weeklyStudyHours} />
    if (activeTab === 'profile') return <ProfileView studentData={studentData} modules={modules} />
    if (activeTab === 'settings') return <SettingsView />

    return (
      <DashboardView
        greeting={greeting}
        studentData={studentData}
        modules={modules}
        completedTasks={completedTasks}
        totalTasks={totalTasks}
        upcomingDeadlines={upcomingDeadlines}
        weeklyStudyHours={weeklyStudyHours}
        highPriorityPending={highPriorityPending}
        todayTasks={todayTasks}
      />
    )
  }

  return (
    <div className="min-h-screen">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} studentData={studentData} pendingTasks={pendingTasks.length} highPriorityPending={highPriorityPending} />

      <div className="min-h-screen transition-all duration-300 lg:ml-72">
        <MobileHeader sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} studentName={studentData.name} />

        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {renderView()}
        </main>
      </div>
    </div>
  )
}

export default DashboardPage