import { motion as Motion, AnimatePresence } from "framer-motion";
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
      <Motion.div
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

        <header className="station-location pointer-events-none relative z-10 flex shrink-0 items-start justify-between gap-2 px-3 pt-3 sm:px-8">
          <div className="ml-14 rounded-2xl border border-white/50 bg-white/70 px-4 py-3 shadow-lg backdrop-blur-md sm:ml-16">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
              {building?.name ?? "Campus building"}
            </div>
            <div className="mt-1 text-sm text-stone-700">{purposeLabel(subject, activeQuestion, targetBuildingId)}</div>
          </div>
          <div className="hidden sm:block rounded-full border border-amber-200/40 bg-slate-900/90 px-3 py-2 text-xs text-amber-200 shadow-sm backdrop-blur-md">
            {missionLabel(activeQuestion, targetBuildingId)}
          </div>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-3 sm:p-5">
          {completed ? (
            <Motion.div
              initial={{ y: 28, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              className="pointer-events-auto relative max-h-full overflow-y-auto rounded-3xl border border-emerald-200/80 bg-white px-6 py-6 text-center shadow-xl"
            >
              <Motion.div
                initial={{ scale: 1.8, opacity: 0, rotate: -18 }}
                animate={{ scale: 1, opacity: 1, rotate: -8 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-emerald-600 text-2xl font-black text-emerald-700"
              >
                ✓
              </Motion.div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700/70">Journal stamp</div>
              <div className="mt-2 text-2xl font-semibold text-stone-900">Saved to your journal</div>
              {subject && <div className="mt-1 text-sm text-stone-500">{subject}</div>}
              <div className="mt-5 flex items-center justify-center gap-6">
                <Motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">Score</div>
                  <div className="text-xl font-black text-amber-800">+300</div>
                </Motion.div>
                <Motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.22 }}>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">XP</div>
                  <div className="text-xl font-black text-emerald-700">+{XP_RULES.INTERACTION}</div>
                </Motion.div>
              </div>
            </Motion.div>
          ) : (
            <Motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="campus-station pointer-events-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-[20px] border-2 border-amber-200/70"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-900/20 bg-[#2c1810] px-3 py-2 text-amber-100">
                <span className="text-[10px] font-bold uppercase tracking-[.2em]">◆ Campus station</span>
                <span className="hidden sm:block text-[10px] text-amber-200/70">Select → Review → Record</span>
                <button type="button" onClick={() => useGameStore.getState().togglePause()} className="rounded-lg border border-amber-200/30 px-3 py-1 text-xs" aria-label="Pause station">Ⅱ Pause</button>
              </div>
              <div className="campus-station-content min-h-0 flex-1 overflow-y-auto p-3 sm:p-5" role="region" aria-label="Campus activity — scroll for all controls" tabIndex={0}>
                <MiniGameSlot key={activeQuestion?.id} activeQuestion={activeQuestion} onComplete={handleComplete} buildingId={targetBuildingId} />
              </div>
            </Motion.div>
          )}
        </div>
      </Motion.div>
    </AnimatePresence>
  );
}
