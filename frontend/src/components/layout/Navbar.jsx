import { format } from 'date-fns'

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 mb-4 flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/80 p-4 backdrop-blur">
      <div>
        <h2 className="font-cinzel text-lg text-amber-200">Student Journal Command Deck</h2>
        <p className="text-xs text-slate-400">AI-guided daily academic tracking</p>
      </div>
      <p className="text-sm text-slate-300">{format(new Date(), 'EEEE, MMM d')}</p>
    </header>
  )
}
