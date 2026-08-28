export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="card flex flex-col items-center justify-center text-center py-12 px-6">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center mb-3">
          <Icon size={26} className="text-brand-400" />
        </div>
      )}
      <p className="font-semibold text-slate-700 dark:text-white">{title}</p>
      {subtitle && <p className="text-sm text-slate-400 mt-1 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
