import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock3, ListTodo } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BadgeDisplay } from '../components/gamification/BadgeDisplay'
import { LevelBadge } from '../components/gamification/LevelBadge'
import { StreakCounter } from '../components/gamification/StreakCounter'
import { XPBar } from '../components/gamification/XPBar'
import { getStudentProfile } from '../services/api'

export default function HomePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStudentProfile('stu-001')
      .then((data) => setProfile(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <HomeSkeleton />
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-16 lg:pb-0">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <h1 className="font-cinzel text-3xl text-amber-200">Welcome back, {profile.name.split(' ')[0]}</h1>
        <p className="mt-2 text-sm text-slate-300">Ready to continue your academic quest journey?</p>
      </section>

      <section className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <LevelBadge level={profile.level} />
        </div>
        <div className="space-y-4">
          <XPBar level={profile.level} currentXp={profile.xp} nextLevelXp={profile.xpToNextLevel} />
          <StreakCounter streak={profile.streak} />
        </div>
      </section>

      <section className="flex justify-center">
        <button
          type="button"
          onClick={() => navigate('/journal')}
          className="animate-pulse rounded-2xl bg-linear-to-r from-amber-500 to-yellow-300 px-8 py-4 font-cinzel text-lg text-slate-950 shadow-[0_0_34px_rgba(250,204,21,0.4)] transition hover:scale-105"
        >
          Start Today&apos;s Quest
        </button>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 font-cinzel text-lg text-amber-200">Recently Earned Badges</h3>
        <BadgeDisplay badges={profile.badges} />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-amber-500/20 bg-slate-900/60 p-4 shadow-[0_0_20px_rgba(250,204,21,0.08)]">
          <div className="mb-2 flex items-center gap-2 text-amber-200">
            <Clock3 className="h-4 w-4" />
            <h4 className="font-cinzel">Study Hours This Week</h4>
          </div>
          <p className="text-2xl font-semibold text-slate-100">{profile.quickStats.studyHoursThisWeek} hours</p>
        </article>

        <article className="rounded-2xl border border-amber-500/20 bg-slate-900/60 p-4 shadow-[0_0_20px_rgba(250,204,21,0.08)]">
          <div className="mb-2 flex items-center gap-2 text-amber-200">
            <ListTodo className="h-4 w-4" />
            <h4 className="font-cinzel">Pending Tasks</h4>
          </div>
          <p className="text-2xl font-semibold text-slate-100">{profile.quickStats.pendingTasks} tasks</p>
        </article>
      </section>
    </motion.div>
  )
}

function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-800" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-800" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-800" />
      </div>
      <div className="h-20 animate-pulse rounded-2xl bg-slate-800" />
    </div>
  )
}
