import { useEffect, useMemo, useState } from 'react'
import { getNextQuestion, submitAnswer as submitAnswerApi } from '../services/api'
import { useJournal } from '../context/JournalContext'

export function useJournalFlow(studentId, selectedActivities) {
  const {
    questionHistory,
    setQuestionHistory,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    setSessionComplete,
  } = useJournal()

  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [totalQuestions, setTotalQuestions] = useState(1)

  useEffect(() => {
    let isMounted = true

    async function bootstrapFirstQuestion() {
      if (!studentId || !selectedActivities.length) return

      setIsLoading(true)
      try {
        const response = await getNextQuestion(studentId, {
          selectedActivities,
          questionHistory: [],
        })

        if (!isMounted) return

        setTotalQuestions(response.totalQuestions || 1)
        if (!response.hasMore) {
          setCurrentQuestion(null)
          setIsComplete(true)
          setSessionComplete(true)
          return
        }

        setCurrentQuestion(response.question)
        setCurrentQuestionIndex(0)
        setIsComplete(false)
        setSessionComplete(false)
      } catch (error) {
        if (isMounted) {
          setIsComplete(true)
          setSessionComplete(true)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    bootstrapFirstQuestion()

    return () => {
      isMounted = false
    }
  }, [
    studentId,
    selectedActivities,
    setCurrentQuestionIndex,
    setSessionComplete,
  ])

  async function submitAnswer(answer) {
    if (!currentQuestion || !studentId) return

    const nextHistoryItem = {
      questionId: currentQuestion.id,
      question: currentQuestion.text,
      answer,
    }

    const nextHistory = [...questionHistory, nextHistoryItem]
    setQuestionHistory(nextHistory)

    setIsLoading(true)
    try {
      await submitAnswerApi(studentId, currentQuestion.id, answer)
      const response = await getNextQuestion(studentId, {
        selectedActivities,
        questionHistory: nextHistory,
      })

      setTotalQuestions(response.totalQuestions || totalQuestions)
      if (!response.hasMore) {
        setCurrentQuestion(null)
        setIsComplete(true)
        setSessionComplete(true)
        return
      }

      setCurrentQuestion(response.question)
      setCurrentQuestionIndex((prev) => prev + 1)
    } finally {
      setIsLoading(false)
    }
  }

  const progress = useMemo(
    () => ({
      current: Math.min(currentQuestionIndex + 1, totalQuestions),
      total: totalQuestions,
    }),
    [currentQuestionIndex, totalQuestions],
  )

  return {
    currentQuestion,
    isLoading,
    isComplete,
    progress,
    submitAnswer,
  }
}
