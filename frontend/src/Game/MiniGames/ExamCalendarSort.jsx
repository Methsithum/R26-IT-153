import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { play } from "../audio/sfx";
import { blotterStyle, isoDate, MonthShift, PaperSlip, StampPress, WoodDayGrid } from "./woodDesk";

function examLabel(exam) {
  const kind = String(exam.examType || exam.exam_type || "").replace(/^\w/, (c) => c.toUpperCase());
  return { title: exam.subject, badge: kind || "Exam" };
}

function hashName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function prettyIso(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]} ${year}`;
}

export default function ExamCalendarSort({ question, onComplete }) {
  const missing = useMemo(
    () => question?.context?.missingExams || question?.missingExams || [],
    [question]
  );
  const today = useMemo(() => new Date(), []);
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [activeId, setActiveId] = useState(missing[0]?.id || null);
  const [assigned, setAssigned] = useState({});
  const [stamping, setStamping] = useState(false);

  useEffect(() => {
    if (!activeId && missing[0]?.id) setActiveId(missing[0].id);
  }, [missing, activeId]);

  const stampedCount = missing.filter((exam) => assigned[exam.id]).length;
  const leftoverCount = missing.length - stampedCount;
  const canConfirm = stampedCount > 0;
  const activeExam = missing.find((exam) => exam.id === activeId) || missing[0];
  const activeMeta = activeExam ? examLabel(activeExam) : null;
  const selectedDays = new Set(
    Object.values(assigned)
      .filter((iso) => iso && iso.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}`))
      .map((iso) => Number(iso.slice(8, 10)))
  );

  function shiftMonth(delta) {
    play("click");
    const next = new Date(year, monthIndex + delta, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
  }

  function stampDay(dayNumber) {
    if (!activeExam) return;
    const iso = isoDate(year, monthIndex, dayNumber);
    play("stamp");
    if (assigned[activeExam.id] === iso) {
      const nextAssigned = { ...assigned };
      delete nextAssigned[activeExam.id];
      setAssigned(nextAssigned);
      return;
    }
    const nextAssigned = { ...assigned, [activeExam.id]: iso };
    setAssigned(nextAssigned);
    const upcoming = missing.find((exam) => exam.id !== activeExam.id && !nextAssigned[exam.id]);
    if (upcoming) setActiveId(upcoming.id);
  }

  function confirm() {
    if (!canConfirm || stamping) return;
    setStamping(true);
    play("stamp");
    window.setTimeout(() => onComplete(assigned), 520);
  }

  if (missing.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-stone-500">
        All exam dates for your subjects are already recorded.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">Exam hall</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Missing exam dates</h2>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Pin a paper, stamp its day. Leave blank any date that is not out yet.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(200px,0.85fr)_1.35fr]">
        <div className="min-h-0 overflow-y-auto rounded-3xl p-3" style={blotterStyle}>
          <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-950/55">
            Papers
          </div>
          <div className="flex flex-col gap-3">
            {missing.map((exam) => {
              const meta = examLabel(exam);
              const active = exam.id === activeExam?.id;
              const date = assigned[exam.id];
              const tilt = ((hashName(exam.id) % 7) - 3) * 1.6;
              return (
                <motion.button
                  key={exam.id}
                  type="button"
                  onClick={() => setActiveId(exam.id)}
                  animate={{ rotate: active ? 0 : tilt, y: active ? -4 : 0 }}
                  className="relative rounded-sm border border-amber-900/15 bg-[#fff7ed] px-3 py-3 text-left shadow-md"
                >
                  <span className="absolute left-3 top-2 h-2 w-2 rounded-full bg-red-800/80 shadow" />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800/60">{meta.badge}</div>
                  <div className="mt-1 pr-8 text-sm font-semibold text-stone-800">{meta.title}</div>
                  <div className="mt-2 text-[11px] text-stone-500">{prettyIso(date) || "Not released yet"}</div>
                  {date && (
                    <span className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-red-800/80 text-[8px] font-black uppercase tracking-wider text-red-800/80 -rotate-12">
                      Set
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div
          className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-amber-900/20 p-3 sm:p-4"
          style={blotterStyle}
        >
          <MonthShift year={year} monthIndex={monthIndex} onShift={shiftMonth} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <WoodDayGrid
              year={year}
              monthIndex={monthIndex}
              today={today}
              selectedDays={selectedDays}
              onPick={stampDay}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-stretch gap-3 rounded-2xl bg-[#2c1810] p-3">
        <PaperSlip
          kicker="Notice board"
          title={activeMeta ? `${activeMeta.title} · ${activeMeta.badge}` : "Pick a paper"}
          body={prettyIso(assigned[activeExam?.id]) || "Stamp a day, or leave it blank"}
          stamped={stamping}
          stampText="Set"
        />
        <StampPress disabled={!canConfirm} stamping={stamping} onClick={confirm} idleLabel="Save" />
      </div>
      {leftoverCount > 0 && canConfirm && (
        <p className="mt-2 text-center text-xs text-stone-500">
          {stampedCount} stamped · {leftoverCount} still waiting
        </p>
      )}
    </div>
  );
}
