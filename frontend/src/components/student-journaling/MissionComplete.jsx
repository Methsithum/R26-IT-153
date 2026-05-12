import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Phaser from 'phaser';

export default function MissionComplete({ mission, xpGained, result, onContinue }) {
  const canvasRef = useRef(null);
  const phaserRef = useRef(null);
  const [displayedJournal, setDisplayedJournal] = useState('');

  const journalEntry = useMemo(
    () => result?.journal_entry?.trim() || 'Great progress today. Your journal summary is being prepared.',
    [result?.journal_entry]
  );
  const unlockedBadges = result?.new_badges || [];
  const didLevelUp = Boolean(result?.level_up);

  useEffect(() => {
    if (!canvasRef.current) return;
    let game;

    const startParticles = () => {
      if (!Phaser || !canvasRef.current) return;

      const { width, height } = canvasRef.current.getBoundingClientRect();

      class ParticleScene extends Phaser.Scene {
        create() {
          const colors = [0x3b82f6, 0xa855f7, 0xf59e0b, 0x10b981, 0xf43f5e, 0x1e293b, 0xffffff];

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
        game = new Phaser.Game({
          type: Phaser.CANVAS,
          width,
          height,
          transparent: true,
          canvas: canvasRef.current,
          scene: [ParticleScene],
          parent: undefined,
        });
        phaserRef.current = game;
      } catch (e) {
        // ignore
      }
    };

    startParticles();

    return () => {
      if (phaserRef.current) {
        try { phaserRef.current.destroy(true); } catch (e) {}
        phaserRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let index = 0;
    setDisplayedJournal('');
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayedJournal(journalEntry.slice(0, index));
      if (index >= journalEntry.length) {
        window.clearInterval(timer);
      }
    }, 12);

    return () => window.clearInterval(timer);
  }, [journalEntry]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180 } },
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-6 sm:px-6 sm:py-8" style={{ background: '#f8fafc' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      />

      <motion.div
        className="relative z-10 flex w-full max-w-2xl flex-col items-center px-5 py-10 text-center sm:px-6 sm:py-12"
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
          className="text-4xl font-bold text-slate-800 mb-1 tracking-tight"
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
            background: 'linear-gradient(135deg, #a855f7, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Complete!
        </motion.h1>
        <motion.p className="text-sm text-slate-600 mb-8" variants={itemVariants}>
          {mission?.name} · logged successfully
        </motion.p>

        <motion.div className="flex gap-3 mb-8" variants={itemVariants}>
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold"
            style={{
              background: 'rgba(59,130,246,0.12)',
              borderColor: 'rgba(59,130,246,0.28)',
              color: '#1d4ed8',
            }}
          >
            <span>⚡</span>
            <span>+{xpGained} XP</span>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold"
            style={{
              background: 'rgba(245,158,11,0.12)',
              borderColor: 'rgba(245,158,11,0.28)',
              color: '#b45309',
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
            background: 'rgba(245,158,11,0.08)',
            borderColor: 'rgba(245,158,11,0.26)',
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
              <p className="text-[10px] uppercase tracking-widest text-amber-700/70 mb-0.5">Achievement Unlocked</p>
              <p className="text-sm font-semibold text-amber-700">Consistent Scholar</p>
              <p className="text-xs text-slate-600">Completed 3 missions in a row</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="w-full rounded-2xl p-4 border mb-6 text-left"
          variants={itemVariants}
          style={{
            background: '#ffffff',
            borderColor: '#e2e8f0',
          }}
        >
          <p className="text-[10px] uppercase tracking-widest text-purple-700/80 mb-2">Daily Journal Summary</p>
          <p className="text-sm leading-6 text-slate-700 whitespace-pre-wrap">
            {displayedJournal}
            {displayedJournal.length < journalEntry.length && (
              <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-purple-500/80 animate-pulse rounded-sm" />
            )}
          </p>
        </motion.div>

        {(didLevelUp || unlockedBadges.length > 0) && (
          <motion.div
            className="w-full rounded-2xl p-4 border mb-6"
            variants={itemVariants}
            style={{
              background: '#ffffff',
              borderColor: '#e2e8f0',
            }}
          >
            <p className="text-[10px] uppercase tracking-widest text-blue-700/80 mb-3 text-left">Session Rewards</p>
            <div className="flex flex-wrap items-center gap-2">
              {didLevelUp && (
                <motion.span
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#047857', border: '1px solid rgba(16,185,129,0.35)' }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Level Up
                </motion.span>
              )}
              {unlockedBadges.map((badge, index) => (
                <motion.span
                  key={`${badge}-${index}`}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.35)' }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 + index * 0.08 }}
                >
                  {badge}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}

        <motion.button
          className="w-full py-4 rounded-2xl text-sm font-semibold text-white border-0"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
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
