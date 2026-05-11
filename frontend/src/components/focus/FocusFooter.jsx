import React from "react";

export default function FocusFooter() {
  return (
    <footer className="max-w-7xl mx-auto px-4 py-6 text-slate-500 text-sm">
      <div className="flex justify-between items-center">
        <div>FocusForest © {new Date().getFullYear()}</div>
        <div>Built with ❤️</div>
      </div>
    </footer>
  );
}
