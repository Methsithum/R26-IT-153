import { AnimatePresence, motion } from "framer-motion";

export const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function daysInMonth(monthIndex, year) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function isoDate(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function prettyDate(year, monthIndex, day) {
  return `${MONTHS_FULL[monthIndex]} ${day}, ${year}`;
}

export const blotterStyle = {
  backgroundColor: "#c4a574",
  backgroundImage:
    "radial-gradient(rgba(90,50,20,0.18) 1px, transparent 1px), radial-gradient(rgba(90,50,20,0.1) 1px, transparent 1px)",
  backgroundSize: "10px 10px, 18px 18px",
  backgroundPosition: "0 0, 4px 8px",
};

export function WoodDayGrid({ year, monthIndex, today, selectedDays, onPick }) {
  const total = daysInMonth(monthIndex, year);
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const selected = selectedDays instanceof Set ? selectedDays : new Set(selectedDays || []);

  return (
    <div className="rounded-2xl border border-amber-950/15 bg-[#f4efe4] p-3 shadow-inner sm:p-4">
      <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-950/50">
        {MONTHS_FULL[monthIndex]} {year}
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
          const active = selected.has(value);
          const isToday =
            today &&
            value === today.getDate() &&
            monthIndex === today.getMonth() &&
            year === today.getFullYear();
          return (
            <motion.button
              key={value}
              type="button"
              onClick={() => onPick(value)}
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
                  : { backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.35), transparent 55%)" }
              }
            >
              {value}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthShift({ year, monthIndex, onShift }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <button
        type="button"
        onClick={() => onShift(-1)}
        className="rounded-full border border-amber-900/15 bg-[#fff7ed] px-3 py-1 text-amber-900/70 shadow-sm hover:bg-white"
      >
        ‹
      </button>
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-950/55">
        {MONTHS_FULL[monthIndex]} {year}
      </div>
      <button
        type="button"
        onClick={() => onShift(1)}
        className="rounded-full border border-amber-900/15 bg-[#fff7ed] px-3 py-1 text-amber-900/70 shadow-sm hover:bg-white"
      >
        ›
      </button>
    </div>
  );
}

export function InkStamp({ show, text = "Due" }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 1.7, opacity: 0, rotate: -28 }}
          animate={{ scale: 1, opacity: 1, rotate: -14 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="pointer-events-none absolute right-3 top-2 flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-red-800/80 text-[10px] font-black uppercase tracking-[0.18em] text-red-800/80"
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function StampPress({ disabled, stamping, idleLabel = "Stamp", doneLabel = "Stamped", onClick }) {
  return (
    <motion.button
      type="button"
      disabled={disabled || stamping}
      onClick={onClick}
      whileHover={stamping ? undefined : { y: -3 }}
      whileTap={stamping ? undefined : { y: 8, scale: 0.97 }}
      className="flex w-[108px] shrink-0 flex-col items-center justify-center rounded-2xl border border-amber-200/20 bg-gradient-to-b from-amber-700 to-amber-950 px-2 py-2 text-amber-50 shadow-lg disabled:opacity-50"
    >
      <span className="mb-1 h-3 w-10 rounded-full bg-stone-300/80 shadow-inner" />
      <span className="h-8 w-14 rounded-md bg-red-900/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
      <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
        {stamping ? doneLabel : idleLabel}
      </span>
    </motion.button>
  );
}

export function PaperSlip({ kicker, title, body, stamped, stampText }) {
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-amber-100/20 bg-[#fff7ed] px-4 py-3 shadow-inner">
      {kicker && (
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-800/55">{kicker}</div>
      )}
      {title && <div className="mt-1 truncate text-sm font-semibold text-stone-800">{title}</div>}
      {body && <div className="mt-1 font-serif text-xl tracking-wide text-stone-900">{body}</div>}
      <InkStamp show={stamped} text={stampText} />
    </div>
  );
}
