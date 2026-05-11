import { motion } from 'framer-motion';

export default function QuestionOptions({ options, selected, onSelect }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, i) => {
        const isSelected = selected === i;
        return (
          <motion.button
            key={i}
            className="relative flex items-center gap-3 w-full text-left rounded-xl px-4 py-3 border text-sm transition-colors"
            style={{
              background: isSelected ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
              borderColor: isSelected ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)',
              color: isSelected ? '#c4b5fd' : '#cbd5e1',
            }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            whileHover={{ scale: 1.015, background: isSelected ? 'rgba(124,58,237,0.22)' : 'rgba(255,255,255,0.07)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(i)}
          >
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-semibold border transition-colors"
              style={{ flexShrink: 0 }}
              style={{
                background: isSelected ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)',
                borderColor: isSelected ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)',
                color: isSelected ? '#c4b5fd' : '#64748b',
              }}
            >
              {isSelected ? '✓' : String.fromCharCode(65 + i)}
            </span>
            <span className="font-medium">{opt.text}</span>
            {isSelected && (
              <motion.div
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{ border: '1px solid rgba(124,58,237,0.4)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
