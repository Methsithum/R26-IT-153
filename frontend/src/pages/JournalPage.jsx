import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { ActivitySelector } from '../components/journal/ActivitySelector'
import { DailyJournalFlow } from '../components/journal/DailyJournalFlow'
import { JournalSummary } from '../components/journal/JournalSummary'
import { useJournal } from '../context/JournalContext'
import { getActivityCatalog, getDailyJournal } from '../services/api'

const steps = ['Activities', 'Adaptive Questions', 'Summary']

export default function JournalPage() {
  const navigate = useNavigate()
  const {
    selectedActivities,
    setSelectedActivities,
    setXpEarnedToday,
    xpEarnedToday,
    newBadges,
    setNewBadges,
    resetSession,
  } = useJournal()

  const [step, setStep] = useState(1)
  const [activities, setActivities] = useState([])
  const [summaryData, setSummaryData] = useState({ journalText: '', xpEarnedToday: 0, newBadges: [] })
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    resetSession()
    getActivityCatalog('stu-001')
      .then((result) => setActivities(result.activities))
      .catch(() => toast.error('Something went wrong, try again'))
      .finally(() => setLoading(false))
  }, [resetSession])

  function toggleActivity(activity) {
    const exists = selectedActivities.some((item) => item.id === activity.id)
    if (exists) {
      setSelectedActivities(selectedActivities.filter((item) => item.id !== activity.id))
      return
    }
    setSelectedActivities([...selectedActivities, activity])
  }

  const handleFlowComplete = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const response = await getDailyJournal('stu-001', new Date().toISOString())
      setSummaryData(response)
      setXpEarnedToday(response.xpEarnedToday)
      setNewBadges(response.newBadges)
      setStep(3)
    } catch {
      toast.error('Something went wrong, try again')
    } finally {
      setSummaryLoading(false)
    }
  }, [setNewBadges, setXpEarnedToday])

  const finishQuest = useCallback(() => {
    toast.success(`Quest Complete! +${xpEarnedToday} XP 🎉`)
    navigate('/')
  }, [navigate, xpEarnedToday])

  const stepProgress = useMemo(() => ((step - 1) / (steps.length - 1)) * 100, [step])

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-800" />
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-16 lg:pb-0">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <div className="mb-4 h-1.5 w-full rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-600 to-yellow-400 transition-all duration-500"
            style={{ width: `${stepProgress}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {steps.map((label, index) => {
            const isActive = step >= index + 1
            return (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                    isActive
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-slate-600 text-slate-500'
                  }`}
                >
                  {index + 1}
                </span>
                <span className={isActive ? 'text-amber-200' : 'text-slate-500'}>{label}</span>
              </div>
            )
          })}
        </div>
      </section>

      {step === 1 && (
        <section className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
          <ActivitySelector
            activities={activities}
            selectedActivities={selectedActivities}
            onToggle={toggleActivity}
            onContinue={() => setStep(2)}
          />
        </section>
      )}

      {step === 2 && (
        <DailyJournalFlow
          studentId="stu-001"
          selectedActivities={selectedActivities}
          onFlowComplete={handleFlowComplete}
        />
      )}

      {step === 2 && summaryLoading && (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-800" />
      )}

      {step === 3 && (
        <JournalSummary
          journalText={summaryData.journalText}
          xpEarned={summaryData.xpEarnedToday}
          newBadges={newBadges}
          onComplete={finishQuest}
        />
      )}
    </motion.div>
  )
}
