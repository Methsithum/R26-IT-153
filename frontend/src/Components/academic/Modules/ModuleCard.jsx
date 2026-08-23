import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatDeadlineCopy } from "../../../utils/dateHelpers";

const COLOR_MAP = {
  brand: "from-brand-500 to-brand-400",
  teal: "from-accent-teal to-low-500",
  pink: "from-accent-pink to-high-500",
  orange: "from-accent-orange to-medium-500",
};

export default function ModuleCard({ module, index = 0 }) {
  const TrendIcon = module.trend >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/modules/${module.code}`} className="card p-5 flex flex-col gap-3 hover:-translate-y-0.5 hover:shadow-playful transition-all block">
        <div className="flex items-center justify-between">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${COLOR_MAP[module.color]} flex items-center justify-center text-white font-bold text-sm`}>
            {module.code}
          </div>
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${module.trend >= 0 ? "text-low-600" : "text-high-600"}`}>
            <TrendIcon size={13} /> {Math.abs(module.trend)}%
          </span>
        </div>
        <div>
          <p className="font-semibold text-slate-700 dark:text-white">{module.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{module.taskCount} tasks · {formatDeadlineCopy(module.nextDeadline)}</p>
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Current grade</span>
            <span className="font-semibold text-slate-600 dark:text-slate-200">{module.currentGrade}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${COLOR_MAP[module.color]}`} style={{ width: `${module.currentGrade}%` }} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
