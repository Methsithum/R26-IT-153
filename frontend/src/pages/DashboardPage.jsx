import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Dashboard } from '../components/dashboard/Dashboard'
import { getDashboardData } from '../services/api'

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardData('stu-001')
      .then((response) => setData(response))
      .catch(() => toast.error('Something went wrong, try again'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pb-16 lg:pb-0">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h1 className="font-cinzel text-2xl text-amber-200">Performance Dashboard</h1>
      </section>

      {loading ? (
        <div className="space-y-3">
          <div className="h-64 animate-pulse rounded-2xl bg-slate-800" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-800" />
        </div>
      ) : (
        <Dashboard data={data} />
      )}
    </motion.div>
  )
}
