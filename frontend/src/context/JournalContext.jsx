import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const JournalContext = createContext(null)

export function JournalProvider({ children }) {
  const [selectedActivities, setSelectedActivities] = useState([])
  const [questionHistory, setQuestionHistory] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [xpEarnedToday, setXpEarnedToday] = useState(0)
  const [newBadges, setNewBadges] = useState([])

  const resetSession = useCallback(() => {
    setSelectedActivities([])
    setQuestionHistory([])
    setCurrentQuestionIndex(0)
    setSessionComplete(false)
    setXpEarnedToday(0)
    setNewBadges([])
  }, [])

  const value = useMemo(
    () => ({
      selectedActivities,
      setSelectedActivities,
      questionHistory,
      setQuestionHistory,
      currentQuestionIndex,
      setCurrentQuestionIndex,
      sessionComplete,
      setSessionComplete,
      xpEarnedToday,
      setXpEarnedToday,
      newBadges,
      resetSession,
      setNewBadges,
    }),
    [
      selectedActivities,
      questionHistory,
      currentQuestionIndex,
      sessionComplete,
      xpEarnedToday,
      newBadges,
      resetSession,
    ],
  )

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
}

export function useJournal() {
  const context = useContext(JournalContext)
  if (!context) {
    throw new Error('useJournal must be used within JournalProvider')
  }
  return context
}
