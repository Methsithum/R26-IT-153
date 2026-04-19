import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpenCheck, Clock3, Flame, Lock, Target } from 'lucide-react'
import toast from 'react-hot-toast'
import { LevelBadge } from '../components/gamification/LevelBadge'
import { getStudentProfile } from '../services/api'
import { getInitials } from '../utils/helpers'

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStudentProfile('stu-001')
      .then((response) => {
        setProfile(response)
        setName(response.name)
      })
      .catch(() => toast.error('Something went wrong, try again'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-800" />
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pb-16 lg:pb-0">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 text-center">
        <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-yellow-300 text-2xl font-bold text-slate-950">
          {getInitials(profile.name)}
        </div>
        <h1 className="font-cinzel text-2xl text-amber-200">{profile.name}</h1>
        <p className="text-sm text-slate-400">{profile.program}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <LevelBadge level={profile.level} />
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-center">
          <p className="text-sm text-slate-400">Total XP</p>
          <p className="font-cinzel text-2xl text-amber-200">{profile.xp}</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-center">
          <p className="text-sm text-slate-400">Current Streak</p>
          <p className="font-cinzel text-2xl text-amber-200">{profile.streak} days</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 font-cinzel text-lg text-amber-200">Badge Collection</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {profile.allBadges.map((badge) => (
            <div key={badge.id} className="group relative rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-center">
              <div
                className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full ${
                  badge.earned
                    ? 'bg-amber-500/15 text-amber-300 shadow-[0_0_20px_rgba(250,204,21,0.2)]'
                    : 'bg-slate-800 text-slate-500 grayscale opacity-50'
                }`}
              >
                {badge.earned ? '🏅' : <Lock className="h-4 w-4" />}
              </div>
              <p className="text-xs text-slate-300">{badge.name}</p>
              <div className="pointer-events-none absolute -top-1 left-1/2 hidden w-44 -translate-x-1/2 rounded-md border border-amber-500/30 bg-slate-900 px-2 py-1 text-xs text-amber-100 group-hover:block">
                {badge.condition}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={BookOpenCheck} label="Journal Days" value={profile.stats.totalJournalDays} />
        <StatCard icon={Clock3} label="Study Hours" value={profile.stats.totalStudyHours} />
        <StatCard icon={Target} label="Tasks Completed" value={profile.stats.totalTasksCompleted} />
        <StatCard icon={Flame} label="Longest Streak" value={profile.stats.longestStreak} />
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 font-cinzel text-lg text-amber-200">Account Settings</h3>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            toast.success('Display name updated')
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-amber-500/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            type="submit"
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Save Display Name
          </button>
        </form>
      </section>
    </motion.div>
  )
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-amber-200">
        <Icon className="h-4 w-4" />
        <p className="text-xs uppercase tracking-wide">{label}</p>
      </div>
      <p className="font-cinzel text-2xl text-slate-100">{value}</p>
    </article>
  )
}
