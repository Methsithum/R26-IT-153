export function mapBackendQuestion(res) {
  if (!res?.question) return null;
  const options = Array.isArray(res.options) && res.options.length > 0 ? res.options : null;
  return {
    id: res.question_id || `q-${Date.now()}`,
    questionText: res.question,
    answers: options,
    answerType: res.answer_type || (options ? "choice" : "text"),
    category: res.category || "academic",
    requiresSpecialInteraction: Boolean(res.requires_special_interaction),
    interactionType: res.interaction_type || null,
    targetLocation: res.target_location || null,
    status: "pending",
    context: res.context_field ? { field: res.context_field } : {},
  };
}

export function serializeAnswer(value) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
