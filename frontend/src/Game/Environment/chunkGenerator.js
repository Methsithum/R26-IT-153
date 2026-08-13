import { BUILDINGS } from "../data/buildings";

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

export function generateChunk(index) {
  const rand = seededRandom(index * 9973 + 17);
  const z = index * CHUNK_LENGTH;

  const obstacles = [];
  // Keep the first few chunks clear so the player has time to learn controls.
  if (index > 2 && rand() > 0.35) {
    const lane = Math.floor(rand() * 3); // 0 left, 1 center, 2 right
    const kind = OBSTACLE_KINDS[Math.floor(rand() * OBSTACLE_KINDS.length)];
    obstacles.push({
      id: `obs-${index}`,
      lane,
      kind,
      z: z + CHUNK_LENGTH * (0.35 + rand() * 0.4),
    });
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

  return { index, z, obstacles, decorations, building };
}
