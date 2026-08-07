import { motion } from 'framer-motion';

function ControlButton({ label, onPress, disabled, wide = false, children }) {
  return (
    <motion.button
      type="button"
      className={`game-btn rounded-2xl font-bold select-none ${wide ? 'w-20 h-20 text-sm' : 'w-16 h-16 text-2xl'}`}
      style={{ touchAction: 'none' }}
      whileTap={{ scale: disabled ? 1 : 0.9 }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        onPress?.();
      }}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </motion.button>
  );
}

export default function GameControls({ onLeft, onRight, onJump, disabled }) {
  return (
    <>
      <div className="hidden sm:flex absolute bottom-6 left-6 z-20 flex-col gap-2 text-[10px] text-slate-500 pointer-events-none">
        <span>A / ← Move Left</span>
        <span>D / → Move Right</span>
        <span>Space / ↑ Jump forward</span>
      </div>

      {/* Touch + mouse — single pointer event, no double-fire */}
      <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-4 px-4 pointer-events-auto">
        <ControlButton label="Move left" onPress={onLeft} disabled={disabled}>
          ←
        </ControlButton>
        <ControlButton label="Jump" onPress={onJump} disabled={disabled} wide>
          JUMP
        </ControlButton>
        <ControlButton label="Move right" onPress={onRight} disabled={disabled}>
          →
        </ControlButton>
      </div>
    </>
  );
}
