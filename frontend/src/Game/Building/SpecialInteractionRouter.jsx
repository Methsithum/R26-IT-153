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
import LetterGradeTubes from "../MiniGames/LetterGradeTubes";
import DeadlineAbacus from "../MiniGames/DeadlineAbacus";
import SubjectBalanceScale from "../MiniGames/SubjectBalanceScale";
import { missionLabel, stationKeyFor } from "../Environment/stationMap";
import { XP_RULES } from "../state/GameStateManager";

function MiniGameSlot({ activeQuestion, onComplete, buildingId }) {
  const props = { question: activeQuestion, onComplete };
  const type = activeQuestion?.interactionType;
  const station = stationKeyFor(activeQuestion, buildingId);

  if (type === "subjectPick") return <SubjectPicker {...props} />;
  if (type === "examSetup") return <ExamSetup {...props} />;
  if (type === "date") return <DeadlineAbacus {...props} />;
  if (type === "examDate") return <ExamCalendarSort {...props} />;
  if (type === "markTarget") return <MarkTargetPicker {...props} />;
  if (type === "marks") {
    const exam = activeQuestion?.context?.missingExams?.[0];
    const kind = String(
      exam?.examType || exam?.exam_type || activeQuestion?.context?.examKind || ""
    ).toLowerCase();
    if (kind === "final") return <LetterGradeTubes {...props} />;
    if (station === "dartboard") return <MarksDartboard {...props} />;
    if (station === "scale") return <SubjectBalanceScale {...props} />;
    return <GradeSlider {...props} />;
  }
  return <CalendarStamp {...props} />;
}

function purposeLabel(subject, question, buildingId) {
  if (subject) return subject;
  return missionLabel(question, buildingId);
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
          <div className="ml-14 rounded-2xl border border-white/50 bg-white/70 px-4 py-3 shadow-lg backdrop-blur-md sm:ml-16">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
              {building?.name ?? "Campus building"}
            </div>
            <div className="mt-1 text-sm text-stone-700">{purposeLabel(subject, activeQuestion, targetBuildingId)}</div>
          </div>
          <div className="rounded-full border border-white/50 bg-white/70 px-3 py-1 text-xs text-stone-600 shadow-sm backdrop-blur-md">
            {missionLabel(activeQuestion, targetBuildingId)}
          </div>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 items-end justify-center p-4 sm:p-7">
          {completed ? (
            <motion.div
              initial={{ y: 28, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              className="pointer-events-auto relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/80 bg-white/92 px-10 py-9 text-center shadow-xl backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 1.8, opacity: 0, rotate: -18 }}
                animate={{ scale: 1, opacity: 1, rotate: -8 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-emerald-600 text-2xl font-black text-emerald-700"
              >
                ✓
              </motion.div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700/70">Journal stamp</div>
              <div className="mt-2 text-2xl font-semibold text-stone-900">Saved to your journal</div>
              {subject && <div className="mt-1 text-sm text-stone-500">{subject}</div>}
              <div className="mt-5 flex items-center justify-center gap-6">
                <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">Score</div>
                  <div className="text-xl font-black text-amber-800">+300</div>
                </motion.div>
                <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.22 }}>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">XP</div>
                  <div className="text-xl font-black text-emerald-700">+{XP_RULES.INTERACTION}</div>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-auto h-[min(88vh,820px)] w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/60 bg-white/88 shadow-[0_24px_80px_rgba(40,24,8,0.28)] backdrop-blur-md"
            >
              <div className="h-full min-h-0 p-5 sm:p-7">
                <MiniGameSlot activeQuestion={activeQuestion} onComplete={handleComplete} buildingId={targetBuildingId} />
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
