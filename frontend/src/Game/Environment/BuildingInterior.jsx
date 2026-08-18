import { Text } from "@react-three/drei";

const INTERIOR_X = -55;

export function interiorAnchor(entryZ) {
  return [INTERIOR_X, 0, entryZ];
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
      <pointLight position={[0, 5.2, 0]} intensity={18} distance={18} color="#fff4dc" />
      <pointLight position={[-3.2, 4.6, -2]} intensity={8} distance={12} color="#ffe9c4" />
      {[-3.4, 0, 3.4].map((lx) => (
        <mesh key={lx} position={[lx, 5.55, -1]}>
          <sphereGeometry args={[0.16, 10, 10]} />
          <meshStandardMaterial color="#fff6d8" emissive="#ffe7a8" emissiveIntensity={1.2} />
        </mesh>
      ))}
    </>
  );
}

function LibrarySet() {
  return (
    <>
      <Bookshelf position={[-5.4, 0, -4.6]} />
      <Bookshelf position={[-3.6, 0, -4.6]} />
      <Bookshelf position={[3.6, 0, -4.6]} />
      <Bookshelf position={[5.4, 0, -4.6]} />
      <Desk position={[0, 0, -2.6]} width={3.2} />
    </>
  );
}

function LectureSet() {
  return (
    <>
      <mesh position={[0, 2.55, -5.72]}>
        <planeGeometry args={[5.4, 2.3]} />
        <meshStandardMaterial color="#f7f4ec" roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.55, -5.78]}>
        <boxGeometry args={[5.7, 2.55, 0.08]} />
        <meshStandardMaterial color="#d6cbb6" />
      </mesh>
      <Desk position={[-2.1, 0, -1.6]} width={2.1} />
      <Desk position={[2.1, 0, -1.6]} width={2.1} />
      <Desk position={[0, 0, 0.5]} width={2.4} />
    </>
  );
}

function FacultySet() {
  return (
    <>
      <Desk position={[0, 0, -2.8]} width={3} />
      <Wood args={[1.4, 1.6, 0.4]} position={[4.8, 0.8, -4.4]} color="#7a4e28" />
      <mesh position={[-4.7, 1.15, -4.5]}>
        <cylinderGeometry args={[0.22, 0.28, 0.5, 10]} />
        <meshStandardMaterial color="#3f6212" />
      </mesh>
      <mesh position={[-4.7, 1.55, -4.5]}>
        <sphereGeometry args={[0.38, 10, 10]} />
        <meshStandardMaterial color="#4d7c0f" />
      </mesh>
    </>
  );
}

function ExamSet() {
  return (
    <>
      <Desk position={[-2.3, 0, -2.4]} width={1.8} />
      <Desk position={[2.3, 0, -2.4]} width={1.8} />
      <Desk position={[-2.3, 0, 0.2]} width={1.8} />
      <Desk position={[2.3, 0, 0.2]} width={1.8} />
    </>
  );
}

export default function BuildingInterior({ entryZ, building }) {
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

  return (
    <group position={[x, 0, z]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#cbb79a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 5.85, 0]}>
        <boxGeometry args={[16, 0.18, 16]} />
        <meshStandardMaterial color="#f3eee4" />
      </mesh>
      <mesh position={[0, 3, -6.1]}>
        <boxGeometry args={[16, 6.1, 0.28]} />
        <meshStandardMaterial color="#f2eadc" roughness={0.85} />
      </mesh>
      <mesh position={[-7.85, 3, 0]}>
        <boxGeometry args={[0.28, 6.1, 16]} />
        <meshStandardMaterial color="#efe6d6" />
      </mesh>
      <mesh position={[7.85, 3, 0]}>
        <boxGeometry args={[0.28, 6.1, 16]} />
        <meshStandardMaterial color="#efe6d6" />
      </mesh>

      <WindowPane position={[-4.4, 3.15, -5.9]} />
      <WindowPane position={[4.4, 3.15, -5.9]} />

      <mesh position={[0, 0.72, -5.55]}>
        <boxGeometry args={[2.1, 0.08, 0.7]} />
        <meshStandardMaterial color="#d4b483" metalness={0.25} roughness={0.4} />
      </mesh>
      <Text position={[0, 0.9, -5.2]} fontSize={0.22} color="#6b4f2e" anchorX="center" anchorY="middle" maxWidth={4}>
        {name}
      </Text>

      {furniture}
      <RoomLights />
    </group>
  );
}
