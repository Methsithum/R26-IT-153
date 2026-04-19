import { LoaderCircle } from 'lucide-react'
import { useEffect } from 'react'
import { useJournalFlow } from '../../hooks/useJournalFlow'
import { ProgressTracker } from './ProgressTracker'
import { QuestionCard } from './QuestionCard'

export function DailyJournalFlow({ studentId, selectedActivities, onFlowComplete }) {
  const { currentQuestion, isLoading, isComplete, progress, submitAnswer } = useJournalFlow(
    studentId,
    selectedActivities,
  )

  useEffect(() => {
    if (isComplete) {
      onFlowComplete()
    }
  }, [isComplete, onFlowComplete])

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/55 p-4">
      <ProgressTracker current={progress.current} total={progress.total} />

      {isLoading ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-slate-300">
          <LoaderCircle className="h-8 w-8 animate-spin text-amber-300" />
          <p className="font-cinzel text-lg text-amber-200">The AI is thinking...</p>
        </div>
      ) : (
        currentQuestion && <QuestionCard question={currentQuestion} onAnswer={submitAnswer} />
      )}
    </section>
  )
}
