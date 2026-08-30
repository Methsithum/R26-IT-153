import { formatExamMark } from "./letterGrades";

function formatDate(iso) {
  if (!iso) return "an unconfirmed date";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return String(iso);
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function isRawDump(text) {
  const value = (text || "").trim();
  if (!value) return true;
  return (
    value.startsWith("Today's campus run touched on") ||
    value.startsWith("Today I logged my campus run.")
  );
}

function highlightFromResponse(response) {
  const question = String(response.questionText || response.category || "Check-in")
    .replace(/\?$/, "")
    .trim();
  const answer = String(response.answer ?? "—").trim();
  return `${question}: ${answer}`;
}

function highlightsFromEntry(entry) {
  const { responses = [], interactionsCompleted = [] } = entry?.journalDay ?? {};
  const highlights = responses.map(highlightFromResponse);

  for (const record of interactionsCompleted) {
    const subject = record.context?.subject || record.subject;
    if (record.interactionType === "date") {
      highlights.push(`Deadline${subject ? ` · ${subject}` : ""}: ${formatDate(record.value)}`);
    } else if (record.interactionType === "marks") {
      const examLabel = record.context?.missingExams?.[0]
        ? ` · ${record.context.missingExams[0].subject || subject}${record.context.missingExams[0].examType ? ` ${record.context.missingExams[0].examType}` : ""}`
        : subject
          ? ` · ${subject}`
          : "";
      highlights.push(`Mark${examLabel}: ${formatExamMark(record.value) || record.value}`);
    } else if (record.interactionType === "examDate" && record.value && typeof record.value === "object") {
      Object.values(record.value).forEach((date) => highlights.push(`Exam date: ${formatDate(date)}`));
    }
  }

  return highlights;
}

function fallbackNarrative(entry) {
  const count = entry?.journalDay?.responses?.length || 0;
  if (count === 0) {
    return "Today's journal page is waiting for a completed campus run.";
  }
  return (
    "Today I showed up for my campus journal and wrote down how the day actually went. " +
    `I logged ${count} check-in${count === 1 ? "" : "s"} so lectures, study, and anything still outstanding are on the page instead of only in my head.`
  );
}

export function buildJournalPage(entry) {
  const storedHighlights = Array.isArray(entry?.highlights)
    ? entry.highlights.map((item) => String(item).trim()).filter(Boolean)
    : [];

  let narrative = (entry?.journalEntry || "").trim();
  if (narrative.startsWith("{")) {
    try {
      const parsed = JSON.parse(narrative);
      if (parsed.narrative) narrative = String(parsed.narrative).trim();
      if (Array.isArray(parsed.highlights) && parsed.highlights.length && storedHighlights.length === 0) {
        storedHighlights.push(...parsed.highlights.map((item) => String(item).trim()).filter(Boolean));
      }
    } catch {
      // keep the original string
    }
  }

  if (isRawDump(narrative)) {
    narrative = fallbackNarrative(entry);
  }

  const highlights = storedHighlights.length ? storedHighlights : highlightsFromEntry(entry);
  return {
    narrative: narrative || fallbackNarrative(entry),
    highlights,
  };
}

export function composeJournalNarrative(entry) {
  return buildJournalPage(entry).narrative;
}

/** Split a diary letter into readable paragraphs, including older one-block entries. */
export function splitJournalParagraphs(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const byBlank = raw
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (byBlank.length > 1) return byBlank;

  const sentences = raw.match(/[^.!?]+[.!?]+(?:["”']+)?|[^.!?]+$/g) || [raw];
  const cleaned = sentences.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length <= 2) return [cleaned.join(" ")];
  const size = cleaned.length <= 5 ? 2 : 3;
  const chunks = [];
  for (let i = 0; i < cleaned.length; i += size) {
    chunks.push(cleaned.slice(i, i + size).join(" "));
  }
  return chunks;
}
