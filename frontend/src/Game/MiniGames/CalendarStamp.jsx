import { useMemo, useState } from "react";
import { play } from "../audio/sfx";
import { blotterStyle, daysInMonth, isoDate, MonthShift, PaperSlip, prettyDate, StampPress, WoodDayGrid } from "./woodDesk";

function subjectOf(question) {
  return question?.subject || question?.context?.subject || "Today's subject";
}

export default function CalendarStamp({ question, onComplete }) {
  const today = useMemo(() => new Date(), []);
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [day, setDay] = useState(null);
  const [stamping, setStamping] = useState(false);
  const subject = subjectOf(question);

  function shiftMonth(delta) {
    play("click");
    const next = new Date(year, monthIndex + delta, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
    setDay(null);
  }

  function pickDay(nextDay) {
    if (stamping) return;
    play("click");
    setDay(nextDay);
  }

  function confirm() {
    if (!day || stamping) return;
    setStamping(true);
    play("stamp");
    const iso = isoDate(year, monthIndex, Math.min(day, daysInMonth(monthIndex, year)));
    window.setTimeout(() => onComplete(iso), 720);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">Notice board</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.context?.field === "deadline-check"
            ? `Stamp the deadline for ${subject} on the board.`
            : question?.questionText ?? "Stamp the date on the notice board."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-amber-900/20 shadow-inner">
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6" style={blotterStyle}>
          <MonthShift year={year} monthIndex={monthIndex} onShift={shiftMonth} />
          <div className="mx-auto max-w-lg">
            <WoodDayGrid
              year={year}
              monthIndex={monthIndex}
              today={today}
              selectedDays={day ? [day] : []}
              onPick={pickDay}
            />
          </div>
        </div>

        <div className="flex items-stretch gap-3 bg-[#2c1810] px-4 py-4 sm:px-6">
          <PaperSlip
            kicker="Date slip"
            title={subject}
            body={day ? prettyDate(year, monthIndex, day) : "Tap a day, then stamp"}
            stamped={stamping}
            stampText="Set"
          />
          <StampPress disabled={!day} stamping={stamping} onClick={confirm} />
        </div>
      </div>
    </div>
  );
}
