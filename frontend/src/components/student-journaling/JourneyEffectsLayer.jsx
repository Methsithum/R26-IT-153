import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Phaser from 'phaser';

const JourneyEffectsLayer = forwardRef(function JourneyEffectsLayer({ reducedMotion = false } = {}, ref) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);

  useImperativeHandle(ref, () => ({
    submitBurst: () => {
      if (reducedMotion) return;
      sceneRef.current?.events.emit('journey-fx', { type: 'submit-burst' });
    },
    comboPulse: (combo = 1) => {
      if (reducedMotion) return;
      sceneRef.current?.events.emit('journey-fx', { type: 'combo-pulse', combo });
    },
    deadlineSet: () => {
      if (reducedMotion) return;
      sceneRef.current?.events.emit('journey-fx', { type: 'deadline-set' });
    },
    stepAdvance: (step = 1) => {
      if (reducedMotion) return;
      sceneRef.current?.events.emit('journey-fx', { type: 'step-advance', step });
    },
    finishBurst: () => {
      if (reducedMotion) return;
      sceneRef.current?.events.emit('journey-fx', { type: 'finish-burst' });
    },
    reset: () => {
      if (reducedMotion) return;
      sceneRef.current?.events.emit('journey-fx', { type: 'reset' });
    },
  }));

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    if (reducedMotion) {
      sceneRef.current = null;
      if (gameRef.current) {
        try {
          gameRef.current.destroy(true);
        } catch (_error) {
          // ignore destroy failures during unmount
        }
        gameRef.current = null;
      }
      return undefined;
    }

    const width = Math.max(320, Math.floor(canvasRef.current.clientWidth || 860));
    const height = Math.max(320, Math.floor(canvasRef.current.clientHeight || 580));

    class JourneyFXScene extends Phaser.Scene {
      constructor() {
        super('JourneyFXScene');
        this.activeParticles = [];
      }

      create() {
        sceneRef.current = this;
        this.colors = [0x7c3aed, 0xa78bfa, 0x22d3ee, 0xf59e0b, 0xf8fafc];
        this.combo = 0;

        this.events.on('journey-fx', (event) => {
          switch (event.type) {
            case 'submit-burst':
              this.spawnBurst(this.scale.width * 0.82, this.scale.height * 0.82, 8, 0.35);
              break;
            case 'combo-pulse':
              this.combo = Number(event.combo || 1);
              this.spawnComboPulse(this.combo);
              break;
            case 'deadline-set':
              this.spawnDeadlineSweep();
              break;
            case 'step-advance':
              this.spawnStepTrail(Number(event.step || 1));
              break;
            case 'finish-burst':
              this.spawnBurst(this.scale.width * 0.5, this.scale.height * 0.55, 22, 0.75);
              break;
            case 'reset':
              this.combo = 0;
              this.clearParticles();
              break;
            default:
              break;
          }
        });

        this.startAmbientDrift();
      }

      startAmbientDrift() {
        this.time.addEvent({
          delay: 900,
          loop: true,
          callback: () => {
            const x = Phaser.Math.Between(24, this.scale.width - 24);
            const y = this.scale.height + Phaser.Math.Between(5, 50);
            const radius = Phaser.Math.Between(1, 2);
            const color = this.colors[Phaser.Math.Between(0, this.colors.length - 1)];
            const dot = this.add.circle(x, y, radius, color, 0.22);
            this.activeParticles.push(dot);

            this.tweens.add({
              targets: dot,
              y: y - Phaser.Math.Between(120, 240),
              x: x + Phaser.Math.Between(-26, 26),
              alpha: 0,
              duration: Phaser.Math.Between(1400, 2200),
              ease: 'Sine.easeOut',
              onComplete: () => {
                dot.destroy();
                this.activeParticles = this.activeParticles.filter((p) => p !== dot);
              },
            });
          },
        });
      }

      spawnBurst(x, y, count = 10, alpha = 0.45) {
        for (let i = 0; i < count; i += 1) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
          const speed = Phaser.Math.Between(65, 190);
          const dot = this.add.circle(
            x,
            y,
            Phaser.Math.Between(1, 3),
            this.colors[Phaser.Math.Between(0, this.colors.length - 1)],
            alpha
          );
          this.activeParticles.push(dot);

          this.tweens.add({
            targets: dot,
            x: x + Math.cos(angle) * speed,
            y: y + Math.sin(angle) * speed,
            alpha: 0,
            duration: Phaser.Math.Between(380, 760),
            ease: 'Cubic.easeOut',
            onComplete: () => {
              dot.destroy();
              this.activeParticles = this.activeParticles.filter((p) => p !== dot);
            },
          });
        }
      }

      spawnComboPulse(combo) {
        const strength = Math.min(1, 0.2 + combo * 0.08);
        const ring = this.add.circle(this.scale.width * 0.5, this.scale.height * 0.2, 20, 0x7c3aed, 0);
        ring.setStrokeStyle(2, 0xa78bfa, 0.35 + strength * 0.45);

        this.tweens.add({
          targets: ring,
          scaleX: 1.6 + strength,
          scaleY: 1.6 + strength,
          alpha: 0,
          duration: 520,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy(),
        });
      }

      spawnDeadlineSweep() {
        const centerX = this.scale.width * 0.5;
        const centerY = this.scale.height * 0.36;

        for (let i = 0; i < 10; i += 1) {
          this.time.delayedCall(i * 35, () => {
            const ring = this.add.circle(centerX, centerY, 12, 0, 0);
            ring.setStrokeStyle(2, 0xf59e0b, 0.38);
            this.tweens.add({
              targets: ring,
              scaleX: 1.4 + i * 0.08,
              scaleY: 1.4 + i * 0.08,
              alpha: 0,
              duration: 320,
              ease: 'Sine.easeOut',
              onComplete: () => ring.destroy(),
            });
          });
        }

        this.spawnBurst(centerX, centerY, 10, 0.5);
      }

      spawnStepTrail(step) {
        const maxSteps = 10;
        const x = this.scale.width * Math.min(0.95, Math.max(0.08, step / maxSteps));
        const y = this.scale.height * 0.12;
        this.spawnBurst(x, y, 6, 0.4);
      }

      clearParticles() {
        this.activeParticles.forEach((p) => {
          try {
            p.destroy();
          } catch (_error) {
            // ignore destroy failures during cleanup
          }
        });
        this.activeParticles = [];
      }
    }

    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      width,
      height,
      transparent: true,
      canvas: canvasRef.current,
      scene: [JourneyFXScene],
      parent: undefined,
      antialias: true,
    });

    gameRef.current = game;

    return () => {
      sceneRef.current = null;
      if (gameRef.current) {
        try {
          gameRef.current.destroy(true);
        } catch (_error) {
          // ignore destroy failures during unmount
        }
        gameRef.current = null;
      }
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1, opacity: 0.9 }}
    />
  );
});

export default JourneyEffectsLayer;
