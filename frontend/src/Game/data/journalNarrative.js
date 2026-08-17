function formatDate(iso) {
  if (!iso) return "an unconfirmed date";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return String(iso);
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function responseClause(response) {
  const question = response.questionText || response.category || "a check-in";
  const stem = String(question)
    .replace(/^Did you /i, "")
    .replace(/^What (did|was) you(r)? /i, "")
    .replace(/\?$/, "");
  return `${stem} (${response.answer})`;
}

function interactionSentence(record) {
  const subject = record.context?.subject || record.subject;
  if (record.interactionType === "date") {
    return `I confirmed the deadline${subject ? ` for ${subject}` : ""} as ${formatDate(record.value)}.`;
  }
  if (record.interactionType === "marks") {
    return `I recorded my mark${subject ? ` for ${subject}` : ""}: ${record.value}%.`;
  }
  if (record.interactionType === "examDate" && record.value && typeof record.value === "object") {
    const parts = Object.entries(record.value).map(([, date]) => formatDate(date));
    if (parts.length === 0) return null;
    return `I set missing exam date${parts.length > 1 ? "s" : ""}: ${parts.join(", ")}.`;
  }
  if (record.value == null) return null;
  const value = typeof record.value === "object" ? Object.values(record.value).join(", ") : record.value;
  return `I updated a campus record: ${value}.`;
}

export function composeJournalNarrative(entry) {
  const written = (entry?.journalEntry || "").trim();
  if (written) return written;

  const { responses = [], interactionsCompleted = [] } = entry?.journalDay ?? {};
  const sentences = [];

  if (responses.length > 0) {
    const clauses = responses.map(responseClause);
    sentences.push(
      `Today's campus run touched on ${clauses.length === 1 ? "one thing" : `${clauses.length} things`}: ${clauses.join(", ")}.`
    );
  }

  for (const record of interactionsCompleted) {
    const sentence = interactionSentence(record);
    if (sentence) sentences.push(sentence);
  }

  if (sentences.length === 0) return "";
  if (entry?.xp || entry?.score) {
    sentences.push(
      `I finished the day with ${(entry.xp || 0).toLocaleString()} XP and a score of ${(entry.score || 0).toLocaleString()}.`
    );
  }
  return sentences.join(" ");
}
