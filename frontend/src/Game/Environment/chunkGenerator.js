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

function mapDecorations(index, z, rand, map) {
  const decorations = [];
  const id = map?.id || "main-campus";

  function add(kind, side, offset, extra = {}) {
    decorations.push({
      id: `dec-${index}-${decorations.length}`,
      kind,
      side,
      z: extra.z ?? z + 2 + rand() * (CHUNK_LENGTH - 4),
      offset,
      scale: extra.scale ?? 0.9 + rand() * 0.35,
      length: extra.length,
    });
  }

  if (id === "main-campus") {
    if (index > 0) {
      [-1, 1].forEach((side) =>
        add("hedge", side, 6.35, { z: z + CHUNK_LENGTH * 0.5, length: CHUNK_LENGTH * 0.72, scale: 1 })
      );
    }
    const count = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const kind = rand() > 0.55 ? "tree" : rand() > 0.45 ? "bush" : "lamp";
      add(kind, rand() > 0.5 ? 1 : -1, kind === "lamp" ? 6.9 : 8.2 + rand() * 4.2);
    }
    return decorations;
  }

  if (id === "evening-quad") {
    [-1, 1].forEach((side) => {
      add("lamp", side, 6.85, { z: z + CHUNK_LENGTH * 0.22, scale: 1 });
      add("lamp", side, 6.85, { z: z + CHUNK_LENGTH * 0.72, scale: 1 });
      add("planter", side, 7.15, { z: z + CHUNK_LENGTH * 0.48, scale: 1 });
    });
    for (let i = 0; i < 3; i++) {
      add(rand() > 0.4 ? "tree" : "bush", rand() > 0.5 ? 1 : -1, 9.2 + rand() * 3.5);
    }
    return decorations;
  }

  if (id === "rainy-walk") {
    [-1, 1].forEach((side) => {
      add("colonnade", side, 6.55, { z: z + CHUNK_LENGTH * 0.2, scale: 1 });
      add("colonnade", side, 6.55, { z: z + CHUNK_LENGTH * 0.5, scale: 1 });
      add("colonnade", side, 6.55, { z: z + CHUNK_LENGTH * 0.8, scale: 1 });
    });
    const puddles = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < puddles; i++) {
      add("puddle", rand() > 0.5 ? 1 : -1, 5.55 + rand() * 0.5, { scale: 0.7 + rand() * 0.7 });
    }
    add("tree", rand() > 0.5 ? 1 : -1, 9.8 + rand() * 3);
    add("lamp", rand() > 0.5 ? 1 : -1, 6.9, { scale: 1 });
    return decorations;
  }

  if (id === "night-lamps") {
    if (index > 0) {
      [-1, 1].forEach((side) =>
        add("hedge", side, 6.35, { z: z + CHUNK_LENGTH * 0.5, length: CHUNK_LENGTH * 0.72, scale: 1 })
      );
    }
    [-1, 1].forEach((side) => {
      add("lamp", side, 6.8, { z: z + CHUNK_LENGTH * 0.25, scale: 1 });
      add("lamp", side, 6.8, { z: z + CHUNK_LENGTH * 0.75, scale: 1 });
    });
    add("tree", rand() > 0.5 ? 1 : -1, 9.4 + rand() * 3.2, { scale: 1.05 });
    return decorations;
  }

  if (id === "sports-field") {
    [-1, 1].forEach((side) => {
      add("fence", side, 7.15, { z: z + CHUNK_LENGTH * 0.28, scale: 1 });
      add("fence", side, 7.15, { z: z + CHUNK_LENGTH * 0.72, scale: 1 });
      add("bleacher", side, 14.2, { z: z + CHUNK_LENGTH * 0.5, scale: 1 });
    });
    if (index % 2 === 0) {
      add("goal", rand() > 0.5 ? 1 : -1, 12.6, { z: z + CHUNK_LENGTH * 0.5, scale: 1 });
    }
    add("bush", rand() > 0.5 ? 1 : -1, 12.2 + rand() * 2);
    return decorations;
  }

  // lakeside-path — water on +X (side 1)
  [-1, 1].forEach((side) => {
    if (side === 1) {
      add("reed", 1, 12.4, { z: z + CHUNK_LENGTH * 0.22, scale: 1.1 });
      add("reed", 1, 13.2, { z: z + CHUNK_LENGTH * 0.48, scale: 0.95 });
      add("reed", 1, 12.8, { z: z + CHUNK_LENGTH * 0.76, scale: 1.2 });
    } else {
      add("tree", -1, 8.6 + rand() * 3.4, { z: z + CHUNK_LENGTH * 0.3 });
      add("bush", -1, 8.2, { z: z + CHUNK_LENGTH * 0.62 });
      add("lamp", -1, 6.9, { z: z + CHUNK_LENGTH * 0.5, scale: 1 });
    }
  });
  return decorations;
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

  const decorations = mapDecorations(index, z, rand, map);
  const building = buildingForChunkIndex(index);

  return { index, z, obstacles, pickups, decorations, building };
}
