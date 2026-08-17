import { useState } from "react";

function examLabel(exam) {
  const kind = String(exam.examType || exam.exam_type || "exam").replace(/^\w/, (c) => c.toUpperCase());
  return `${exam.subject} · ${kind}`;
}

export default function MarkTargetPicker({ question, onComplete }) {
  const exams = question?.context?.missingExams || [];
  const subjects = question?.context?.subjectOptions || [];
  const usingExams = exams.length > 0;
  const [picked, setPicked] = useState(null);

  const title = usingExams ? "Which exam result?" : "Which assignment mark?";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Marks desk
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{title}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Pick one subject so the mark is saved against the right paper."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap gap-2">
          {usingExams
            ? exams.map((exam) => {
                const active = picked === exam.id;
                return (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => setPicked(exam.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-amber-800 border-amber-900 text-amber-50"
                        : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {examLabel(exam)}
                  </button>
                );
              })
            : subjects.map((subject) => {
                const active = picked === subject;
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => setPicked(subject)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-amber-800 border-amber-900 text-amber-50"
                        : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {subject}
                  </button>
                );
              })}
        </div>
        <button
          type="button"
          disabled={!picked}
          onClick={() => onComplete(picked)}
          className="mt-auto rounded-2xl bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700 disabled:opacity-40"
        >
          {picked ? "Continue" : "Pick one subject"}
        </button>
      </div>
    </div>
  );
}
