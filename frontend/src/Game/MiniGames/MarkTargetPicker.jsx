import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { play } from "../audio/sfx";
import { blotterStyle } from "./woodDesk";

function examLabel(exam) {
  const kind = String(exam.examType || exam.exam_type || "exam").replace(/^\w/, (c) => c.toUpperCase());
  return { title: exam.subject, badge: kind || "Exam" };
}

function hashName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export default function MarkTargetPicker({ question, onComplete }) {
  const exams = question?.context?.missingExams || [];
  const assignments = question?.context?.markAssignments || [];
  const subjects = question?.context?.subjectOptions || [];
  const usingExams = exams.length > 0;
  const [picked, setPicked] = useState(null);

  const papers = useMemo(() => {
    if (usingExams) {
      return exams.map((exam) => ({
        id: exam.id,
        ...examLabel(exam),
        hint: "Pin this result",
      }));
    }
    if (assignments.length) {
      return assignments.map((item) => ({
        id: item.id,
        title: item.title || item.subject,
        badge: "Assignment",
        hint: "Pin this paper",
      }));
    }
    return subjects.map((subject) => ({
      id: subject,
      title: subject,
      badge: "Assignment",
      hint: "Pin this paper",
    }));
  }, [assignments, exams, subjects, usingExams]);

  const title = usingExams ? "Which exam result?" : "Which assignment mark?";

  function choose(id) {
    play("stamp");
    setPicked(id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">Marks desk</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{title}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Pin the paper you want to log a mark for."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-amber-900/20 shadow-inner">
        <div className="min-h-0 flex-1 overflow-auto p-5" style={blotterStyle}>
          <div className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-950/55">
            Pin one paper to the board
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {papers.map((paper) => {
              const active = picked === paper.id;
              const tilt = ((hashName(String(paper.id)) % 9) - 4) * 2.4;
              return (
                <motion.button
                  key={paper.id}
                  type="button"
                  onClick={() => choose(paper.id)}
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{
                    opacity: 1,
                    scale: active ? 1.04 : 1,
                    rotate: active ? 0 : tilt,
                    y: active ? -8 : 0,
                  }}
                  whileHover={{ y: -10, rotate: 0 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative w-[168px] rounded-sm border border-amber-900/15 bg-[#fff7ed] px-3 py-4 text-left shadow-md"
                >
                  <span className="absolute left-1/2 top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-red-800 shadow-[0_2px_0_rgba(0,0,0,0.25)]" />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800/60">{paper.badge}</div>
                  <div className="mt-2 text-sm font-semibold leading-snug text-stone-800">{paper.title}</div>
                  <div className="mt-3 border-t border-dashed border-amber-900/20 pt-2 text-[10px] uppercase tracking-[0.16em] text-stone-400">
                    {paper.hint}
                  </div>
                  {active && (
                    <span className="absolute right-2 top-6 flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-800/80 text-[9px] font-black uppercase tracking-wider text-red-800/80 -rotate-12">
                      This
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
          {papers.length === 0 && (
            <p className="text-center text-sm text-amber-950/50">No papers are waiting for a mark.</p>
          )}
        </div>

        <button
          type="button"
          disabled={!picked}
          onClick={() => onComplete(picked)}
          className="bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700 disabled:opacity-40"
        >
          {picked ? "Take this paper to the board" : "Pin one paper first"}
        </button>
      </div>
    </div>
  );
}
