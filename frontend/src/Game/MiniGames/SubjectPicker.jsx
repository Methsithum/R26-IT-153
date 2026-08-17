import { useState } from "react";
import { useGameStore } from "../state/GameStateManager";

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function SubjectPicker({ question, onComplete }) {
  const registered = useGameStore((s) => s.subjects);
  const options = question?.context?.subjectOptions?.length ? question.context.subjectOptions : registered;
  const [picked, setPicked] = useState([]);

  const title =
    question?.context?.field === "assignmentSubjects"
      ? "Assignment subjects"
      : question?.context?.field === "lectureSubjects"
        ? "Today's lectures"
        : "Today's subjects";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">
          Subject board
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{title}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Pick the registered subject(s) for this activity."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        {options.length === 0 ? (
          <p className="text-sm text-stone-500">No registered subjects on this account.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {options.map((subject) => {
              const active = picked.includes(subject);
              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => setPicked((current) => toggle(current, subject))}
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
        )}
        <button
          type="button"
          disabled={picked.length === 0}
          onClick={() => onComplete(picked)}
          className="mt-auto rounded-2xl bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700 disabled:opacity-40"
        >
          {picked.length ? `Confirm ${picked.join(", ")}` : "Pick at least one subject"}
        </button>
      </div>
    </div>
  );
}
