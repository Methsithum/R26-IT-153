import { useState } from "react";
import { useGameStore } from "../state/GameStateManager";

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function ExamSetup({ question, onComplete }) {
  const registered = useGameStore((s) => s.subjects);
  const options = question?.context?.subjectOptions?.length ? question.context.subjectOptions : registered;
  const [subjects, setSubjects] = useState([]);
  const [kinds, setKinds] = useState([]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Exam Hall
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Exam preparation</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Pick the subjects you prepared, then Mid, Final, or both."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Subjects</div>
          <div className="flex flex-wrap gap-2">
            {options.map((subject) => {
              const active = subjects.includes(subject);
              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => setSubjects((current) => toggle(current, subject))}
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
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Paper</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: "mid", label: "Mid", hint: "Mid-semester" },
              { id: "final", label: "Final", hint: "End-semester" },
            ].map((kind) => {
              const active = kinds.includes(kind.id);
              return (
                <button
                  key={kind.id}
                  type="button"
                  onClick={() => setKinds((current) => toggle(current, kind.id))}
                  className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                    active
                      ? "bg-amber-800 border-amber-900 text-amber-50"
                      : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <div className="text-lg font-semibold">{kind.label}</div>
                  <div className={`text-xs mt-1 ${active ? "text-amber-100/80" : "text-stone-500"}`}>{kind.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={subjects.length === 0 || kinds.length === 0}
          onClick={() => onComplete({ subjects, exam_kinds: kinds })}
          className="mt-auto rounded-2xl bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700 disabled:opacity-40"
        >
          {subjects.length && kinds.length
            ? `Confirm ${subjects.join(", ")} · ${kinds.map((k) => k[0].toUpperCase() + k.slice(1)).join(" / ")}`
            : "Pick subject(s) and Mid / Final"}
        </button>
      </div>
    </div>
  );
}
