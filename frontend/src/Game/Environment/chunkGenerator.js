import { BUILDINGS } from "../data/buildings";
import { LANES } from "../state/runnerStore";
import { CLEARANCE_BY_KIND } from "./props";

export const CHUNK_LENGTH = 40;
export const LOOKAHEAD_CHUNKS = 6;
export const BEHIND_CHUNKS = 2;

// Small deterministic PRNG so regenerating a chunk index always yields the
// same layout (avoids pop-in mismatches if a chunk is recreated).
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const OBSTACLE_KINDS = ["bench", "barrier", "sign", "construction"];
const PICKUP_KINDS = ["coffee", "notes"];

// Deterministic building placement, shared by chunk generation and the
// minimap so both agree on where each landmark sits.
export function buildingForChunkIndex(index) {
  if (index <= 1 || index % 3 !== 0) return null;
  const buildingIdx = Math.floor(index / 3) % BUILDINGS.length;
  const config = BUILDINGS[buildingIdx];
  // Screen-right corresponds to world -X under this camera's look direction.
  const side = config.laneSide === "left" ? 1 : -1;
  return { ...config, z: index * CHUNK_LENGTH + CHUNK_LENGTH * 0.5, side };
}

export function getBuildingsInRange(fromZ, toZ) {
  const startIndex = Math.floor(fromZ / CHUNK_LENGTH);
  const endIndex = Math.ceil(toZ / CHUNK_LENGTH);
  const found = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const b = buildingForChunkIndex(i);
    if (b) found.push(b);
  }
  return found;
}

function pickUnusedLane(rand, used) {
  const free = [];
  for (let i = 0; i < LANES.length; i++) {
    if (!used.has(i)) free.push(i);
  }
  if (!free.length) return null;
  return free[Math.floor(rand() * free.length)];
}

export function generateChunk(index, map) {
  const rand = seededRandom(index * 9973 + 17 + (map?.unlockLevel || 0) * 13);
  const z = index * CHUNK_LENGTH;

  const obstacles = [];
  const pickups = [];
  const usedLanes = new Set();

  // Keep the first few chunks clear so the player has time to learn controls.
  if (index > 2) {
    const count = rand() > 0.22 ? (rand() > 0.62 ? 2 : 1) : 0;
    for (let i = 0; i < count; i++) {
      const lane = pickUnusedLane(rand, usedLanes);
      if (lane == null) break;
      usedLanes.add(lane);
      const kind = OBSTACLE_KINDS[Math.floor(rand() * OBSTACLE_KINDS.length)];
      obstacles.push({
        id: `obs-${index}-${i}`,
        lane,
        kind,
        clearance: CLEARANCE_BY_KIND[kind],
        z: z + CHUNK_LENGTH * (0.28 + rand() * 0.5 + i * 0.08),
      });
    }

    if (rand() > 0.42) {
      const lane = pickUnusedLane(rand, usedLanes);
      if (lane != null) {
        pickups.push({
          id: `pick-${index}`,
          lane,
          kind: PICKUP_KINDS[Math.floor(rand() * PICKUP_KINDS.length)],
          z: z + CHUNK_LENGTH * (0.2 + rand() * 0.6),
        });
      }
    }
  }

  const decorations = [];
  const kinds = map?.decor || ["tree", "lamp"];
  const night = map?.id === "night-lamps";
  const hedgeKind = kinds.includes("hedge");
  if (hedgeKind && index > 0) {
    [-1, 1].forEach((side) => {
      decorations.push({
        id: `hedge-${index}-${side}`,
        kind: "hedge",
        side,
        z: z + CHUNK_LENGTH * 0.5,
        offset: 6.35,
        length: CHUNK_LENGTH * 0.72,
      });
    });
  }
  const extra = night ? 5 : 4;
  const decorCount = extra + Math.floor(rand() * 3);
  for (let i = 0; i < decorCount; i++) {
    const side = rand() > 0.5 ? 1 : -1;
    const pool = night ? ["lamp", "lamp", "tree", "bush"] : kinds.filter((k) => k !== "hedge");
    const kind = pool[Math.floor(rand() * pool.length)] || "tree";
    decorations.push({
      id: `dec-${index}-${i}`,
      kind,
      side,
      z: z + 2 + rand() * (CHUNK_LENGTH - 4),
      offset: kind === "fence" ? 7.2 : 7.4 + rand() * 4.5,
      scale: 0.85 + rand() * 0.45,
    });
  }

  const building = buildingForChunkIndex(index);

  return { index, z, obstacles, pickups, decorations, building };
}
