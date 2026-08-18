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

export function generateChunk(index) {
  const rand = seededRandom(index * 9973 + 17);
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
  const decorCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < decorCount; i++) {
    const side = rand() > 0.5 ? 1 : -1;
    decorations.push({
      id: `dec-${index}-${i}`,
      kind: rand() > 0.5 ? "tree" : "lamp",
      side,
      z: z + rand() * CHUNK_LENGTH,
      offset: 5.5 + rand() * 4,
    });
  }

  const building = buildingForChunkIndex(index);

  return { index, z, obstacles, pickups, decorations, building };
}
