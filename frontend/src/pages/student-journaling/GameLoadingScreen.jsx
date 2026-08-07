import { motion } from 'framer-motion';

export default function GameLoadingScreen() {
  return (
    <div className="min-h-screen game-bg flex flex-col items-center justify-center gap-4">
      <motion.div
        className="text-5xl"
        animate={{ rotate: [0, 10, -10, 0], y: [0, -8, 0] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        🎮
      </motion.div>
      <p className="text-violet-300 font-medium animate-pulse">Loading 3D Adventure...</p>
      <div className="w-48 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-violet-500"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '40%' }}
        />
      </div>
    </div>
  );
}
