import { motion, AnimatePresence } from 'framer-motion';

export default function CollectBurst({ bursts = [], onDone }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-15 overflow-hidden">
      <AnimatePresence>
        {bursts.map((b) => (
          <motion.div
            key={b.id}
            className="absolute"
            style={{ left: b.x, top: b.y }}
            initial={{ opacity: 1, scale: 0.5 }}
            animate={{ opacity: 0, scale: 2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onAnimationComplete={() => onDone?.(b.id)}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{ background: b.color || '#fbbf24' }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{
                  x: Math.cos((i / 6) * Math.PI * 2) * 40,
                  y: Math.sin((i / 6) * Math.PI * 2) * 40,
                  opacity: 0,
                }}
                transition={{ duration: 0.45 }}
              />
            ))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
