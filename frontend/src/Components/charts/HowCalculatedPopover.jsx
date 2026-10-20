import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function HowCalculatedPopover({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-label="How is this calculated?"
        title="How is this calculated?"
        className="flex items-center justify-center rounded-full p-1 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-white/10 transition-colors"
      >
        <HelpCircle size={14} strokeWidth={2.2} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-20 mt-1 w-60 rounded-xl border border-brand-100 dark:border-white/10 bg-white dark:bg-[#1a1530] p-3 text-[11px] leading-snug text-slate-500 dark:text-slate-300 shadow-lg"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
