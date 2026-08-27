export function mapBackendQuestion(res) {
  if (!res?.question) return null;
  const options = Array.isArray(res.options) && res.options.length > 0 ? res.options : null;
  const missingExams = (res.missing_exams || []).map((exam) => ({
    id: exam.id,
    subject: exam.subject,
    examType: exam.exam_type,
  }));
  return {
    id: res.question_id || `q-${Date.now()}`,
    questionText: res.question,
    answers: options,
    answerType: res.answer_type || (options ? "choice" : "text"),
    category: res.category || "academic",
    requiresSpecialInteraction: Boolean(res.requires_special_interaction),
    interactionType: res.interaction_type || null,
    targetLocation: res.target_location || null,
    subject: res.subject || null,
    status: "pending",
    context: {
      field: res.context_field || null,
      subject: res.subject || null,
      missingExams,
      subjectOptions: res.subject_options || [],
    },
  };
}

export function serializeAnswer(value) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
