import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { PHASES, useGameStore } from "../state/GameStateManager";
import { useRunnerStore } from "../state/runnerStore";

const CONFETTI = ["#fbbf24", "#34d399", "#38bdf8", "#f43f5e", "#f5d76e", "#a78bfa", "#fff7ed"];
const TAPE_COLORS = ["#f8fafc", "#111827", "#f8fafc", "#111827", "#f5d76e", "#111827"];
const BANNER_COLORS = ["#f5d76e", "#111827", "#f5d76e", "#111827"];

function useStripeTexture(colors, size = 256) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = 32;
    const g = canvas.getContext("2d");
    const stripe = size / colors.length;
    colors.forEach((color, i) => {
      g.fillStyle = color;
      g.fillRect(i * stripe, 0, stripe + 1, 32);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [colors, size]);
}

function Pole({ x }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh castShadow position={[0, 1.85, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 3.7, 12]} />
        <meshStandardMaterial color="#1f2937" metalness={0.45} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.22, 12]} />
        <meshStandardMaterial color="#f5d76e" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, 3.72, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#f5d76e" emissive="#f5d76e" emissiveIntensity={1.1} metalness={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.38, 20]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  );
}

function Pennant({ x, y, color, delay }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(clock.elapsedTime * 3.1 + delay) * 0.42;
      ref.current.rotation.z = (x > 0 ? -0.18 : 0.18) + Math.sin(clock.elapsedTime * 2.4 + delay) * 0.08;
    }
  });
  return (
    <mesh ref={ref} position={[x, y, 0.1]}>
      <coneGeometry args={[0.2, 0.48, 3]} />
      <meshStandardMaterial color={color} roughness={0.42} emissive={color} emissiveIntensity={0.18} />
    </mesh>
  );
}

function RoadChevron({ zOff }) {
  return (
    <group position={[0, 0.045, zOff]}>
      <mesh rotation={[-Math.PI / 2, 0, 0.42]} position={[-0.52, 0, 0]}>
        <planeGeometry args={[1.55, 0.2]} />
        <meshBasicMaterial color="#f5d76e" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -0.42]} position={[0.52, 0, 0]}>
        <planeGeometry args={[1.55, 0.2]} />
        <meshBasicMaterial color="#f5d76e" transparent opacity={0.72} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Sparkles() {
  const group = useRef();
  const seeds = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        x: (i % 8 - 3.5) * 1.05,
        y: 2.05 + (i % 4) * 0.42,
        z: ((i * 13) % 7) * 0.08 - 0.2,
        s: 0.045 + (i % 3) * 0.02,
        d: i * 0.47,
      })),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const children = group.current?.children || [];
    children.forEach((child, i) => {
      const seed = seeds[i];
      child.position.y = seed.y + Math.sin(t * 2.4 + seed.d) * 0.16;
      child.rotation.y = t * 1.6 + seed.d;
      child.material.opacity = 0.35 + Math.sin(t * 5 + seed.d) * 0.4;
    });
  });

  return (
    <group ref={group}>
      {seeds.map((seed, i) => (
        <mesh key={i} position={[seed.x, seed.y, seed.z]} scale={seed.s}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color="#fff6c2" transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function BurstConfetti({ active }) {
  const group = useRef();
  const bits = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        x: (Math.sin(i * 1.7) * 1.4),
        y: 1.55,
        z: Math.cos(i * 1.1) * 0.4,
        vx: Math.sin(i * 2.2) * 3.2,
        vy: 4.2 + (i % 5) * 0.55,
        vz: Math.cos(i * 1.6) * 2.4,
        color: CONFETTI[i % CONFETTI.length],
        spin: 0.08 + (i % 4) * 0.04,
      })),
    []
  );
  const born = useRef(performance.now());

  useEffect(() => {
    if (active) born.current = performance.now();
  }, [active]);

  useFrame((_, delta) => {
    if (!active || !group.current) return;
    const dt = Math.min(delta, 0.05);
    group.current.children.forEach((child, i) => {
      const bit = bits[i];
      child.position.x += bit.vx * dt;
      child.position.y += bit.vy * dt;
      child.position.z += bit.vz * dt;
      bit.vy -= 9.2 * dt;
      child.rotation.x += bit.spin;
      child.rotation.z += bit.spin * 0.7;
      const age = (performance.now() - born.current) / 1000;
      child.material.opacity = Math.max(0, 1 - age * 0.32);
    });
  });

  if (!active) return null;

  return (
    <group ref={group}>
      {bits.map((bit, i) => (
        <mesh key={i} position={[bit.x, bit.y, bit.z]}>
          <boxGeometry args={[0.12, 0.06, 0.02]} />
          <meshBasicMaterial color={bit.color} transparent opacity={1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function FinishLine() {
  const phase = useGameStore((s) => s.phase);
  const finishLineZ = useGameStore((s) => s.finishLineZ);
  const day = useGameStore((s) => s.day);
  const crossed = useRef(false);
  const tape = useRef();
  const leftTape = useRef();
  const rightTape = useRef();
  const glow = useRef();
  const beacon = useRef();
  const stripeTex = useStripeTexture(TAPE_COLORS);
  const bannerTex = useStripeTexture(BANNER_COLORS, 128);

  const visible =
    finishLineZ != null &&
    (phase === PHASES.APPROACHING_FINISH || phase === PHASES.DAY_CELEBRATION);
  const broken = phase === PHASES.DAY_CELEBRATION;

  useEffect(() => {
    crossed.current = false;
    if (leftTape.current) {
      leftTape.current.position.set(-2.15, 1.62, 0.05);
      leftTape.current.rotation.set(0, 0, 0);
    }
    if (rightTape.current) {
      rightTape.current.position.set(2.15, 1.62, 0.05);
      rightTape.current.rotation.set(0, 0, 0);
    }
  }, [finishLineZ]);

  useFrame((state) => {
    if (!visible || finishLineZ == null) return;
    const { posZ } = useRunnerStore.getState();
    if (
      !crossed.current &&
      !useGameStore.getState().paused &&
      phase === PHASES.APPROACHING_FINISH &&
      posZ >= finishLineZ - 0.65
    ) {
      crossed.current = true;
      useGameStore.getState().crossFinishLine();
    }

    const t = state.clock.elapsedTime;
    if (glow.current) glow.current.material.opacity = 0.32 + Math.sin(t * 4.2) * 0.14;
    if (beacon.current) beacon.current.material.opacity = 0.1 + Math.sin(t * 1.8) * 0.04;
    if (!broken && tape.current) {
      tape.current.position.y = 1.62 + Math.sin(t * 3.4) * 0.035;
    }
    if (broken && leftTape.current && rightTape.current) {
      leftTape.current.rotation.z = Math.min(1.22, leftTape.current.rotation.z + 0.085);
      leftTape.current.position.y = Math.max(0.28, leftTape.current.position.y - 0.045);
      leftTape.current.position.x = Math.max(-3.35, leftTape.current.position.x - 0.055);
      rightTape.current.rotation.z = Math.max(-1.22, rightTape.current.rotation.z - 0.085);
      rightTape.current.position.y = Math.max(0.28, rightTape.current.position.y - 0.045);
      rightTape.current.position.x = Math.min(3.35, rightTape.current.position.x + 0.055);
    }
  });

  if (!visible) return null;

  return (
    <group position={[0, 0, finishLineZ]}>
      <mesh ref={beacon} position={[0, 8.2, 0]}>
        <cylinderGeometry args={[0.45, 2.8, 16, 10, 1, true]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {[-38, -30, -22, -14, -6].map((zOff) => (
        <RoadChevron key={zOff} zOff={zOff} />
      ))}

      <Pole x={-4.62} />
      <Pole x={4.62} />

      <mesh position={[0, 3.58, 0]} castShadow>
        <boxGeometry args={[9.4, 0.18, 0.22]} />
        <meshStandardMaterial color="#111827" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.92, 0.02]} castShadow>
        <boxGeometry args={[8.9, 0.78, 0.14]} />
        <meshStandardMaterial color="#0f172a" roughness={0.38} />
      </mesh>
      <mesh position={[0, 3.92, 0.1]}>
        <boxGeometry args={[8.55, 0.58, 0.04]} />
        <meshStandardMaterial map={bannerTex} roughness={0.45} emissive="#f5d76e" emissiveIntensity={0.22} />
      </mesh>
      <Text
        position={[0, 3.92, 0.16]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.42}
        color="#1a1208"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#fde68a"
      >
        FINISH
      </Text>

      <Text
        position={[-4.95, 2.55, 0.12]}
        rotation={[0, Math.PI * 0.5, 0]}
        fontSize={0.22}
        color="#f5d76e"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#111827"
      >
        {`DAY ${day}`}
      </Text>
      <Text
        position={[4.95, 2.55, 0.12]}
        rotation={[0, -Math.PI * 0.5, 0]}
        fontSize={0.22}
        color="#f5d76e"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#111827"
      >
        {`DAY ${day}`}
      </Text>

      <Pennant x={-3.45} y={3.18} color="#f43f5e" delay={0} />
      <Pennant x={-1.15} y={3.18} color="#38bdf8" delay={0.5} />
      <Pennant x={1.15} y={3.18} color="#34d399" delay={1.05} />
      <Pennant x={3.45} y={3.18} color="#fbbf24" delay={1.6} />

      <Sparkles />

      {!broken ? (
        <mesh ref={tape} position={[0, 1.62, 0.05]} castShadow>
          <boxGeometry args={[8.7, 0.2, 0.055]} />
          <meshStandardMaterial map={stripeTex} roughness={0.32} metalness={0.08} />
        </mesh>
      ) : (
        <>
          <mesh ref={leftTape} position={[-2.15, 1.62, 0.05]} castShadow>
            <boxGeometry args={[4.25, 0.2, 0.055]} />
            <meshStandardMaterial map={stripeTex} roughness={0.32} />
          </mesh>
          <mesh ref={rightTape} position={[2.15, 1.62, 0.05]} castShadow>
            <boxGeometry args={[4.25, 0.2, 0.055]} />
            <meshStandardMaterial map={stripeTex} roughness={0.32} />
          </mesh>
        </>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <planeGeometry args={[9.6, 1.35]} />
        <meshStandardMaterial map={bannerTex} transparent opacity={0.55} />
      </mesh>
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.05, 2.55, 48]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.42} depthWrite={false} />
      </mesh>

      <BurstConfetti active={broken} />
      <pointLight position={[0, 3.4, 1.4]} color="#ffe08a" intensity={5.2} distance={16} />
      <pointLight position={[0, 2.2, -1]} color="#fbbf24" intensity={2.2} distance={10} />
    </group>
  );
}
