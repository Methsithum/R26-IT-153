import { motion, AnimatePresence } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { getBuildingById } from "../data/buildings";
import CalendarStamp from "../MiniGames/CalendarStamp";
import GradeSlider from "../MiniGames/GradeSlider";
import ExamCalendarSort from "../MiniGames/ExamCalendarSort";

function MiniGameSlot({ activeQuestion, onComplete }) {
  const props = { question: activeQuestion, onComplete };
  const type = activeQuestion?.interactionType;

  if (type === "date") return <CalendarStamp {...props} />;
  if (type === "marks") return <GradeSlider {...props} />;
  if (type === "examDate") return <ExamCalendarSort {...props} />;
  return <CalendarStamp {...props} />;
}

export default function SpecialInteractionRouter() {
  const phase = useGameStore((s) => s.phase);
  const activeQuestion = useGameStore((s) => s.activeQuestion);
  const targetBuildingId = useGameStore((s) => s.targetBuildingId);

  const active = phase === PHASES.SPECIAL_INTERACTION_ACTIVE;
  const completed = phase === PHASES.SPECIAL_INTERACTION_COMPLETED;
  if (!active && !completed) return null;

  const building = getBuildingById(targetBuildingId);
  const subject = activeQuestion?.subject || activeQuestion?.context?.subject;
  const type = activeQuestion?.interactionType ?? "academic";

  function handleComplete(value) {
    useGameStore.getState().completeSpecialInteraction({ completed: true, value });
  }

  return (
    <AnimatePresence>
      <motion.div
        key="building-room"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="pointer-events-auto absolute inset-0 z-40 flex flex-col bg-[#f7f1e6]"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.85), transparent 42%), radial-gradient(ellipse at 80% 100%, rgba(146,64,14,0.08), transparent 46%)",
          }}
        />
        <header className="relative flex items-center justify-between border-b border-stone-300/70 px-5 py-4 sm:px-8">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-stone-500">
              {building?.name ?? "Campus building"}
            </div>
            <div className="mt-1 text-sm text-stone-700">
              {subject ? `${subject} · ${type}` : "Special interaction"}
            </div>
          </div>
          <div className="rounded-full bg-white/80 px-3 py-1 text-xs text-stone-500 shadow-sm">
            Inside the building
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 p-4 sm:p-8">
          {completed ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="rounded-3xl border border-emerald-200 bg-white px-10 py-8 text-center shadow-sm">
                <div className="text-emerald-700 text-lg font-semibold">Saved to your journal</div>
                {subject && <div className="mt-2 text-sm text-stone-500">{subject}</div>}
              </div>
            </div>
          ) : (
            <div className="mx-auto h-full w-full max-w-5xl">
              <MiniGameSlot activeQuestion={activeQuestion} onComplete={handleComplete} />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
