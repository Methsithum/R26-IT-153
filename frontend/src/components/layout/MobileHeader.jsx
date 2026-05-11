const MobileHeader = ({ sidebarOpen, setSidebarOpen, studentName }) => {
  return (
    <div className="sticky top-0 z-30 border-b border-white/70 bg-white/72 px-4 py-3 backdrop-blur-2xl lg:hidden">
      <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/80 bg-white/90 px-3 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800"
        >
          ☰
        </button>
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-indigo-200/60">
            SU
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">Smart Uni Guide</p>
            <p className="truncate text-xs text-slate-500">{studentName}</p>
          </div>
        </div>
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 ring-1 ring-white/80" />
      </div>
    </div>
  )
}

export default MobileHeader