import { create } from "zustand";

// High-frequency runner/physics state, kept separate from GameStateManager
// so per-frame position updates don't thrash the wider React tree.
// Components that need live position should select narrowly.

// World X offsets for [left, center, right] as seen on screen. The follow
// camera looks down +Z, which flips screen-right to world -X, so "left"
// maps to a positive world X offset here.
export const LANES = [2.2, 0, -2.2];
export const LANE_NAMES = ["left", "center", "right"];

export const useRunnerStore = create((set, get) => ({
  laneIndex: 1, // 0 left, 1 center, 2 right
  targetX: 0,
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
    const idx = Math.min(2, get().laneIndex + 1);
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

  resetToCenter: () => set({ laneIndex: 1, targetX: 0 }),
}));
