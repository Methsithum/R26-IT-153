import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { BookOpenCheck, ChartNoAxesCombined, Home, ScrollText, UserCircle2 } from 'lucide-react'
import { getStudentProfile } from '../../services/api'
import { LevelBadge } from '../gamification/LevelBadge'
import { cn } from '../../utils/helpers'

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/journal', label: 'Journal', icon: BookOpenCheck },
  { to: '/dashboard', label: 'Dashboard', icon: ChartNoAxesCombined },
  { to: '/reflection', label: 'Reflection', icon: ScrollText },
  { to: '/profile', label: 'Profile', icon: UserCircle2 },
]

export function Sidebar() {
  const [level, setLevel] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStudentProfile('stu-001')
      .then((data) => setLevel(data.level))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-amber-500/20 bg-slate-950/95 p-5 lg:flex lg:flex-col">
        <div>
          <h1 className="font-cinzel text-2xl text-amber-300">Smart Uni Guide</h1>
          <p className="mt-1 text-xs text-slate-400">Academic Quest Console</p>
        </div>

        <nav className="mt-8 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm text-slate-300 transition',
                  isActive
                    ? 'border-l-amber-400 bg-amber-500/10 text-amber-200'
                    : 'hover:bg-slate-900 hover:text-slate-100',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-center">
          <p className="mb-2 text-xs uppercase tracking-widest text-slate-400">Current Tier</p>
          {loading ? (
            <div className="mx-auto h-20 w-20 animate-pulse rounded-xl bg-slate-800" />
          ) : (
            <LevelBadge level={level} />
          )}
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t border-amber-500/20 bg-slate-950/95 px-2 py-2 lg:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center rounded-lg px-1 py-2 text-slate-400',
                isActive && 'bg-amber-500/15 text-amber-200',
              )
            }
            aria-label={label}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </NavLink>
        ))}
      </nav>
    </>
  )
}
