// Turns a completed day's raw response/interaction records into a flowing,
// first-person diary paragraph — the same shape of text the backend's
// LLM-based `generate_daily_journal` is expected to return (see
// backend/app/services/journal/llm_service.py). Kept as a pure formatter so
// swapping in the real backend-generated `journal_entry` string later is a
// one-line change in RecentJournalsContent, not a UI rewrite.
import { NORMAL_QUESTION_POOL } from "./questions";
import { initialAssignments } from "./assignments";
import { initialExams } from "./exams";

const assignmentById = Object.fromEntries(initialAssignments.map((a) => [a.id, a]));
const examById = Object.fromEntries(initialExams.map((e) => [e.id, e]));

function formatDate(iso) {
  if (!iso) return "an unconfirmed date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function responseClause(r) {
  const q = NORMAL_QUESTION_POOL.find((q) => q.id === r.questionId);
  if (!q) return `${r.category} — ${r.answer}`;
  // "Did you attend a lecture today?" + "Yes" -> "attending a lecture — yes"
  const stem = q.questionText
    .replace(/^Did you /i, "")
    .replace(/^What (did|was) you(r)? /i, "")
    .replace(/\?$/, "");
  return `${stem} (${r.answer})`;
}

function interactionSentence(r) {
  if (r.interactionType === "date" && r.context?.field === "deadline") {
    const a = assignmentById[r.context.assignmentId];
    return `I stopped by the library and confirmed the deadline for "${a?.title ?? "an assignment"}" as ${formatDate(r.value)}.`;
  }
  if (r.interactionType === "marks") {
    const a = assignmentById[r.context?.assignmentId];
    return `I checked in at the faculty office and recorded my mark for "${a?.title ?? "an assignment"}": ${r.value}%.`;
  }
  if (r.interactionType === "examDate" && r.value && typeof r.value === "object") {
    const parts = Object.entries(r.value).map(
      ([examId, date]) => `${examById[examId]?.subject ?? "an exam"} on ${formatDate(date)}`
    );
    if (parts.length === 0) return null;
    return `I sorted out my exam schedule at the Exam Hall — ${parts.join(", ")}.`;
  }
  const value = r.value && typeof r.value === "object" ? Object.values(r.value).join(", ") : r.value;
  return `I updated a ${r.interactionType} record: ${value}.`;
}

export function composeJournalNarrative(entry) {
  const { responses = [], interactionsCompleted = [] } = entry.journalDay ?? {};
  const sentences = [];

  if (responses.length > 0) {
    const clauses = responses.map(responseClause);
    sentences.push(
      `Today's campus run touched on ${clauses.length === 1 ? "one thing" : `${clauses.length} things`}: ${clauses.join(", ")}.`
    );
  }

  for (const r of interactionsCompleted) {
    const sentence = interactionSentence(r);
    if (sentence) sentences.push(sentence);
  }

  sentences.push(`I finished the day with ${entry.xp.toLocaleString()} XP and a score of ${entry.score.toLocaleString()}.`);

  return sentences.join(" ");
}
