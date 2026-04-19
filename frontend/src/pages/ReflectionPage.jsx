import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { WeeklyReflection } from '../components/reflection/WeeklyReflection'
import { SemesterReflection } from '../components/reflection/SemesterReflection'
import { getWeeklyReflection, submitReflection } from '../services/api'
import { cn } from '../utils/helpers'

export default function ReflectionPage() {
  const [tab, setTab] = useState('weekly')
  const [weeklyQuestions, setWeeklyQuestions] = useState([])
  const [weeklyResponses, setWeeklyResponses] = useState({})
  const [weeklySubmitted, setWeeklySubmitted] = useState(false)
  const [semesterValues, setSemesterValues] = useState({
    overall: '',
    challenges: '',
    workload: 6,
    supportQuality: 7,
    productivity: 7,
  })
  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)

  useEffect(() => {
    getWeeklyReflection('stu-001')
      .then((response) => setWeeklyQuestions(response.questions))
      .catch(() => toast.error('Something went wrong, try again'))
      .finally(() => setLoading(false))
  }, [])

  function updateWeekly(questionId, value) {
    setWeeklyResponses((prev) => ({ ...prev, [questionId]: value }))
  }

  async function submitWeekly() {
    setSubmitLoading(true)
    try {
      await submitReflection('stu-001', 'weekly', weeklyResponses)
      setWeeklySubmitted(true)
      toast.success('Weekly reflection submitted')
    } catch {
      toast.error('Something went wrong, try again')
    } finally {
      setSubmitLoading(false)
    }
  }

  async function submitSemester() {
    setSubmitLoading(true)
    try {
      await submitReflection('stu-001', 'semester', semesterValues)
      toast.success('Semester reflection submitted')
    } catch {
      toast.error('Something went wrong, try again')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pb-16 lg:pb-0">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h1 className="font-cinzel text-2xl text-amber-200">Reflection Chamber</h1>
        <div className="mt-3 inline-flex rounded-xl border border-slate-700 bg-slate-900/70 p-1">
          <button
            type="button"
            onClick={() => setTab('weekly')}
            className={cn(
              'rounded-lg px-3 py-1 text-sm',
              tab === 'weekly' ? 'bg-amber-500 text-slate-950' : 'text-slate-300',
            )}
          >
            Weekly Reflection
          </button>
          <button
            type="button"
            onClick={() => setTab('semester')}
            className={cn(
              'rounded-lg px-3 py-1 text-sm',
              tab === 'semester' ? 'bg-amber-500 text-slate-950' : 'text-slate-300',
            )}
          >
            Semester Reflection
          </button>
        </div>
      </section>

      {loading ? (
        <div className="h-60 animate-pulse rounded-2xl bg-slate-800" />
      ) : tab === 'weekly' ? (
        <WeeklyReflection
          questions={weeklyQuestions}
          responses={weeklyResponses}
          onChange={updateWeekly}
          onSubmit={submitWeekly}
          loading={submitLoading}
          submitted={weeklySubmitted}
        />
      ) : (
        <SemesterReflection
          values={semesterValues}
          onTextChange={(key, value) => setSemesterValues((prev) => ({ ...prev, [key]: value }))}
          onSliderChange={(key, value) => setSemesterValues((prev) => ({ ...prev, [key]: value }))}
          onSubmit={submitSemester}
          loading={submitLoading}
        />
      )}
    </motion.div>
  )
}
