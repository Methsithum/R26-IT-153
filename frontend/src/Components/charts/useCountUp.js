import { useEffect, useRef, useState } from "react";

// Lightweight count-up animation, no extra dependency. Honors
// prefers-reduced-motion by jumping straight to the target value.
export function useCountUp(target, { duration = 700 } = {}) {
  const [value, setValue] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const numericTarget = Number(target) || 0;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      setValue(numericTarget);
      return undefined;
    }
    const start = performance.now();
    const from = 0;
    function tick(now) {
      const elapsed = now - start;
      // Clamp to [0, 1]: a backgrounded tab or an odd clock reading can
      // otherwise send `elapsed` outside the expected range and make the
      // eased value (and therefore the displayed number) overshoot or go
      // negative.
      const t = Math.min(1, Math.max(0, elapsed / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (numericTarget - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}
