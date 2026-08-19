import { motion, AnimatePresence } from "framer-motion";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { getBuildingById } from "../data/buildings";
import CalendarStamp from "../MiniGames/CalendarStamp";
import GradeSlider from "../MiniGames/GradeSlider";
import ExamCalendarSort from "../MiniGames/ExamCalendarSort";
import SubjectPicker from "../MiniGames/SubjectPicker";
import ExamSetup from "../MiniGames/ExamSetup";
import MarkTargetPicker from "../MiniGames/MarkTargetPicker";
import MarksDartboard from "../MiniGames/MarksDartboard";
import DeadlineAbacus from "../MiniGames/DeadlineAbacus";
import SubjectBalanceScale from "../MiniGames/SubjectBalanceScale";
import { missionLabel, stationKeyFor } from "../Environment/stationMap";

function MiniGameSlot({ activeQuestion, onComplete }) {
  const props = { question: activeQuestion, onComplete };
  const type = activeQuestion?.interactionType;
  const station = stationKeyFor(activeQuestion);

  if (type === "subjectPick") return <SubjectPicker {...props} />;
  if (type === "examSetup") return <ExamSetup {...props} />;
  if (type === "date") return <DeadlineAbacus {...props} />;
  if (type === "examDate") return <ExamCalendarSort {...props} />;
  if (type === "markTarget") return <MarkTargetPicker {...props} />;
  if (type === "marks") {
    if (station === "dartboard") return <MarksDartboard {...props} />;
    if (station === "scale") return <SubjectBalanceScale {...props} />;
    return <GradeSlider {...props} />;
  }
  return <CalendarStamp {...props} />;
}

function purposeLabel(subject, question) {
  if (subject) return subject;
  return missionLabel(question);
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
        className="pointer-events-none absolute inset-0 z-40 flex flex-col"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 18%, rgba(255,248,235,0.18), transparent 46%), linear-gradient(to top, rgba(28,18,8,0.28), transparent 42%)",
          }}
        />

        <header className="pointer-events-none relative z-10 flex items-start justify-between px-5 pt-5 sm:px-8">
          <div className="rounded-2xl border border-white/50 bg-white/70 px-4 py-3 shadow-lg backdrop-blur-md">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
              {building?.name ?? "Campus building"}
            </div>
            <div className="mt-1 text-sm text-stone-700">{purposeLabel(subject, activeQuestion)}</div>
          </div>
          <div className="rounded-full border border-white/50 bg-white/70 px-3 py-1 text-xs text-stone-600 shadow-sm backdrop-blur-md">
            {missionLabel(activeQuestion)}
          </div>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 items-end justify-center p-4 sm:p-7">
          {completed ? (
            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="pointer-events-auto mb-6 rounded-3xl border border-emerald-200/80 bg-white/90 px-10 py-8 text-center shadow-xl backdrop-blur-md"
            >
              <div className="text-lg font-semibold text-emerald-700">Saved to your journal</div>
              {subject && <div className="mt-2 text-sm text-stone-500">{subject}</div>}
            </motion.div>
          ) : (
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-auto h-[min(88vh,820px)] w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/60 bg-white/88 shadow-[0_24px_80px_rgba(40,24,8,0.28)] backdrop-blur-md"
            >
              <div className="h-full min-h-0 p-5 sm:p-7">
                <MiniGameSlot activeQuestion={activeQuestion} onComplete={handleComplete} />
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
