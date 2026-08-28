import React from "react";

export default function FocusFooter() {
  return (
    <footer className="max-w-7xl mx-auto px-4 py-8 mt-4 border-t border-slate-200/70">
      <div className="flex flex-wrap justify-between items-center gap-3 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span>🌱</span>
          <span className="font-semibold text-slate-600">FocusForest</span>
          <span className="text-slate-400">© {new Date().getFullYear()}</span>
        </div>
        <p className="text-xs text-slate-400">
          Figures reflect the current session only — nothing is stored between visits.
        </p>
      </div>
    </footer>
  );
}
