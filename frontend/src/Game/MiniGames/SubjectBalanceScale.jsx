import { useRef, useState } from "react";
import { play } from "../audio/sfx";

function subjectOf(question) {
  const exam = question?.context?.missingExams?.[0];
  if (exam?.subject) {
    const kind = String(exam.examType || exam.exam_type || "").replace(/^\w/, (c) => c.toUpperCase());
    return kind ? `${exam.subject} · ${kind}` : exam.subject;
  }
  return question?.subject || question?.context?.subject || "Today's subject";
}

function clampMark(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

const WEIGHTS = [40, 55, 70, 85, 100];

export default function SubjectBalanceScale({ question, onComplete }) {
  const [value, setValue] = useState(72);
  const svgRef = useRef(null);
  const dragging = useRef(false);
  const subject = subjectOf(question);
  const tilt = ((value - 50) / 50) * 12;

  function setFromClientX(clientX) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 240;
    setValue(clampMark(((x - 36) / 168) * 100));
  }

  function onPointerDown(event) {
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    play("click");
    setFromClientX(event.clientX);
  }

  function onPointerMove(event) {
    if (!dragging.current) return;
    setFromClientX(event.clientX);
  }

  function onPointerUp() {
    dragging.current = false;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-800/70">Performance desk</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{subject}</h2>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          {question?.questionText ?? "Drag the scale until it matches the mark you received."}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-amber-900/25 shadow-[0_18px_40px_rgba(40,20,8,0.28)]">
        <div
          className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-5"
          style={{ background: "linear-gradient(180deg, #c4a574 0%, #a98456 100%)" }}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 240 168"
            className="h-[min(42vh,280px)] w-full max-w-md cursor-grab touch-none select-none active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <rect x="70" y="132" width="100" height="18" rx="3" fill="#6b4424" />
            <polygon points="78,132 162,132 172,150 68,150" fill="#8f5a32" />
            <rect x="114" y="58" width="12" height="76" rx="2" fill="#d4b483" />
            <rect x="108" y="48" width="24" height="14" rx="3" fill="#b08d57" />
            <g transform={`rotate(${tilt} 120 56)`}>
              <rect x="28" y="52" width="184" height="8" rx="3" fill="#e8d5a3" />
              <line x1="52" y1="56" x2="52" y2="86" stroke="#8f7350" strokeWidth="3" />
              <line x1="188" y1="56" x2="188" y2="86" stroke="#8f7350" strokeWidth="3" />
              <ellipse cx="52" cy="98" rx="28" ry="10" fill="#7a5636" />
              <ellipse cx="188" cy="98" rx="28" ry="10" fill="#4d7c0f" />
              <circle cx="52" cy="92" r="10" fill="#b45309" />
              <circle cx="188" cy="90" r={8 + value / 14} fill="#f5d76e" stroke="#5c3a1e" strokeWidth="1.2" />
            </g>
            <circle cx="120" cy="56" r="6" fill="#4a3520" />
          </svg>

          <div className="mt-1 font-serif text-4xl tabular-nums text-amber-950">{value}%</div>
          <p className="mt-1 text-xs text-amber-950/55">Drag the beam — or drop a weight</p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {WEIGHTS.map((weight) => (
              <button
                key={weight}
                type="button"
                onClick={() => {
                  play("click");
                  setValue(weight);
                }}
                className={`h-12 w-12 rounded-md border text-sm font-semibold shadow-md ${
                  value === weight
                    ? "border-amber-950 bg-amber-900 text-amber-50"
                    : "border-black/20 bg-[#6b4424] text-amber-100"
                }`}
                style={{ backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.16), transparent 55%)" }}
              >
                {weight}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onComplete(value)}
          className="bg-amber-800 py-3.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-700"
        >
          Save {value}% for {subject}
        </button>
      </div>
    </div>
  );
}
