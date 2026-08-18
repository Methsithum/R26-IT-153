import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRunnerStore } from "../state/runnerStore";

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
export const INSIDE_SPAWN_Z = 8.4;
export const ENTER_START_Z = 10.2;

export function interiorAnchor(entryZ) {
  return [INTERIOR_X, 0, entryZ];
}

export function interiorWorld(entryZ, localX, localZ) {
  const [ix, , iz] = interiorAnchor(entryZ);
  return [ix + localX, GROUND_Y, iz + localZ];
}

export function missionLocalOffset(buildingId) {
  if (buildingId === "lecture-hall") return [0, 0, -7.2];
  if (buildingId === "exam-hall") return [0, 0, -6.8];
  if (buildingId === "library") return [0, 0, -8.4];
  return [0, 0, -8.2];
}

export function missionLabel(interactionType) {
  if (interactionType === "date" || interactionType === "examDate") return "Calendar";
  if (interactionType === "marks") return "Marks desk";
  if (interactionType === "subjectPick") return "Subject board";
  if (interactionType === "examSetup") return "Exam desk";
  if (interactionType === "markTarget") return "Records desk";
  return "Front desk";
}

function Wood({ args, position, color = "#8b5a32", rotation }) {
  return (
    <mesh castShadow receiveShadow position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}

function WindowPane({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[2.55, 2.75, 0.12]} />
        <meshStandardMaterial color="#efe6d4" roughness={0.8} />
      </mesh>
      <mesh>
        <planeGeometry args={[2.2, 2.4]} />
        <meshStandardMaterial color="#c5def0" emissive="#8ec4e8" emissiveIntensity={0.45} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.06, 2.4, 0.04]} />
        <meshStandardMaterial color="#f4ece0" />
      </mesh>
      <mesh position={[0, 0, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.06, 2.2, 0.04]} />
        <meshStandardMaterial color="#f4ece0" />
      </mesh>
    </group>
  );
}

function Bookshelf({ position }) {
  const books = [
    ["#b45309", 0.18],
    ["#1e3a5f", 0.16],
    ["#7f1d1d", 0.2],
    ["#365314", 0.14],
    ["#92400e", 0.18],
    ["#44403c", 0.15],
  ];
  return (
    <group position={position}>
      <Wood args={[1.6, 3.2, 0.45]} position={[0, 1.6, 0]} color="#6f4424" />
      {[-1.1, -0.15, 0.8].map((y) => (
        <Wood key={y} args={[1.5, 0.08, 0.42]} position={[0, 1.6 + y, 0.02]} color="#8a5a32" />
      ))}
      {books.map(([color, w], i) => (
        <mesh key={i} position={[-0.55 + i * 0.22, 1.95, 0.12]}>
          <boxGeometry args={[w, 0.42, 0.18]} />
          <meshStandardMaterial color={color} roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function Desk({ position, width = 2.6 }) {
  return (
    <group position={position}>
      <Wood args={[width, 0.12, 1.15]} position={[0, 0.82, 0]} color="#9a6a3a" />
      <Wood args={[0.12, 0.82, 1.05]} position={[-width / 2 + 0.12, 0.41, 0]} />
      <Wood args={[0.12, 0.82, 1.05]} position={[width / 2 - 0.12, 0.41, 0]} />
    </group>
  );
}

function RoomLights() {
  return (
    <>
      <pointLight position={[0, 5.8, 0]} intensity={22} distance={28} color="#fff4dc" />
      <pointLight position={[-7, 5.2, -6]} intensity={10} distance={16} color="#ffe9c4" />
      <pointLight position={[7, 5.2, 4]} intensity={10} distance={16} color="#ffe9c4" />
      {[-8, -2.5, 2.5, 8].map((lx) => (
        <mesh key={lx} position={[lx, 6.35, -2]}>
          <sphereGeometry args={[0.16, 10, 10]} />
          <meshStandardMaterial color="#fff6d8" emissive="#ffe7a8" emissiveIntensity={1.2} />
        </mesh>
      ))}
    </>
  );
}

function LibrarySet() {
  const shelfXs = [-11.2, -9.4, -7.6, 7.6, 9.4, 11.2];
  const shelfZs = [-10.4, -7.6, -4.8];
  return (
    <>
      {shelfXs.map((x) =>
        shelfZs.map((z) => <Bookshelf key={`${x}-${z}`} position={[x, 0, z]} />)
      )}
      <Desk position={[-4.2, 0, -2.2]} width={2.8} />
      <Desk position={[4.2, 0, -2.2]} width={2.8} />
      <Desk position={[0, 0, -8.4]} width={3.4} />
      <Bookshelf position={[-2.2, 0, -10.6]} />
      <Bookshelf position={[2.2, 0, -10.6]} />
    </>
  );
}

function LectureSet() {
  return (
    <>
      <mesh position={[0, 2.7, -12.55]}>
        <planeGeometry args={[8.4, 2.6]} />
        <meshStandardMaterial color="#f7f4ec" roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.7, -12.62]}>
        <boxGeometry args={[8.8, 2.85, 0.08]} />
        <meshStandardMaterial color="#d6cbb6" />
      </mesh>
      {[-6, -2, 2, 6].map((x) =>
        [-1.2, 2.2, 5.6].map((z) => <Desk key={`${x}-${z}`} position={[x, 0, z]} width={2.2} />)
      )}
      <Desk position={[0, 0, -7.2]} width={3.2} />
    </>
  );
}

function FacultySet() {
  return (
    <>
      <Desk position={[0, 0, -8.2]} width={3.6} />
      <Desk position={[-6.5, 0, -3]} width={2.4} />
      <Desk position={[6.5, 0, -3]} width={2.4} />
      <Desk position={[-6.5, 0, 3.6]} width={2.4} />
      <Desk position={[6.5, 0, 3.6]} width={2.4} />
      <Wood args={[1.6, 1.8, 0.45]} position={[11.2, 0.9, -10.2]} color="#7a4e28" />
      <Wood args={[1.6, 1.8, 0.45]} position={[9.4, 0.9, -10.2]} color="#7a4e28" />
      <Wood args={[1.6, 1.8, 0.45]} position={[-11.2, 0.9, 8.8]} color="#7a4e28" />
      <Wood args={[1.6, 1.8, 0.45]} position={[-9.4, 0.9, 8.8]} color="#7a4e28" />
      <mesh position={[-10.8, 1.15, -10]}>
        <cylinderGeometry args={[0.28, 0.34, 0.55, 10]} />
        <meshStandardMaterial color="#3f6212" />
      </mesh>
      <mesh position={[-10.8, 1.6, -10]}>
        <sphereGeometry args={[0.46, 10, 10]} />
        <meshStandardMaterial color="#4d7c0f" />
      </mesh>
    </>
  );
}

function ExamSet() {
  return (
    <>
      {[-7.2, -2.4, 2.4, 7.2].map((x) =>
        [-3.4, 0.4, 4.2].map((z) => <Desk key={`${x}-${z}`} position={[x, 0, z]} width={1.9} />)
      )}
      <Desk position={[0, 0, -6.8]} width={2.6} />
    </>
  );
}

function DoubleDoors() {
  const doorOpen = useRunnerStore((s) => s.doorOpen);
  const angle = doorOpen * 1.45;

  return (
    <group position={[0, 0, HALF_D - 0.12]}>
      <group position={[-1.06, 0, 0]} rotation={[0, -angle, 0]}>
        <mesh castShadow position={[0.52, 1.28, 0]}>
          <boxGeometry args={[1.04, 2.55, 0.09]} />
          <meshStandardMaterial color="#6d3f22" roughness={0.55} />
        </mesh>
        <mesh position={[0.9, 1.28, 0.05]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#d4b483" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
      <group position={[1.06, 0, 0]} rotation={[0, angle, 0]}>
        <mesh castShadow position={[-0.52, 1.28, 0]}>
          <boxGeometry args={[1.04, 2.55, 0.09]} />
          <meshStandardMaterial color="#6d3f22" roughness={0.55} />
        </mesh>
        <mesh position={[-0.9, 1.28, 0.05]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#d4b483" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function EntranceFacade({ name }) {
  const z = HALF_D - 0.08;
  const sideW = (ROOM_W - 2.2) / 2;
  return (
    <group>
      <mesh position={[-(1.1 + sideW / 2), WALL_H / 2, z]}>
        <boxGeometry args={[sideW, WALL_H, 0.3]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.85} />
      </mesh>
      <mesh position={[1.1 + sideW / 2, WALL_H / 2, z]}>
        <boxGeometry args={[sideW, WALL_H, 0.3]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.85} />
      </mesh>
      <mesh position={[0, 4.85, z + 0.02]}>
        <boxGeometry args={[2.3, 2.1, 0.34]} />
        <meshStandardMaterial color="#e8dcc8" />
      </mesh>
      <mesh position={[-1.45, 1.55, z + 0.18]}>
        <cylinderGeometry args={[0.16, 0.18, 3.1, 10]} />
        <meshStandardMaterial color="#d8c4a4" />
      </mesh>
      <mesh position={[1.45, 1.55, z + 0.18]}>
        <cylinderGeometry args={[0.16, 0.18, 3.1, 10]} />
        <meshStandardMaterial color="#d8c4a4" />
      </mesh>
      <mesh position={[0, 0.12, z + 0.85]} receiveShadow>
        <boxGeometry args={[3.2, 0.24, 1.6]} />
        <meshStandardMaterial color="#b9a888" />
      </mesh>
      <mesh position={[0, 5.55, z + 0.22]}>
        <boxGeometry args={[3.6, 0.22, 0.7]} />
        <meshStandardMaterial color="#c9a26a" />
      </mesh>
      <pointLight position={[0, 3.2, z + 2.1]} intensity={14} distance={16} color="#fff1d6" />
      <Text position={[0, 5.55, z + 0.6]} fontSize={0.22} color="#5c4324" anchorX="center" anchorY="middle" maxWidth={4}>
        {name}
      </Text>
    </group>
  );
}

function FloorGuide({ toZ }) {
  const marks = [8.5, 5.5, 2.5, -0.5, -3.5];
  return (
    <group>
      {marks
        .filter((z) => z > toZ + 1.2)
        .map((z) => (
          <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, z]}>
            <ringGeometry args={[0.14, 0.26, 3]} />
            <meshBasicMaterial color="#f5d76e" transparent opacity={0.5} />
          </mesh>
        ))}
    </group>
  );
}

function MissionBeacon({ position, label, active }) {
  const glow = useRef();
  const ring = useRef();
  const near = useRunnerStore((s) => s.nearMission);

  useFrame((state) => {
    const pulse = 0.55 + Math.sin(state.clock.elapsedTime * 3.2) * 0.35;
    if (glow.current) {
      glow.current.material.emissiveIntensity = near ? 1.4 : pulse;
      glow.current.position.y = 1.35 + Math.sin(state.clock.elapsedTime * 2.4) * 0.08;
    }
    if (ring.current) {
      ring.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2.8) * 0.08);
    }
  });

  if (!active) return null;

  return (
    <group position={position}>
      <pointLight color="#ffe08a" intensity={near ? 3.2 : 1.6} distance={8} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.75, 1.15, 28]} />
        <meshBasicMaterial color="#f5d76e" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh ref={glow} position={[0, 1.35, 0]}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color="#fff3c4" emissive="#f5d76e" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 0.95, 0.15]}>
        <boxGeometry args={[0.42, 0.08, 0.32]} />
        <meshStandardMaterial color="#f4efe4" emissive="#f5d76e" emissiveIntensity={0.25} />
      </mesh>
      <Text position={[0, 1.85, 0]} fontSize={0.2} color="#fff6d5" anchorX="center" outlineWidth={0.012} outlineColor="#5c4324">
        {label}
      </Text>
    </group>
  );
}

export default function BuildingInterior({ entryZ, building, interactionType, exploring }) {
  const [x, , z] = interiorAnchor(entryZ);
  const name = building?.name ?? "Campus Building";
  const id = building?.id || "";
  const furniture =
    id === "library" ? (
      <LibrarySet />
    ) : id === "lecture-hall" ? (
      <LectureSet />
    ) : id === "exam-hall" ? (
      <ExamSet />
    ) : (
      <FacultySet />
    );
  const [mx, , mz] = missionLocalOffset(id);

  return (
    <group position={[x, 0, z]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#cbb79a" roughness={0.9} />
      </mesh>
      <mesh position={[0, WALL_H, 0]}>
        <boxGeometry args={[ROOM_W, 0.18, ROOM_D]} />
        <meshStandardMaterial color="#f3eee4" />
      </mesh>
      <mesh position={[0, WALL_H / 2, -HALF_D + 0.1]}>
        <boxGeometry args={[ROOM_W, WALL_H, 0.28]} />
        <meshStandardMaterial color="#f2eadc" roughness={0.85} />
      </mesh>
      <mesh position={[-HALF_W + 0.1, WALL_H / 2, 0]}>
        <boxGeometry args={[0.28, WALL_H, ROOM_D]} />
        <meshStandardMaterial color="#efe6d6" />
      </mesh>
      <mesh position={[HALF_W - 0.1, WALL_H / 2, 0]}>
        <boxGeometry args={[0.28, WALL_H, ROOM_D]} />
        <meshStandardMaterial color="#efe6d6" />
      </mesh>

      <WindowPane position={[-8, 3.35, -HALF_D + 0.22]} />
      <WindowPane position={[-4, 3.35, -HALF_D + 0.22]} />
      <WindowPane position={[4, 3.35, -HALF_D + 0.22]} />
      <WindowPane position={[8, 3.35, -HALF_D + 0.22]} />

      <EntranceFacade name={name} />
      <DoubleDoors />

      {furniture}
      <FloorGuide toZ={mz} />
      <MissionBeacon position={[mx, 0, mz]} label={missionLabel(interactionType)} active={exploring} />
      <RoomLights />
    </group>
  );
}
