// Journal persistence helpers — daily entries built up as the player
// answers questions / completes special interactions during a run.

export function createEmptyJournalDay(dayNumber) {
  return {
    day: dayNumber,
    startedAt: new Date().toISOString(),
    completedAt: null,
    responses: [], // { questionId, category, answer, source: "lane" | "interaction" }
    interactionsCompleted: [], // { interactionType, targetLocation, value }
    xpEarned: 0,
    scoreEarned: 0,
  };
}

export function recordResponse(day, question, answer, source = "lane") {
  return {
    ...day,
    responses: [
      ...day.responses,
      { questionId: question.id, category: question.category, answer, source },
    ],
  };
}

export function recordInteraction(day, question, result) {
  return {
    ...day,
    interactionsCompleted: [
      ...day.interactionsCompleted,
      {
        interactionType: question.interactionType,
        targetLocation: question.targetLocation,
        context: question.context,
        value: result.value,
      },
    ],
  };
}

export function completeJournalDay(day, xp, score) {
  return {
    ...day,
    completedAt: new Date().toISOString(),
    xpEarned: xp,
    scoreEarned: score,
  };
}
