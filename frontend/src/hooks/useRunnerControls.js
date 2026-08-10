import { useCallback, useRef } from 'react';

/** Imperative lane/jump controls — avoids re-rendering the 3D canvas on every button press. */
export default function useRunnerControls({
  disabled = false,
  onMoveLeft,
  onMoveRight,
  onJump,
} = {}) {
  const laneIndexRef = useRef(1);
  const jumpQueuedRef = useRef(false);

  const moveLeft = useCallback(() => {
    if (disabled) return;
    laneIndexRef.current = Math.max(0, laneIndexRef.current - 1);
    onMoveLeft?.();
  }, [disabled, onMoveLeft]);

  const moveRight = useCallback(() => {
    if (disabled) return;
    laneIndexRef.current = Math.min(3, laneIndexRef.current + 1);
    onMoveRight?.();
  }, [disabled, onMoveRight]);

  const jump = useCallback(() => {
    if (disabled) return;
    jumpQueuedRef.current = true;
    onJump?.();
  }, [disabled, onJump]);

  const bindKeyboard = useCallback((handler) => {
    const onKey = (e) => {
      if (handler()) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft();
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveLeft, moveRight, jump]);

  const resetLane = useCallback((lane = 1) => {
    laneIndexRef.current = lane;
  }, []);

  return {
    laneIndexRef,
    jumpQueuedRef,
    moveLeft,
    moveRight,
    jump,
    bindKeyboard,
    resetLane,
  };
}
