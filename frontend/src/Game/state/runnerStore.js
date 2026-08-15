import { create } from "zustand";

// High-frequency runner/physics state, kept separate from GameStateManager
// so per-frame position updates don't thrash the wider React tree.
// Components that need live position should select narrowly.

// World X offsets for 4 lanes, as seen on screen. The follow camera looks
// down +Z, which flips screen-right to world -X, so "leftmost" maps to the
// largest positive world X offset here. 4 lanes so every question can map
// one lane to each of its (up to 4) answer choices without collapsing any.
export const LANES = [3.3, 1.1, -1.1, -3.3];
export const LANE_NAMES = ["far-left", "left", "right", "far-right"];
const LAST_LANE = LANES.length - 1;

export const useRunnerStore = create((set, get) => ({
  laneIndex: 1, // 0 far-left .. 3 far-right; starts in an inner lane
  targetX: LANES[1],
  posX: 0,
  posY: 0,
  posZ: 0,
  isJumping: false,
  isSliding: false,
  isRunning: true,
  distance: 0,

  moveLeft: () => {
    const idx = Math.max(0, get().laneIndex - 1);
    set({ laneIndex: idx, targetX: LANES[idx] });
  },
  moveRight: () => {
    const idx = Math.min(LAST_LANE, get().laneIndex + 1);
    set({ laneIndex: idx, targetX: LANES[idx] });
  },
  jump: () => {
    if (get().isJumping || get().isSliding) return;
    set({ isJumping: true });
  },
  slide: () => {
    if (get().isJumping) return;
    set({ isSliding: true });
  },
  endJump: () => set({ isJumping: false }),
  endSlide: () => set({ isSliding: false }),

  setPosition: (x, y, z) => set({ posX: x, posY: y, posZ: z }),
  setDistance: (d) => set({ distance: d }),
  setRunning: (v) => set({ isRunning: v }),

  resetToCenter: () => set({ laneIndex: 1, targetX: LANES[1] }),

  resetRun: () =>
    set({
      laneIndex: 1,
      targetX: LANES[1],
      posX: LANES[1],
      posY: 0,
      posZ: 0,
      isJumping: false,
      isSliding: false,
      isRunning: true,
      distance: 0,
    }),
}));
