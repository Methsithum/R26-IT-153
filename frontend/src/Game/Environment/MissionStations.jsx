import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRunnerStore } from "../state/runnerStore";
import { STATIONS } from "./stationMap";

function Wood({ args, position, rotation, color = "#8b5a32" }) {
  return (
    <mesh castShadow receiveShadow position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}

function Desk({ position, width = 2.4, depth = 1.15 }) {
  return (
    <group position={position}>
      <Wood args={[width, 0.1, depth]} position={[0, 0.82, 0]} color="#a56d3e" />
      <Wood args={[0.1, 0.82, depth - 0.08]} position={[-width / 2 + 0.1, 0.41, 0]} color="#7a4e28" />
      <Wood args={[0.1, 0.82, depth - 0.08]} position={[width / 2 - 0.1, 0.41, 0]} color="#7a4e28" />
    </group>
  );
}

function StationAura({ active, label, height = 2.55 }) {
  const ring = useRef();
  const glow = useRef();
  const near = useRunnerStore((s) => s.nearMission);

  useFrame((state) => {
    if (!active) return;
    const t = state.clock.elapsedTime;
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(t * 2.6) * 0.07);
    if (glow.current) {
      glow.current.material.emissiveIntensity = near ? 1.55 : 0.7 + Math.sin(t * 3.1) * 0.35;
      glow.current.position.y = height + Math.sin(t * 2.2) * 0.06;
    }
  });

  if (!active) return null;

  return (
    <group>
      <pointLight color="#ffe08a" intensity={near ? 3.4 : 1.7} distance={7.5} position={[0, 1.6, 0.4]} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0.15]}>
        <ringGeometry args={[0.72, 1.08, 36]} />
        <meshBasicMaterial color="#f5d76e" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh ref={glow} position={[0, height, 0.1]}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color="#fff6d5" emissive="#f5d76e" emissiveIntensity={0.9} />
      </mesh>
      <Text
        position={[0, height + 0.32, 0.12]}
        fontSize={0.18}
        color="#fff6d5"
        anchorX="center"
        outlineWidth={0.012}
        outlineColor="#5c4324"
      >
        {label}
      </Text>
    </group>
  );
}

function WallPlaque({ args, lit }) {
  return (
    <mesh castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={lit ? "#efe4cc" : "#e8dcc8"}
        roughness={0.62}
        emissive={lit ? "#f5d76e" : "#000000"}
        emissiveIntensity={lit ? 0.22 : 0}
      />
    </mesh>
  );
}

function CalendarStation({ active }) {
  const days = [
    [1, 2, 3, 4, 5, 6, 7],
    [8, 9, 10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19, 20, 21],
  ];
  return (
    <group position={[-13.58, 2.15, -5.4]} rotation={[0, Math.PI / 2, 0]}>
      <WallPlaque args={[2.15, 2.45, 0.08]} lit={active} />
      <mesh position={[0, 0.88, 0.05]}>
        <boxGeometry args={[2.05, 0.42, 0.04]} />
        <meshStandardMaterial color="#8b4518" roughness={0.55} />
      </mesh>
      <Text position={[0, 0.88, 0.08]} fontSize={0.16} color="#f7e7c4" anchorX="center">
        NOTICE
      </Text>
      {days.map((row, r) =>
        row.map((d, c) => (
          <mesh key={`${r}-${c}`} position={[-0.78 + c * 0.26, 0.42 - r * 0.32, 0.06]}>
            <boxGeometry args={[0.22, 0.26, 0.02]} />
            <meshStandardMaterial color={d === 12 ? "#f5d76e" : "#fffaf2"} roughness={0.4} />
          </mesh>
        ))
      )}
      <mesh position={[0.62, -0.78, 0.12]} rotation={[-0.4, 0.2, 0.15]}>
        <cylinderGeometry args={[0.12, 0.14, 0.08, 16]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.45} />
      </mesh>
      <mesh position={[0.62, -0.7, 0.12]} rotation={[-0.4, 0.2, 0.15]}>
        <boxGeometry args={[0.18, 0.04, 0.22]} />
        <meshStandardMaterial color="#9a3412" />
      </mesh>
    </group>
  );
}

function SliderStation({ active }) {
  const knobX = 0.35;
  return (
    <group position={[0, 2.2, -12.72]}>
      <WallPlaque args={[3.4, 2.2, 0.1]} lit={active} />
      <mesh position={[0, 0.72, 0.06]}>
        <boxGeometry args={[2.9, 0.38, 0.04]} />
        <meshStandardMaterial color="#6d3f22" />
      </mesh>
      <Text position={[0, 0.72, 0.1]} fontSize={0.18} color="#f7e7c4" anchorX="center">
        GRADES
      </Text>
      <mesh position={[0, 0.05, 0.08]}>
        <boxGeometry args={[2.4, 0.12, 0.06]} />
        <meshStandardMaterial color="#d6c4a6" metalness={0.15} roughness={0.4} />
      </mesh>
      <mesh position={[knobX, 0.05, 0.16]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#d4b483" metalness={0.55} roughness={0.25} emissive={active ? "#f5d76e" : "#000"} emissiveIntensity={active ? 0.35 : 0} />
      </mesh>
      {[-1, -0.5, 0, 0.5, 1].map((x) => (
        <mesh key={x} position={[x, -0.42, 0.08]}>
          <boxGeometry args={[0.04, 0.18, 0.03]} />
          <meshStandardMaterial color="#a16207" />
        </mesh>
      ))}
    </group>
  );
}

function DartboardStation({ active }) {
  const rings = [
    [0.78, "#f4efe4"],
    [0.62, "#9b2c2c"],
    [0.48, "#f4efe4"],
    [0.34, "#9b2c2c"],
    [0.2, "#f4efe4"],
    [0.09, "#b45309"],
  ];
  return (
    <group position={[13.58, 2.35, -5.4]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0, -0.04]}>
        <cylinderGeometry args={[0.92, 0.92, 0.1, 36]} />
        <meshStandardMaterial color="#5c3a1e" roughness={0.7} />
      </mesh>
      {rings.map(([r, color], i) => (
        <mesh key={i} position={[0, 0, 0.02 - i * 0.002]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 36]} />
          <meshStandardMaterial
            color={color}
            roughness={0.55}
            emissive={active && i === 0 ? "#f5d76e" : "#000000"}
            emissiveIntensity={active && i === 0 ? 0.12 : 0}
          />
        </mesh>
      ))}
      <mesh position={[0.12, 0.08, 0.08]} rotation={[0.4, 0.2, 0.8]}>
        <cylinderGeometry args={[0.018, 0.012, 0.42, 8]} />
        <meshStandardMaterial color="#d6d3d1" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function ExamSortStation({ active }) {
  const cards = [
    [-0.42, 0.02, "#fff7ed"],
    [-0.18, -0.04, "#fef3c7"],
    [0.08, 0.03, "#fffbeb"],
    [0.34, -0.02, "#ffedd5"],
  ];
  return (
    <group position={[-7.2, 0, 5.0]}>
      <Desk position={[0, 0, 0]} width={2.5} depth={1.25} />
      <Wood args={[0.85, 0.42, 0.7]} position={[0.62, 1.12, 0.05]} color="#7a4e28" />
      <mesh position={[0.62, 1.36, 0.05]}>
        <boxGeometry args={[0.72, 0.08, 0.58]} />
        <meshStandardMaterial color="#c4a574" emissive={active ? "#f5d76e" : "#000"} emissiveIntensity={active ? 0.18 : 0} />
      </mesh>
      {cards.map(([x, rot, color], i) => (
        <mesh key={i} position={[x - 0.15, 0.9, 0.08]} rotation={[-0.55, rot, 0.05]} castShadow>
          <boxGeometry args={[0.38, 0.02, 0.52]} />
          <meshStandardMaterial color={color} roughness={0.45} />
        </mesh>
      ))}
      <Text position={[0, 1.55, 0.4]} fontSize={0.12} color="#5c4324" anchorX="center">
        EXAMS
      </Text>
    </group>
  );
}

function AbacusStation({ active }) {
  const rods = [-0.22, 0, 0.22];
  const beads = [-0.28, -0.08, 0.12, 0.32];
  return (
    <group position={[-6.8, 0, 0.6]}>
      <Desk position={[0, 0, 0]} width={2.35} />
      <group position={[0, 1.12, 0]}>
        <Wood args={[1.15, 0.08, 0.55]} position={[0, 0.28, 0]} color="#6f4424" />
        <Wood args={[1.15, 0.08, 0.55]} position={[0, -0.28, 0]} color="#6f4424" />
        <Wood args={[0.08, 0.64, 0.55]} position={[-0.54, 0, 0]} color="#6f4424" />
        <Wood args={[0.08, 0.64, 0.55]} position={[0.54, 0, 0]} color="#6f4424" />
        {rods.map((y) => (
          <group key={y}>
            <mesh position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.018, 0.018, 0.95, 8]} />
              <meshStandardMaterial color="#d4b483" metalness={0.4} roughness={0.35} />
            </mesh>
            {beads.map((x, i) => (
              <mesh key={i} position={[x + (y === 0 ? 0.06 : 0), y, 0]}>
                <sphereGeometry args={[0.075, 12, 12]} />
                <meshStandardMaterial
                  color={i % 2 ? "#b45309" : "#92400e"}
                  roughness={0.4}
                  emissive={active ? "#f5d76e" : "#000"}
                  emissiveIntensity={active ? 0.18 : 0}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

function ScaleStation({ active }) {
  const beam = useRef();
  useFrame((state) => {
    if (beam.current) beam.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.1) * 0.06;
  });
  return (
    <group position={[6.8, 0, 0.6]}>
      <Desk position={[0, 0, 0]} width={2.35} />
      <group position={[0, 0.88, 0]}>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.07, 0.12, 0.55, 10]} />
          <meshStandardMaterial color="#c9a26a" metalness={0.55} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.55, 0.08, 0.4]} />
          <meshStandardMaterial color="#8f7350" />
        </mesh>
        <group ref={beam} position={[0, 0.5, 0]}>
          <mesh>
            <boxGeometry args={[1.35, 0.05, 0.08]} />
            <meshStandardMaterial color="#d4b483" metalness={0.6} roughness={0.28} emissive={active ? "#f5d76e" : "#000"} emissiveIntensity={active ? 0.2 : 0} />
          </mesh>
          <mesh position={[-0.55, -0.22, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.06, 16]} />
            <meshStandardMaterial color="#b45309" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[0.55, -0.22, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.06, 16]} />
            <meshStandardMaterial color="#365314" metalness={0.35} roughness={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export default function MissionStations({ activeKey, exploring }) {
  const aura = exploring && activeKey ? STATIONS[activeKey] : null;
  return (
    <group>
      <CalendarStation active={exploring && activeKey === "calendar"} />
      <SliderStation active={exploring && activeKey === "slider"} />
      <DartboardStation active={exploring && activeKey === "dartboard"} />
      <ExamSortStation active={exploring && activeKey === "examSort"} />
      <AbacusStation active={exploring && activeKey === "abacus"} />
      <ScaleStation active={exploring && activeKey === "scale"} />
      {aura && (
        <group position={[aura.interact[0], 0, aura.interact[1]]}>
          <StationAura active label={aura.label} />
        </group>
      )}
    </group>
  );
}
