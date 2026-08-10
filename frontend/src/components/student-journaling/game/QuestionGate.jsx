import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox, Torus } from '@react-three/drei';
import { LANES } from '../../../constants/gameMaps';
import { generateMissionGates } from '../../../constants/missionQuestions';

const PORTAL_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899'];
const PATH_HALF = 5.5;

function LanePortal({ x, label, accent }) {
  return (
    <group position={[x, 0, 0]}>
      <Torus args={[0.7, 0.05, 8, 24]} rotation={[Math.PI / 2, 0, 0]} position={[0, 1.3, 0]}>
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
      </Torus>
      <RoundedBox args={[2.2, 0.15, 0.4]} radius={0.04} position={[0, 0.08, 0]}>
        <meshStandardMaterial color="#334155" emissive={accent} emissiveIntensity={0.15} />
      </RoundedBox>
      <Html
        position={[0, 2.05, 0.3]}
        center
        distanceFactor={16}
        transform
        sprite
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className="px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-semibold text-white text-center leading-tight shadow-lg border border-white/20"
          style={{
            background: 'rgba(15,23,42,0.92)',
            backdropFilter: 'blur(4px)',
            maxWidth: '72px',
            minWidth: '64px',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

/** Temple Run–style question fork — pick a lane to answer. */
export default function QuestionGate({
  gate,
  playerPosRef,
  laneIndexRef,
  resolved,
  onResolve,
  accent = '#4ade80',
}) {
  const triggered = useRef(false);
  const groupRef = useRef(null);
  const gateZ = gate.z;

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const pulse = 0.4 + Math.sin(clock.elapsedTime * 3) * 0.15;
      groupRef.current.children.forEach((child) => {
        if (child.name === 'arch-glow') {
          child.material.emissiveIntensity = pulse;
        }
      });
    }

    if (resolved || triggered.current) return;
    const p = playerPosRef?.current;
    if (!p) return;

    const distZ = p.z - gateZ;
    if (distZ <= 1.2 && distZ >= -1.5) {
      triggered.current = true;
      onResolve?.(gate.id, laneIndexRef.current, gate);
    }
  });

  if (resolved) {
    return (
      <group position={[0, 0, gateZ]}>
        <mesh position={[0, 2.5, 0]}>
          <boxGeometry args={[PATH_HALF * 2 + 0.6, 0.08, 0.3]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.3} transparent opacity={0.5} />
        </mesh>
      </group>
    );
  }

  const isInputGate = gate.question_type && gate.question_type !== 'lane';

  return (
    <group ref={groupRef} position={[0, 0, gateZ]}>
      <mesh position={[-PATH_HALF - 0.15, 1.8, 0]}>
        <boxGeometry args={[0.25, 3.6, 0.35]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>
      <mesh position={[PATH_HALF + 0.15, 1.8, 0]}>
        <boxGeometry args={[0.25, 3.6, 0.35]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>
      <mesh name="arch-glow" position={[0, 3.5, 0]}>
        <boxGeometry args={[PATH_HALF * 2 + 1.2, 0.2, 0.4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} />
      </mesh>

      <Html position={[0, 4.2, 0]} center distanceFactor={18} transform style={{ pointerEvents: 'none' }}>
        <div
          className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white text-center max-w-[320px] shadow-xl border-2"
          style={{
            background: 'linear-gradient(135deg, rgba(30,27,75,0.95), rgba(15,23,42,0.95))',
            borderColor: accent,
          }}
        >
          ❓ {gate.question}
        </div>
      </Html>

      {isInputGate ? (
        <Html position={[0, 2.5, 0]} center distanceFactor={16} transform style={{ pointerEvents: 'none' }}>
          <div className="px-4 py-2 rounded-xl text-xs font-bold text-amber-300 bg-slate-900/90 border border-amber-400/50">
            ⌨️ Run through to enter your answer
          </div>
        </Html>
      ) : (
        gate.options.map((opt, i) => (
          <LanePortal
            key={i}
            x={LANES[i]}
            label={opt}
            accent={PORTAL_COLORS[i] || accent}
          />
        ))
      )}

      {!isInputGate && LANES.map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, 0]}>
          <ringGeometry args={[0.45, 0.65, 16]} />
          <meshStandardMaterial
            color={PORTAL_COLORS[i]}
            emissive={PORTAL_COLORS[i]}
            emissiveIntensity={0.35}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

export { generateMissionGates as generateQuestionGates };
