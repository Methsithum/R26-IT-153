const MobileHeader = ({ sidebarOpen, setSidebarOpen, studentName }) => {
  return (
    <div className="sticky top-0 z-30 border-b border-white/60 bg-white/80 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          ☰
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-md">
            SU
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Smart Uni Guide</p>
            <p className="text-xs text-slate-500">{studentName}</p>
          </div>
        </div>
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300" />
      </div>
    </div>
  )
}

export default MobileHeader