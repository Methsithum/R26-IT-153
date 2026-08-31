import { useEffect, useState } from "react";

function formatClock(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Purely atmospheric — a subtle "in-campus time" readout, ticking a bit
// faster than real time so a session feels like part of a school day.
export default function CampusClock() {
  const [campusTime, setCampusTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 15, 0, 0);
    return d;
  });

  useEffect(() => {
    const id = setInterval(() => {
      setCampusTime((prev) => new Date(prev.getTime() + 30_000));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-none rounded-xl border border-slate-300/15 bg-slate-900/55 backdrop-blur-md px-3 py-2 text-right">
      <div className="text-[9px] uppercase tracking-wide text-slate-400">Campus Time</div>
      <div className="text-sm font-semibold text-slate-100 tabular-nums">{formatClock(campusTime)}</div>
    </div>
  );
}
