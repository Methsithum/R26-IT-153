import { Text } from "@react-three/drei";
import { useRunnerStore } from "../state/runnerStore";
import { useActiveMap } from "../state/mapStore";
import MissionStations from "./MissionStations";
import { stationKeyFor, missionLocalOffset } from "./stationMap";

export { missionLocalOffset, missionLabel, stationKeyFor } from "./stationMap";

const INTERIOR_X = -55;
export const GROUND_Y = 0;
export const ROOM_W = 28;
export const ROOM_D = 26;
export const WALL_H = 6.8;
const HALF_W = ROOM_W / 2;
const HALF_D = ROOM_D / 2;

export const ROOM_BOUNDS = { minX: -12.4, maxX: 12.4, minZ: -11.2, maxZ: 10.6 };
export const CAM_INNER = { minX: -12.7, maxX: 12.7, minZ: -11.6, maxZ: 11.0 };
export const DOOR_LOCAL_Z = HALF_D + 1.15;
export const APPROACH_Z = DOOR_LOCAL_Z + 2.6;
export const INSIDE_SPAWN_Z = 8.4;
export const ENTER_START_Z = 10.2;

export function interiorAnchor(entryZ) {
  return [INTERIOR_X, 0, entryZ];
}

export function interiorWorld(entryZ, localX, localZ) {
  const [ix, , iz] = interiorAnchor(entryZ);
  return [ix + localX, GROUND_Y, iz + localZ];
}

const THEMES = {
  library: {
    floor: "#7a5433",
    walls: "#f0ddb8",
    ceiling: "#f7ecd4",
    facade: "#ead9b4",
    trim: "#6b4423",
    door: "#5c3818",
    light: "#ffd39a",
    ambient: 15,
    accent: 9,
    windowGlass: "#f0d9a8",
    windowGlow: "#e8b86d",
    windowIntensity: 0.22,
    windows: true,
    lamp: "#ffe2b0",
    name: "#5c4324",
  },
  "lecture-hall": {
    floor: "#4a453c",
    walls: "#c5cec4",
    ceiling: "#d8e0d6",
    facade: "#b7c2b6",
    trim: "#3f5c48",
    door: "#2f4a38",
    light: "#e8f0e4",
    ambient: 19,
    accent: 8,
    windows: false,
    lamp: "#f4f7e8",
    name: "#1f3d2c",
  },
  "exam-hall": {
    floor: "#d5cec0",
    walls: "#ebe4f0",
    ceiling: "#f4eef8",
    facade: "#e4d8ee",
    trim: "#6b4c7a",
    door: "#4c3560",
    light: "#efe6ff",
    ambient: 21,
    accent: 8,
    windowGlass: "#ddd6f0",
    windowGlow: "#c4b5e0",
    windowIntensity: 0.32,
    windows: true,
    lamp: "#f3e8ff",
    name: "#4a2c5a",
  },
  "faculty-science": {
    floor: "#8e9ba4",
    walls: "#d5e3ec",
    ceiling: "#eaf2f6",
    facade: "#c5d8e4",
    trim: "#3d5a73",
    door: "#2c4a60",
    light: "#d7eefe",
    ambient: 20,
    accent: 10,
    windowGlass: "#b8dff0",
    windowGlow: "#7ec8e8",
    windowIntensity: 0.55,
    windows: true,
    lamp: "#e8f6ff",
    name: "#1e3a5f",
  },
  "faculty-arts": {
    floor: "#c4a484",
    walls: "#f3ddd6",
    ceiling: "#faeee8",
    facade: "#edd4cc",
    trim: "#8f4a4a",
    door: "#6b3030",
    light: "#ffe4d6",
    ambient: 17,
    accent: 9,
    windowGlass: "#f5cfc4",
    windowGlow: "#e8a090",
    windowIntensity: 0.34,
    windows: true,
    lamp: "#ffe8dc",
    name: "#6b3030",
  },
};

function Wood({ args, position, color = "#8b5a32", rotation }) {
  return (
    <mesh castShadow receiveShadow position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}

function WindowPane({ position, theme }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[2.55, 2.75, 0.12]} />
        <meshStandardMaterial color={theme.facade} roughness={0.8} />
      </mesh>
      <mesh>
        <planeGeometry args={[2.2, 2.4]} />
        <meshStandardMaterial
          color={theme.windowGlass}
          emissive={theme.windowGlow}
          emissiveIntensity={theme.windowIntensity}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.06, 2.4, 0.04]} />
        <meshStandardMaterial color={theme.trim} />
      </mesh>
      <mesh position={[0, 0, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.06, 2.2, 0.04]} />
        <meshStandardMaterial color={theme.trim} />
      </mesh>
    </group>
  );
}

function Bookshelf({ position, rotationY = 0 }) {
  const books = [
    ["#b45309", 0.18],
    ["#1e3a5f", 0.16],
    ["#7f1d1d", 0.2],
    ["#365314", 0.14],
    ["#92400e", 0.18],
    ["#44403c", 0.15],
  ];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Wood args={[1.7, 3.35, 0.48]} position={[0, 1.68, 0]} color="#6f4424" />
      {[-1.18, -0.22, 0.72, 1.55].map((y) => (
        <Wood key={y} args={[1.58, 0.07, 0.44]} position={[0, 1.68 + y, 0.02]} color="#8a5a32" />
      ))}
      {books.map(([color, w], i) => (
        <mesh key={i} position={[-0.58 + i * 0.23, 2.05, 0.12]}>
          <boxGeometry args={[w, 0.44, 0.2]} />
          <meshStandardMaterial color={color} roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function Desk({ position, width = 2.6, color = "#9a6a3a" }) {
  return (
    <group position={position}>
      <Wood args={[width, 0.12, 1.15]} position={[0, 0.82, 0]} color={color} />
      <Wood args={[0.12, 0.82, 1.05]} position={[-width / 2 + 0.12, 0.41, 0]} />
      <Wood args={[0.12, 0.82, 1.05]} position={[width / 2 - 0.12, 0.41, 0]} />
    </group>
  );
}

function Rug({ position, args, color }) {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <planeGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function PictureFrame({ position, rotationY, color, w = 1.1, h = 0.85 }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh>
        <boxGeometry args={[w, h, 0.06]} />
        <meshStandardMaterial color="#5c3818" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[w - 0.16, h - 0.16, 0.02]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
    </group>
  );
}

function RoomLights({ theme }) {
  return (
    <>
      <pointLight position={[0, 5.8, 0]} intensity={theme.ambient} distance={28} color={theme.light} />
      <pointLight position={[-7, 5.2, -6]} intensity={theme.accent} distance={16} color={theme.light} />
      <pointLight position={[7, 5.2, 4]} intensity={theme.accent} distance={16} color={theme.light} />
      {[-8, -2.5, 2.5, 8].map((lx) => (
        <mesh key={lx} position={[lx, 6.35, -2]}>
          <sphereGeometry args={[0.16, 10, 10]} />
          <meshStandardMaterial color={theme.lamp} emissive={theme.lamp} emissiveIntensity={1.15} />
        </mesh>
      ))}
    </>
  );
}

function LibrarySet() {
  return (
    <>
      <Rug position={[0, 0.02, 0]} args={[4.2, 18]} color="#6b3a22" />
      {[-11.35, 11.35].map((x) =>
        [-10.2, -4.2, 2.2, 8.4].map((z) => {
          if (x < 0 && z < -7) return null;
          return <Bookshelf key={`${x}-${z}`} position={[x, 0, z]} />;
        })
      )}
      <Wood args={[2.2, 0.08, 1.1]} position={[-3.2, 0.42, -5.4]} color="#8a5a32" />
      <Wood args={[0.08, 0.42, 0.08]} position={[-4.15, 0.21, -5.85]} color="#6f4424" />
      <Wood args={[0.08, 0.42, 0.08]} position={[-2.25, 0.21, -5.0]} color="#6f4424" />
      <mesh position={[-3.2, 0.52, -5.35]}>
        <cylinderGeometry args={[0.12, 0.14, 0.16, 12]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
      {[-6, 6].map((x) => (
        <mesh key={x} position={[x, 5.55, 1.5]}>
          <sphereGeometry args={[0.14, 10, 10]} />
          <meshStandardMaterial color="#ffe2b0" emissive="#ffd39a" emissiveIntensity={1.3} />
        </mesh>
      ))}
    </>
  );
}

function LectureSet() {
  return (
    <>
      <mesh position={[0, 0.14, -11.05]} receiveShadow>
        <boxGeometry args={[16, 0.28, 3.4]} />
        <meshStandardMaterial color="#5a5348" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.35, -12.82]}>
        <boxGeometry args={[8.4, 2.6, 0.08]} />
        <meshStandardMaterial color="#1f3d2c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 3.35, -12.78]}>
        <boxGeometry args={[7.7, 2.1, 0.04]} />
        <meshStandardMaterial color="#244c36" />
      </mesh>
      <Text position={[0, 4.55, -12.72]} fontSize={0.2} color="#d7e8d4" anchorX="center">
        MAIN LECTURE HALL
      </Text>
      {[-7.1, -3.5, 3.5, 7.1].map((x) =>
        [-2.4, 1.4, 5.2].map((z) => <Desk key={`${x}-${z}`} position={[x, 0, z]} width={2.15} color="#6d5a42" />)
      )}
      <Rug position={[0, 0.025, 1.2]} args={[2.2, 14]} color="#3d4a40" />
      <PictureFrame position={[-13.55, 3.25, 0.8]} rotationY={Math.PI / 2} color="#4d7c0f" w={1.3} h={0.95} />
      <PictureFrame position={[13.55, 3.45, -3.4]} rotationY={-Math.PI / 2} color="#fef3c7" w={1.1} h={1.25} />
      <mesh position={[-7.1, 0.98, -2.05]} rotation={[0.1, 0.4, 0.08]}>
        <boxGeometry args={[0.42, 0.28, 0.22]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
      <mesh position={[3.5, 0.98, 1.65]} rotation={[0.05, -0.3, 0]}>
        <boxGeometry args={[0.38, 0.24, 0.2]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
      <mesh position={[-10.9, 1.12, 8.4]}>
        <cylinderGeometry args={[0.24, 0.3, 0.48, 10]} />
        <meshStandardMaterial color="#3f5c48" />
      </mesh>
      <mesh position={[-10.9, 1.55, 8.4]}>
        <sphereGeometry args={[0.42, 10, 10]} />
        <meshStandardMaterial color="#4d7c0f" />
      </mesh>
      <mesh position={[10.9, 1.12, 8.4]}>
        <cylinderGeometry args={[0.24, 0.3, 0.48, 10]} />
        <meshStandardMaterial color="#3f5c48" />
      </mesh>
      <mesh position={[10.9, 1.55, 8.4]}>
        <sphereGeometry args={[0.4, 10, 10]} />
        <meshStandardMaterial color="#365314" />
      </mesh>
    </>
  );
}

function ExamSet() {
  return (
    <>
      <mesh position={[0, 5.35, -12.78]}>
        <cylinderGeometry args={[0.42, 0.42, 0.08, 24]} />
        <meshStandardMaterial color="#4a2c5a" />
      </mesh>
      <mesh position={[0, 5.35, -12.72]}>
        <cylinderGeometry args={[0.34, 0.34, 0.04, 24]} />
        <meshStandardMaterial color="#f4eef8" />
      </mesh>
      <mesh position={[0, 5.42, -12.7]}>
        <boxGeometry args={[0.04, 0.22, 0.02]} />
        <meshStandardMaterial color="#4a2c5a" />
      </mesh>
      {[-8.2, -4.1, 4.1, 8.2].map((x) =>
        [-4.6, -0.6].map((z) => <Desk key={`${x}-${z}`} position={[x, 0, z]} width={1.85} color="#c9b89a" />)
      )}
      <Rug position={[0, 0.02, 0]} args={[2.4, 16]} color="#cfc4dc" />
    </>
  );
}

function ScienceSet() {
  const bottles = [
    [10.4, 1.35, 7.2, "#365314", 0.22],
    [10.7, 1.28, 7.35, "#1e3a5f", 0.16],
    [10.55, 1.4, 6.95, "#9a3412", 0.18],
  ];
  return (
    <>
      <Wood args={[2.4, 1.05, 0.85]} position={[10.6, 0.52, 7.1]} color="#4a6578" />
      <Wood args={[2.4, 1.05, 0.85]} position={[-10.6, 0.52, 6.4]} color="#4a6578" />
      {bottles.map(([x, y, z, color, h], i) => (
        <mesh key={i} position={[x, y, z]}>
          <cylinderGeometry args={[0.07, 0.08, h, 8]} />
          <meshStandardMaterial color={color} transparent opacity={0.72} roughness={0.15} />
        </mesh>
      ))}
      <Wood args={[1.8, 1.9, 0.5]} position={[-10.8, 0.95, -9.6]} color="#3d5a73" />
      <mesh position={[-10.8, 1.05, -9.32]}>
        <boxGeometry args={[1.4, 1.2, 0.04]} />
        <meshStandardMaterial color="#9fd6ea" transparent opacity={0.35} roughness={0.1} />
      </mesh>
      <Rug position={[0, 0.02, 0]} args={[6, 14]} color="#6d7c86" />
      <Wood args={[1.8, 0.72, 0.7]} position={[10.5, 0.36, -6.4]} color="#4a6578" />
      <mesh position={[10.1, 0.95, -6.2]} rotation={[0.2, 0.1, 0]}>
        <cylinderGeometry args={[0.08, 0.09, 0.28, 8]} />
        <meshStandardMaterial color="#1e3a5f" transparent opacity={0.7} roughness={0.12} />
      </mesh>
      <PictureFrame position={[-13.55, 3.3, 1.6]} rotationY={Math.PI / 2} color="#7ec8e8" w={1.35} h={0.9} />
      <mesh position={[-8.6, 0.42, 3.2]}>
        <cylinderGeometry args={[0.16, 0.18, 0.5, 10]} />
        <meshStandardMaterial color="#3d5a73" />
      </mesh>
      <mesh position={[6.4, 0.42, 6.8]}>
        <cylinderGeometry args={[0.16, 0.18, 0.5, 10]} />
        <meshStandardMaterial color="#3d5a73" />
      </mesh>
    </>
  );
}

function ArtsSet() {
  return (
    <>
      <PictureFrame position={[-4.8, 3.4, -12.78]} rotationY={0} color="#c98f8f" w={1.4} h={1.05} />
      <PictureFrame position={[4.8, 3.15, -12.78]} rotationY={0} color="#8fa6c9" w={1.15} h={1.35} />
      <PictureFrame position={[13.55, 3.5, -6.2]} rotationY={-Math.PI / 2} color="#c9a26a" w={1.2} h={0.9} />
      <Wood args={[0.08, 1.35, 0.08]} position={[2.6, 0.68, 6.4]} color="#5c3818" />
      <mesh position={[2.6, 1.55, 6.4]} rotation={[0, 0.4, 0.08]}>
        <boxGeometry args={[0.7, 0.85, 0.04]} />
        <meshStandardMaterial color="#f4efe4" />
      </mesh>
      <mesh position={[-10.8, 1.15, 8.5]}>
        <cylinderGeometry args={[0.26, 0.32, 0.5, 10]} />
        <meshStandardMaterial color="#6b3030" />
      </mesh>
      <mesh position={[-10.8, 1.62, 8.5]}>
        <sphereGeometry args={[0.48, 10, 10]} />
        <meshStandardMaterial color="#4d7c0f" />
      </mesh>
      <Rug position={[-1.5, 0.02, 2]} args={[7.5, 8]} color="#b07a62" />
      <PictureFrame position={[-13.55, 3.55, -1.2]} rotationY={Math.PI / 2} color="#edd4cc" w={1.05} h={1.3} />
      <PictureFrame position={[13.55, 2.9, 7.2]} rotationY={-Math.PI / 2} color="#c98f8f" w={0.95} h={0.8} />
      <Wood args={[0.08, 1.2, 0.08]} position={[-7.4, 0.6, 6.8]} color="#5c3818" />
      <mesh position={[-7.4, 1.38, 6.8]} rotation={[0, -0.5, -0.06]}>
        <boxGeometry args={[0.62, 0.78, 0.04]} />
        <meshStandardMaterial color="#faeee8" />
      </mesh>
      <Wood args={[1.8, 0.12, 0.9]} position={[8.6, 0.42, -4.8]} color="#8f4a4a" />
    </>
  );
}

function DoubleDoors({ color }) {
  const doorOpen = useRunnerStore((s) => s.doorOpen);
  const angle = doorOpen * 1.45;

  return (
    <group position={[0, 0, HALF_D - 0.12]}>
      <group position={[-1.06, 0, 0]} rotation={[0, -angle, 0]}>
        <mesh castShadow position={[0.52, 1.28, 0]}>
          <boxGeometry args={[1.04, 2.55, 0.09]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
        <mesh position={[0.9, 1.28, 0.05]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#d4b483" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
      <group position={[1.06, 0, 0]} rotation={[0, angle, 0]}>
        <mesh castShadow position={[-0.52, 1.28, 0]}>
          <boxGeometry args={[1.04, 2.55, 0.09]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
        <mesh position={[-0.9, 1.28, 0.05]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#d4b483" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function CourtyardTree({ position, canopy, trunk, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 1.4, 8]} />
        <meshStandardMaterial color={trunk} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.9, 0]}>
        <sphereGeometry args={[0.9, 10, 8]} />
        <meshStandardMaterial color={canopy} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0.4, 1.55, 0.12]}>
        <sphereGeometry args={[0.52, 8, 8]} />
        <meshStandardMaterial color={canopy} roughness={0.88} />
      </mesh>
    </group>
  );
}

function CourtyardLamp({ position, glow = 0.85 }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.12, 10]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 2.5, 8]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.48, 0.28]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#ffe9a8" emissive="#ffd27a" emissiveIntensity={glow} />
      </mesh>
      <pointLight position={[0, 2.45, 0.28]} intensity={glow * 3.2} distance={8} color="#ffd27a" />
    </group>
  );
}

function Planter({ position, hedge, canopy }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[1.05, 0.44, 0.72]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.38, 8, 8]} />
        <meshStandardMaterial color={hedge} roughness={0.95} />
      </mesh>
      <mesh position={[0.18, 0.52, 0.1]}>
        <sphereGeometry args={[0.24, 8, 8]} />
        <meshStandardMaterial color={canopy} roughness={0.95} />
      </mesh>
    </group>
  );
}

function EntranceForecourt({ name, theme }) {
  const map = useActiveMap();
  const z = HALF_D - 0.08;
  const sideW = (ROOM_W - 2.2) / 2;
  const grass = map?.grass || "#4e8c45";
  const grassDark = map?.grassDark || "#3a6c34";
  const walk = map?.sidewalk || "#ddd3c4";
  const curb = map?.curb || theme.trim;
  const hedge = map?.hedge || "#2d5c2a";
  const canopy = map?.treeCanopy || "#3b7a38";
  const trunk = map?.treeTrunk || "#6b452c";

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, z + 9]}>
        <planeGeometry args={[46, 28]} />
        <meshStandardMaterial color={grassDark} roughness={0.98} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, z + 8.2]}>
        <planeGeometry args={[38, 22]} />
        <meshStandardMaterial color={grass} roughness={0.96} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, z + 6.4]}>
        <planeGeometry args={[16.5, 13.5]} />
        <meshStandardMaterial color={walk} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[0, 0.05, z + 4.2]}>
        <boxGeometry args={[4.4, 0.1, 8.4]} />
        <meshStandardMaterial color={curb} roughness={0.78} />
      </mesh>
      {[0.55, 1.05, 1.55].map((step, i) => (
        <mesh key={step} receiveShadow position={[0, 0.08 + i * 0.09, z + step]}>
          <boxGeometry args={[3.4 - i * 0.15, 0.16, 0.46]} />
          <meshStandardMaterial color={theme.trim} roughness={0.7} />
        </mesh>
      ))}

      <mesh position={[-(1.1 + sideW / 2), WALL_H / 2, z - 0.35]}>
        <boxGeometry args={[sideW, WALL_H, 1.1]} />
        <meshStandardMaterial color={theme.facade} roughness={0.85} />
      </mesh>
      <mesh position={[1.1 + sideW / 2, WALL_H / 2, z - 0.35]}>
        <boxGeometry args={[sideW, WALL_H, 1.1]} />
        <meshStandardMaterial color={theme.facade} roughness={0.85} />
      </mesh>
      <mesh position={[0, 4.85, z + 0.02]}>
        <boxGeometry args={[2.3, 2.1, 0.5]} />
        <meshStandardMaterial color={theme.walls} />
      </mesh>
      <mesh position={[0, WALL_H + 2.15, z - 0.55]}>
        <boxGeometry args={[ROOM_W + 0.8, 4.4, 2.4]} />
        <meshStandardMaterial color={theme.facade} roughness={0.88} />
      </mesh>
      <mesh position={[0, WALL_H + 4.45, z - 0.35]}>
        <boxGeometry args={[ROOM_W + 1.6, 0.32, 3.2]} />
        <meshStandardMaterial color={theme.trim} roughness={0.55} metalness={0.12} />
      </mesh>
      {[-10, -5, 5, 10].map((x) => (
        <mesh key={`win-${x}`} position={[x, WALL_H + 2.05, z + 0.68]}>
          <boxGeometry args={[1.35, 1.15, 0.08]} />
          <meshStandardMaterial
            color={theme.windowGlass || "#d7e8f4"}
            emissive={theme.windowGlow || "#fde68a"}
            emissiveIntensity={(theme.windowIntensity || 0.2) + 0.15}
            roughness={0.22}
          />
        </mesh>
      ))}

      <mesh position={[0, 5.42, z + 1.55]}>
        <boxGeometry args={[8.4, 0.18, 3.4]} />
        <meshStandardMaterial color={theme.trim} roughness={0.5} />
      </mesh>
      <mesh position={[-3.7, 2.7, z + 1.55]}>
        <boxGeometry args={[0.28, 5.4, 0.28]} />
        <meshStandardMaterial color={theme.trim} />
      </mesh>
      <mesh position={[3.7, 2.7, z + 1.55]}>
        <boxGeometry args={[0.28, 5.4, 0.28]} />
        <meshStandardMaterial color={theme.trim} />
      </mesh>
      <mesh position={[-1.45, 1.55, z + 0.42]}>
        <cylinderGeometry args={[0.18, 0.2, 3.1, 10]} />
        <meshStandardMaterial color={theme.trim} />
      </mesh>
      <mesh position={[1.45, 1.55, z + 0.42]}>
        <cylinderGeometry args={[0.18, 0.2, 3.1, 10]} />
        <meshStandardMaterial color={theme.trim} />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={`wing-${side}`} position={[side * 10.4, 1.05, z + 3.4]}>
          <boxGeometry args={[0.38, 2.1, 6.6]} />
          <meshStandardMaterial color={theme.trim} roughness={0.8} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`hedge-${side}`} position={[side * 8.2, 0.46, z + 5.8]}>
          <boxGeometry args={[0.7, 0.92, 8.4]} />
          <meshStandardMaterial color={hedge} roughness={0.95} />
        </mesh>
      ))}

      <Planter position={[-3.15, 0, z + 2.35]} hedge={hedge} canopy={canopy} />
      <Planter position={[3.15, 0, z + 2.35]} hedge={hedge} canopy={canopy} />
      <CourtyardLamp position={[-4.6, 0, z + 3.6]} glow={Math.max(0.7, map?.lampEmissive || 0.8)} />
      <CourtyardLamp position={[4.6, 0, z + 3.6]} glow={Math.max(0.7, map?.lampEmissive || 0.8)} />
      <CourtyardTree position={[-12.4, 0, z + 6.2]} canopy={canopy} trunk={trunk} scale={1.15} />
      <CourtyardTree position={[12.4, 0, z + 6.2]} canopy={canopy} trunk={trunk} scale={1.08} />
      <CourtyardTree position={[-11.2, 0, z + 10.4]} canopy={canopy} trunk={trunk} scale={0.92} />
      <CourtyardTree position={[11.2, 0, z + 10.4]} canopy={canopy} trunk={trunk} scale={1} />

      <mesh position={[0, 5.58, z + 0.55]}>
        <boxGeometry args={[4.2, 0.28, 0.9]} />
        <meshStandardMaterial color={theme.trim} />
      </mesh>
      <pointLight position={[0, 3.15, z + 2.4]} intensity={16} distance={18} color={theme.light} />
      <Text position={[0, 5.58, z + 1.02]} fontSize={0.22} color={theme.name} anchorX="center" anchorY="middle" maxWidth={4.2}>
        {name}
      </Text>
    </group>
  );
}

function FloorGuide({ toX, toZ }) {
  const fromZ = 8.2;
  const steps = 5;
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => {
        const t = (i + 1) / (steps + 1);
        return (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, Math.atan2(toX, toZ - fromZ)]}
            position={[toX * t, 0.03, fromZ + (toZ - fromZ) * t]}
          >
            <ringGeometry args={[0.12, 0.22, 3]} />
            <meshBasicMaterial color="#f5d76e" transparent opacity={0.42} />
          </mesh>
        );
      })}
    </group>
  );
}

function furnitureFor(id) {
  if (id === "library") return <LibrarySet />;
  if (id === "lecture-hall") return <LectureSet />;
  if (id === "exam-hall") return <ExamSet />;
  if (id === "faculty-science") return <ScienceSet />;
  return <ArtsSet />;
}

export default function BuildingInterior({ entryZ, building, question, exploring, saved }) {
  const [x, , z] = interiorAnchor(entryZ);
  const name = building?.name ?? "Campus Building";
  const id = building?.id || "library";
  const theme = THEMES[id] || THEMES.library;
  const activeKey = stationKeyFor(question, id);
  const [mx, , mz] = missionLocalOffset(question, id);

  return (
    <group position={[x, 0, z]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={theme.floor} roughness={0.9} />
      </mesh>
      <mesh position={[0, WALL_H, 0]}>
        <boxGeometry args={[ROOM_W, 0.18, ROOM_D]} />
        <meshStandardMaterial color={theme.ceiling} />
      </mesh>
      <mesh position={[0, WALL_H / 2, -HALF_D + 0.1]}>
        <boxGeometry args={[ROOM_W, WALL_H, 0.28]} />
        <meshStandardMaterial color={theme.walls} roughness={0.85} />
      </mesh>
      <mesh position={[-HALF_W + 0.1, WALL_H / 2, 0]}>
        <boxGeometry args={[0.28, WALL_H, ROOM_D]} />
        <meshStandardMaterial color={theme.walls} />
      </mesh>
      <mesh position={[HALF_W - 0.1, WALL_H / 2, 0]}>
        <boxGeometry args={[0.28, WALL_H, ROOM_D]} />
        <meshStandardMaterial color={theme.walls} />
      </mesh>

      {theme.windows && (
        <>
          <WindowPane position={[-8, 3.35, -HALF_D + 0.22]} theme={theme} />
          <WindowPane position={[-4, 3.35, -HALF_D + 0.22]} theme={theme} />
          <WindowPane position={[4, 3.35, -HALF_D + 0.22]} theme={theme} />
          <WindowPane position={[8, 3.35, -HALF_D + 0.22]} theme={theme} />
        </>
      )}

      <EntranceForecourt name={name} theme={theme} />
      <DoubleDoors color={theme.door} />

      {furnitureFor(id)}
      <MissionStations buildingId={id} activeKey={activeKey} exploring={exploring} saved={saved} />
      {exploring && <FloorGuide toX={mx} toZ={mz} />}
      <RoomLights theme={theme} />
    </group>
  );
}
