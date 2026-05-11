import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function MissionComplete({ mission, xpGained, onContinue }) {
  const canvasRef = useRef(null);
  const phaserRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let game;

    const loadPhaser = async () => {
      if (window.Phaser) {
        startParticles();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js';
      script.onload = startParticles;
      document.head.appendChild(script);
    };

    const startParticles = () => {
      if (!window.Phaser || !canvasRef.current) return;

      const { width, height } = canvasRef.current.getBoundingClientRect();

      class ParticleScene extends window.Phaser.Scene {
        create() {
          const colors = [0x7c3aed, 0xa78bfa, 0xc4b5fd, 0xf97316, 0xeab308, 0x22c55e, 0xffffff];
          const graphics = this.add.graphics();

          const burst = (x, y, count = 12) => {
            for (let i = 0; i < count; i++) {
              const color = colors[Math.floor(Math.random() * colors.length)];
              const size = Math.random() * 5 + 3;
              const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
              const speed = Math.random() * 220 + 80;
              const vx = Math.cos(angle) * speed;
              const vy = Math.sin(angle) * speed - 60;

              const circle = this.add.graphics();
              circle.fillStyle(color, 1);
              circle.fillCircle(0, 0, size);
              circle.x = x;
              circle.y = y;

              this.tweens.add({
                targets: circle,
                x: x + vx * (0.8 + Math.random() * 0.4),
                y: y + vy + 300,
                alpha: 0,
                scaleX: 0.1,
                scaleY: 0.1,
                duration: 900 + Math.random() * 600,
                ease: 'Power2',
                onComplete: () => circle.destroy(),
              });
            }
          };

          const rain = () => {
            for (let i = 0; i < 40; i++) {
              this.time.delayedCall(i * 60, () => {
                const x = Math.random() * width;
                const color = colors[Math.floor(Math.random() * colors.length)];
                const size = Math.random() * 4 + 2;
                const circle = this.add.graphics();
                circle.fillStyle(color, 0.9);
                circle.fillCircle(0, 0, size);
                circle.x = x;
                circle.y = -10;
                this.tweens.add({
                  targets: circle,
                  y: height + 20,
                  x: x + (Math.random() - 0.5) * 100,
                  alpha: 0,
                  duration: 1200 + Math.random() * 800,
                  ease: 'Power1',
                  onComplete: () => circle.destroy(),
                });
              });
            }
          };

          burst(width * 0.3, height * 0.4, 18);
          burst(width * 0.7, height * 0.4, 18);
          burst(width * 0.5, height * 0.5, 24);
          this.time.delayedCall(300, () => burst(width * 0.2, height * 0.3, 14));
          this.time.delayedCall(500, () => burst(width * 0.8, height * 0.3, 14));
          rain();
          this.time.delayedCall(800, rain);
        }
      }

      try {
        game = new window.Phaser.Game({
          type: window.Phaser.CANVAS,
          width,
          height,
          transparent: true,
          canvas: canvasRef.current,
          scene: [ParticleScene],
          parent: undefined,
        });
        phaserRef.current = game;
      } catch (e) {
      }
    };

    loadPhaser();

    return () => {
      if (phaserRef.current) {
        try { phaserRef.current.destroy(true); } catch (e) {}
        phaserRef.current = null;
      }
    };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180 } },
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: '#0d0f1a' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center text-center px-6 py-12 max-w-sm w-full"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="text-7xl mb-4"
          variants={itemVariants}
          animate={{ rotate: [0, -5, 5, -3, 3, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          ✨
        </motion.div>

        <motion.h1
          className="text-4xl font-bold text-white mb-1 tracking-tight"
          variants={itemVariants}
          style={{ fontFamily: "'Georgia', serif" }}
        >
          Mission
        </motion.h1>
        <motion.h1
          className="text-4xl font-bold mb-2 tracking-tight"
          variants={itemVariants}
          style={{
            fontFamily: "'Georgia', serif",
            background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Complete!
        </motion.h1>
        <motion.p className="text-sm text-slate-400 mb-8" variants={itemVariants}>
          {mission?.name} · logged successfully
        </motion.p>

        <motion.div className="flex gap-3 mb-8" variants={itemVariants}>
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold"
            style={{
              background: 'rgba(124,58,237,0.2)',
              borderColor: 'rgba(124,58,237,0.4)',
              color: '#c4b5fd',
            }}
          >
            <span>⚡</span>
            <span>+{xpGained} XP</span>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold"
            style={{
              background: 'rgba(249,115,22,0.15)',
              borderColor: 'rgba(249,115,22,0.3)',
              color: '#fb923c',
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1], rotate: [-5, 5, -5] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              🔥
            </motion.span>
            <span>Streak!</span>
          </div>
        </motion.div>

        <motion.div
          className="w-full rounded-2xl p-4 border mb-6"
          variants={itemVariants}
          style={{
            background: 'rgba(234,179,8,0.07)',
            borderColor: 'rgba(234,179,8,0.25)',
          }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="text-3xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1, delay: 0.8 }}
            >
              🏆
            </motion.div>
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-widest text-yellow-500/70 mb-0.5">Achievement Unlocked</p>
              <p className="text-sm font-semibold text-yellow-200">Consistent Scholar</p>
              <p className="text-xs text-slate-500">Completed 3 missions in a row</p>
            </div>
          </div>
        </motion.div>

        <motion.button
          className="w-full py-4 rounded-2xl text-sm font-semibold text-white border-0"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onContinue}
        >
          Back to Dashboard →
        </motion.button>
      </motion.div>
    </div>
  );
}
