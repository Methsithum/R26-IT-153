import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { play } from "../audio/sfx";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const BEAD = ["#b45309", "#7f1d1d", "#9a3412", "#854d0e", "#92400e", "#6b3f22"];

function daysInMonth(monthIndex, year) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function subjectOf(question) {
  return question?.subject || question?.context?.subject || "Today's subject";
}

function isoOf(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function Bead({ label, active, color, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group relative flex w-full flex-col items-center">
      <motion.span
        layout
        animate={{
          y: active ? 10 : 0,
          scale: active ? 1.18 : 1,
        }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-black/25 shadow-[inset_0_2px_3px_rgba(255,255,255,0.28),0_4px_8px_rgba(0,0,0,0.35)] sm:h-9 sm:w-9"
        style={{
          background: active
            ? "radial-gradient(circle at 32% 28%, #fde68a, #d97706 58%, #92400e)"
            : `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35), transparent 42%), ${color}`,
          boxShadow: active
            ? "0 0 0 2px #fde68a, 0 6px 14px rgba(0,0,0,0.4)"
            : undefined,
        }}
      />
      <span
        className={`mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] sm:text-[10px] ${
          active ? "text-amber-100" : "text-amber-100/45"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export default function DeadlineAbacus({ question, onComplete }) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [day, setDay] = useState(today.getDate());
  const [stamping, setStamping] = useState(false);
  const subject = subjectOf(question);

  const years = [today.getFullYear(), today.getFullYear() + 1];
  const total = daysInMonth(month, year);
  const firstWeekday = new Date(year, month, 1).getDay();
  const safeDay = Math.min(day, total);
  const pretty = `${MONTHS_FULL[month]} ${safeDay}, ${year}`;

  function pickMonth(next) {
    play("click");
    setMonth(next);
    setDay((current) => Math.min(current, daysInMonth(next, year)));
  }

  function pickYear(next) {
    play("click");
    setYear(next);
    setDay((current) => Math.min(current, daysInMonth(month, next)));
  }

  function pickDay(next) {
    play("click");
    setDay(next);
  }

  function confirm() {
    if (stamping) return;
    setStamping(true);
    play("stamp");
    const iso = isoOf(year, month, safeDay);
    window.setTimeout(() => onComplete(iso), 720);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Deadline desk
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Slide a month bead, tap the day, then stamp the due slip."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-amber-900/25 shadow-[0_18px_40px_rgba(40,20,8,0.28)]">
        <div
          className="relative shrink-0 px-4 pb-4 pt-5 sm:px-6"
          style={{
            background: "linear-gradient(180deg, #5a3418 0%, #3f2412 100%)",
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/70">
              Month beads
            </div>
            <div className="flex gap-1 rounded-full border border-amber-200/15 bg-black/20 p-1">
              {years.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => pickYear(item)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors ${
                    item === year
                      ? "bg-amber-200 text-amber-950"
                      : "text-amber-100/70 hover:text-amber-50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <div
              className="absolute left-2 right-2 top-[16px] h-[7px] rounded-full sm:top-[18px]"
              style={{
                background: "linear-gradient(180deg, #f3e2b8, #b08d57 45%, #e8d5a3)",
                boxShadow: "0 2px 0 rgba(0,0,0,0.35)",
              }}
            />
            <div className="relative grid grid-cols-12 gap-0.5">
              {MONTHS.map((label, index) => (
                <Bead
                  key={label}
                  label={label}
                  active={index === month}
                  color={BEAD[index % BEAD.length]}
                  onClick={() => pickMonth(index)}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          className="relative min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6"
          style={{
            backgroundColor: "#c4a574",
            backgroundImage:
              "radial-gradient(rgba(90,50,20,0.16) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.12), transparent 28%)",
            backgroundSize: "12px 12px, 100% 100%",
          }}
        >
          <div className="mx-auto max-w-lg rounded-2xl border border-amber-950/15 bg-[#f4efe4] p-3 shadow-inner sm:p-4">
            <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-950/50">
              {MONTHS_FULL[month]} {year}
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAYS.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900/40"
                >
                  {label}
                </div>
              ))}
              {Array.from({ length: firstWeekday }).map((_, index) => (
                <div key={`pad-${index}`} />
              ))}
              {Array.from({ length: total }).map((_, index) => {
                const value = index + 1;
                const active = value === safeDay;
                const isToday =
                  value === today.getDate() &&
                  month === today.getMonth() &&
                  year === today.getFullYear();
                return (
                  <motion.button
                    key={value}
                    type="button"
                    onClick={() => pickDay(value)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.94 }}
                    className={`h-9 rounded-xl text-sm font-semibold shadow-sm sm:h-10 ${
                      active
                        ? "bg-amber-800 text-amber-50"
                        : isToday
                          ? "border border-amber-800/30 bg-amber-100 text-amber-950"
                          : "border border-black/10 bg-[#fff7ed] text-stone-800"
                    }`}
                    style={
                      active
                        ? undefined
                        : {
                            backgroundImage:
                              "linear-gradient(180deg, rgba(255,255,255,0.35), transparent 55%)",
                          }
                    }
                  >
                    {value}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative flex shrink-0 items-stretch gap-3 border-t border-amber-900/20 bg-[#2c1810] px-4 py-4 sm:px-6">
          <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-amber-100/20 bg-[#fff7ed] px-4 py-3 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-800/55">Due slip</div>
            <div className="mt-1 truncate text-sm font-semibold text-stone-800">{subject}</div>
            <div className="mt-1 font-serif text-xl tracking-wide text-stone-900">{pretty}</div>
            <AnimatePresence>
              {stamping && (
                <motion.div
                  initial={{ scale: 1.7, opacity: 0, rotate: -28 }}
                  animate={{ scale: 1, opacity: 1, rotate: -14 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className="pointer-events-none absolute right-3 top-2 flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-red-800/80 text-[10px] font-black uppercase tracking-[0.18em] text-red-800/80"
                >
                  Due
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            type="button"
            disabled={stamping}
            onClick={confirm}
            whileHover={stamping ? undefined : { y: -3 }}
            whileTap={stamping ? undefined : { y: 8, scale: 0.97 }}
            className="flex w-[108px] shrink-0 flex-col items-center justify-center rounded-2xl border border-amber-200/20 bg-gradient-to-b from-amber-700 to-amber-950 px-2 py-2 text-amber-50 shadow-lg disabled:opacity-70"
          >
            <span className="mb-1 h-3 w-10 rounded-full bg-stone-300/80 shadow-inner" />
            <span className="h-8 w-14 rounded-md bg-red-900/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
              {stamping ? "Stamped" : "Stamp"}
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
