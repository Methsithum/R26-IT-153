export function mapBackendQuestion(res) {
  if (!res?.question) return null;
  const options = Array.isArray(res.options) && res.options.length > 0 ? res.options : null;
  const missingExams = (res.missing_exams || []).map((exam) => ({
    id: exam.id,
    subject: exam.subject,
    examType: exam.exam_type,
  }));
  const markAssignments = (res.mark_assignments || []).map((item) => ({
    id: item.id,
    subject: item.subject,
    title: item.title || item.subject,
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
      markAssignments,
      subjectOptions: res.subject_options || markAssignments.map((item) => item.title),
      examKind: res.exam_kind || missingExams[0]?.examType || null,
      assignmentId: res.task_id || markAssignments[0]?.id || null,
    },
  };
}

export function serializeAnswer(value) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
