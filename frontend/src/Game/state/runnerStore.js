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

const STUMBLE_MS = 720;
const INVULN_MS = 1500;
const HIT_STOP_MS = 95;

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

  isStumbling: false,
  stumbleUntil: 0,
  stumbleStartedAt: 0,
  invincibleUntil: 0,
  hitStopUntil: 0,
  speedScale: 1,
  shake: 0,
  resolvedIds: {},

  exploreInputX: 0,
  exploreInputZ: 0,
  facingYaw: 0,
  lookYaw: 0,
  lookPitch: 0.42,
  doorOpen: 0,
  enterProgress: 0,
  nearMission: false,
  campusSnapshot: null,

  moveLeft: () => {
    const idx = Math.max(0, get().laneIndex - 1);
    set({ laneIndex: idx, targetX: LANES[idx] });
  },
  moveRight: () => {
    const idx = Math.min(LAST_LANE, get().laneIndex + 1);
    set({ laneIndex: idx, targetX: LANES[idx] });
  },
  jump: () => {
    const { isJumping, isSliding, isStumbling, stumbleUntil } = get();
    if (isJumping || isSliding) return;
    if (isStumbling && performance.now() < stumbleUntil) return;
    set({ isJumping: true });
  },
  slide: () => {
    const { isJumping, isStumbling, stumbleUntil } = get();
    if (isJumping) return;
    if (isStumbling && performance.now() < stumbleUntil) return;
    set({ isSliding: true });
  },
  endJump: () => set({ isJumping: false }),
  endSlide: () => set({ isSliding: false }),

  beginStumble: (now = performance.now()) =>
    set({
      isStumbling: true,
      isJumping: false,
      isSliding: false,
      stumbleStartedAt: now,
      stumbleUntil: now + STUMBLE_MS,
      invincibleUntil: now + INVULN_MS,
      hitStopUntil: now + HIT_STOP_MS,
      speedScale: 0.1,
      shake: 1.2,
    }),

  endStumble: () => set({ isStumbling: false }),

  pulseShake: (amount) => set({ shake: Math.max(get().shake, amount) }),
  setShake: (shake) => set({ shake }),
  setSpeedScale: (speedScale) => set({ speedScale }),

  setExploreInput: (x, z) => set({ exploreInputX: x, exploreInputZ: z }),
  setFacingYaw: (facingYaw) => set({ facingYaw }),
  setLook: (lookYaw, lookPitch) => set({ lookYaw, lookPitch }),
  addLookDelta: (dx, dy) => {
    const yaw = get().lookYaw - dx * 0.005;
    const pitch = Math.min(1.12, Math.max(0.1, get().lookPitch + dy * 0.0042));
    set({ lookYaw: yaw, lookPitch: pitch });
  },
  setDoorOpen: (doorOpen) => set({ doorOpen }),
  setEnterProgress: (enterProgress) => set({ enterProgress }),
  setNearMission: (nearMission) => set({ nearMission }),

  snapshotCampus: () => {
    const s = get();
    set({
      campusSnapshot: {
        laneIndex: s.laneIndex,
        targetX: s.targetX,
        posX: s.posX,
        posY: s.posY,
        posZ: s.posZ,
      },
    });
  },
  restoreCampus: () => {
    const snap = get().campusSnapshot;
    if (!snap) return;
    set({
      laneIndex: snap.laneIndex,
      targetX: snap.targetX,
      posX: snap.posX,
      posY: snap.posY,
      posZ: snap.posZ,
      exploreInputX: 0,
      exploreInputZ: 0,
      nearMission: false,
      doorOpen: 0,
      enterProgress: 0,
      facingYaw: 0,
      lookYaw: 0,
      lookPitch: 0.42,
    });
  },

  markResolved: (id) =>
    set({ resolvedIds: { ...get().resolvedIds, [id]: true } }),
  isResolved: (id) => Boolean(get().resolvedIds[id]),

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
      isStumbling: false,
      stumbleUntil: 0,
      stumbleStartedAt: 0,
      invincibleUntil: 0,
      hitStopUntil: 0,
      speedScale: 1,
      shake: 0,
      resolvedIds: {},
      exploreInputX: 0,
      exploreInputZ: 0,
      facingYaw: 0,
      lookYaw: 0,
      lookPitch: 0.42,
      doorOpen: 0,
      enterProgress: 0,
      nearMission: false,
      campusSnapshot: null,
    }),
}));
