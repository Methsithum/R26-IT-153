import { useCallback, useEffect, useRef } from 'react';

function createTone(ctx, { freq = 440, type = 'sine', duration = 0.12, volume = 0.15, ramp = true }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  if (ramp) {
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  }
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export default function useGameSound(enabled = true) {
  const ctxRef = useRef(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    return () => {
      ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  const ensureContext = useCallback(() => {
    if (!enabled) return null;
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    unlockedRef.current = true;
    return ctxRef.current;
  }, [enabled]);

  const playCollect = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;
    createTone(ctx, { freq: 880, type: 'sine', duration: 0.08, volume: 0.12 });
    setTimeout(() => createTone(ctx, { freq: 1320, type: 'sine', duration: 0.1, volume: 0.08 }), 40);
  }, [ensureContext]);

  const playJump = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }, [ensureContext]);

  const playHit = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;
    createTone(ctx, { freq: 120, type: 'square', duration: 0.2, volume: 0.1 });
    createTone(ctx, { freq: 80, type: 'sawtooth', duration: 0.25, volume: 0.08 });
  }, [ensureContext]);

  const playCheckpoint = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;
    [523, 659, 784].forEach((freq, i) => {
      setTimeout(() => createTone(ctx, { freq, type: 'sine', duration: 0.2, volume: 0.1 }), i * 80);
    });
  }, [ensureContext]);

  const playComplete = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => createTone(ctx, { freq, type: 'triangle', duration: 0.25, volume: 0.12 }), i * 100);
    });
  }, [ensureContext]);

  const playLane = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;
    createTone(ctx, { freq: 330, type: 'sine', duration: 0.05, volume: 0.06 });
  }, [ensureContext]);

  const unlock = useCallback(() => ensureContext(), [ensureContext]);

  return { playCollect, playJump, playHit, playCheckpoint, playComplete, playLane, unlock };
}
