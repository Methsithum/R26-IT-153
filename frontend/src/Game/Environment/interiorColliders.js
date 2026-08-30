import { ROOM_BOUNDS } from "./BuildingInterior";
import { layoutFor } from "./stationMap";

const PLAYER_R = 0.5;

function box(x, z, hx, hz) {
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}

function furnitureFor(id) {
  const boxes = [];

  if (id === "library") {
    for (const x of [-11.35, 11.35]) {
      for (const z of [-10.2, -4.2, 2.2, 8.4]) {
        if (x < 0 && z < -7) continue;
        boxes.push(box(x, z, 0.95, 0.42));
      }
    }
    boxes.push(box(-3.2, -5.4, 1.2, 0.65));
  }

  if (id === "lecture-hall") {
    boxes.push(box(0, -11.05, 8.1, 1.45));
    for (const x of [-7.1, -3.5, 3.5, 7.1]) {
      for (const z of [-2.4, 1.4, 5.2]) {
        boxes.push(box(x, z, 1.15, 0.65));
      }
    }
    boxes.push(box(-10.9, 8.4, 0.42, 0.42));
    boxes.push(box(10.9, 8.4, 0.42, 0.42));
  }

  if (id === "exam-hall") {
    for (const x of [-8.2, -4.1, 4.1, 8.2]) {
      for (const z of [-4.6, -0.6]) {
        boxes.push(box(x, z, 1.02, 0.65));
      }
    }
  }

  if (id === "faculty-science") {
    boxes.push(box(10.6, 7.1, 1.28, 0.52));
    boxes.push(box(-10.6, 6.4, 1.28, 0.52));
    boxes.push(box(-10.8, -9.6, 1.0, 0.38));
    boxes.push(box(10.5, -6.4, 1.0, 0.45));
    boxes.push(box(-8.6, 3.2, 0.35, 0.35));
    boxes.push(box(6.4, 6.8, 0.35, 0.35));
  }

  if (id === "faculty-arts") {
    boxes.push(box(2.6, 6.4, 0.42, 0.28));
    boxes.push(box(-7.4, 6.8, 0.42, 0.28));
    boxes.push(box(-10.8, 8.5, 0.48, 0.48));
    boxes.push(box(8.6, -4.8, 1.0, 0.55));
  }

  return boxes;
}

const STATION_SIZE = {
  shelf: [1.52, 0.78],
  abacus: [1.28, 0.68],
  examSort: [1.38, 0.76],
  scale: [1.28, 0.68],
  tickets: [0.78, 0.58],
};

function stationsFor(id) {
  const layout = layoutFor(id);
  const boxes = [];
  for (const [key, spot] of Object.entries(layout)) {
    const size = STATION_SIZE[key];
    if (!size) continue;
    const [hx, hz] = size;
    boxes.push(box(spot.position[0], spot.position[2], hx, hz));
  }
  return boxes;
}

const cache = new Map();

export function interiorObstacles(buildingId) {
  const id = buildingId || "library";
  if (!cache.has(id)) cache.set(id, [...furnitureFor(id), ...stationsFor(id)]);
  return cache.get(id);
}

function hitsLocal(lx, lz, boxes, r) {
  const r2 = r * r;
  for (const b of boxes) {
    const cx = Math.min(b.maxX, Math.max(b.minX, lx));
    const cz = Math.min(b.maxZ, Math.max(b.minZ, lz));
    const dx = lx - cx;
    const dz = lz - cz;
    if (dx * dx + dz * dz < r2) return true;
  }
  return false;
}

function pushOut(lx, lz, boxes, r) {
  let x = lx;
  let z = lz;
  for (let pass = 0; pass < 4; pass += 1) {
    for (const b of boxes) {
      const cx = Math.min(b.maxX, Math.max(b.minX, x));
      const cz = Math.min(b.maxZ, Math.max(b.minZ, z));
      let dx = x - cx;
      let dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-8) {
        const left = x - (b.minX - r);
        const right = b.maxX + r - x;
        const down = z - (b.minZ - r);
        const up = b.maxZ + r - z;
        const nearest = Math.min(left, right, down, up);
        if (nearest === left) x = b.minX - r;
        else if (nearest === right) x = b.maxX + r;
        else if (nearest === down) z = b.minZ - r;
        else z = b.maxZ + r;
      } else {
        const d = Math.sqrt(d2);
        const push = (r - d) / d + 0.001;
        x += dx * push;
        z += dz * push;
      }
    }
  }
  return [x, z];
}

export function resolveInteriorWalk(ax, az, fromX, fromZ, toX, toZ, buildingId) {
  const minX = ax + ROOM_BOUNDS.minX;
  const maxX = ax + ROOM_BOUNDS.maxX;
  const minZ = az + ROOM_BOUNDS.minZ;
  const maxZ = az + ROOM_BOUNDS.maxZ;
  const boxes = interiorObstacles(buildingId);
  const r = PLAYER_R;

  const [clearedX, clearedZ] = pushOut(fromX - ax, fromZ - az, boxes, r);
  const startX = Math.min(maxX, Math.max(minX, ax + clearedX));
  const startZ = Math.min(maxZ, Math.max(minZ, az + clearedZ));

  let tryX = Math.min(maxX, Math.max(minX, toX + (startX - fromX)));
  let tryZ = startZ;
  if (hitsLocal(tryX - ax, tryZ - az, boxes, r)) tryX = startX;

  tryZ = Math.min(maxZ, Math.max(minZ, toZ + (startZ - fromZ)));
  if (hitsLocal(tryX - ax, tryZ - az, boxes, r)) tryZ = startZ;

  if (hitsLocal(tryX - ax, tryZ - az, boxes, r)) return [startX, startZ];
  return [tryX, tryZ];
}
