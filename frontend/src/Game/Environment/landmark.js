import { getBuildingById } from "../data/buildings";
import { getBuildingsInRange } from "./chunkGenerator";

const ROAD_HALF_WIDTH = 3.6;
const LANDMARK_SETBACK = 6.4;
const DOOR_FACE = 3.62;
const NEAR_Z = 22;

export function nearbyDoor(buildingId, fromZ) {
  const config = getBuildingById(buildingId);
  const fallbackSide = config?.laneSide === "left" ? 1 : -1;
  const nearby = getBuildingsInRange(fromZ - NEAR_Z, fromZ + NEAR_Z);
  const match = nearby.find((b) => b.id === buildingId);
  const closest = [...nearby].sort((a, b) => Math.abs(a.z - fromZ) - Math.abs(b.z - fromZ))[0];
  const landmark = match || closest;
  const close = landmark && Math.abs(landmark.z - fromZ) <= NEAR_Z;
  const side = close ? landmark.side : fallbackSide;
  const z = close ? landmark.z : fromZ;
  const x = side * (ROAD_HALF_WIDTH + LANDMARK_SETBACK);
  return {
    side,
    close,
    doorX: x - side * DOOR_FACE,
    doorY: 1.4,
    doorZ: z,
  };
}
