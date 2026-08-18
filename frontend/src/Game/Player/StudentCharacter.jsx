import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

const SKIN = "#e8b48a";
const HAIR = "#2a1b14";
const HOODIE = "#1e4d8c";
const HOODIE_TRIM = "#f5d76e";
const JEANS = "#24324a";
const SHOE = "#e8e4dc";
const PACK = "#5a3d2b";

/**
 * Procedural campus student — run / walk / jump / slide / idle are all
 * pose-driven, so we are not stuck with a single Mixamo clip.
 */
export default function StudentCharacter({ gaitPhase, poseRef }) {
  const leftArm = useRef();
  const rightArm = useRef();
  const leftLeg = useRef();
  const rightLeg = useRef();
  const torso = useRef();
  const head = useRef();

  useFrame(() => {
    const pose = poseRef?.current || "idle";
    const t = gaitPhase.current;
    const idle = pose === "idle";
    const walk = pose === "walk";
    const run = pose === "run";
    const jump = pose === "jump";
    const slide = pose === "slide";
    const stumble = pose === "stumble";

    const amp = run ? 0.95 : walk ? 0.55 : idle ? 0.08 : 0;
    const swing = Math.sin(t) * amp;

    if (leftArm.current && rightArm.current && leftLeg.current && rightLeg.current) {
      if (jump) {
        leftArm.current.rotation.x = -2.15;
        rightArm.current.rotation.x = -1.95;
        leftArm.current.rotation.z = 0.35;
        rightArm.current.rotation.z = -0.35;
        leftLeg.current.rotation.x = 1.05;
        rightLeg.current.rotation.x = 0.75;
      } else if (slide) {
        leftArm.current.rotation.x = -1.45;
        rightArm.current.rotation.x = -1.65;
        leftArm.current.rotation.z = 0.1;
        rightArm.current.rotation.z = -0.1;
        leftLeg.current.rotation.x = 0.35;
        rightLeg.current.rotation.x = 0.55;
      } else if (stumble) {
        leftArm.current.rotation.x = Math.sin(t * 2.2) * 1.1;
        rightArm.current.rotation.x = -Math.sin(t * 2.2) * 1.1;
        leftArm.current.rotation.z = 0.45;
        rightArm.current.rotation.z = -0.45;
        leftLeg.current.rotation.x = 0.4;
        rightLeg.current.rotation.x = -0.25;
      } else {
        leftArm.current.rotation.x = -swing;
        rightArm.current.rotation.x = swing;
        leftArm.current.rotation.z = run ? 0.12 : 0.06;
        rightArm.current.rotation.z = run ? -0.12 : -0.06;
        leftLeg.current.rotation.x = swing;
        rightLeg.current.rotation.x = -swing;
      }
    }

    if (torso.current) {
      torso.current.position.y = 1.05 + (idle ? Math.sin(t * 0.6) * 0.015 : 0);
      torso.current.rotation.x = jump ? -0.08 : run ? 0.08 : walk ? 0.04 : 0;
    }
    if (head.current) {
      head.current.rotation.x = jump ? -0.12 : idle ? Math.sin(t * 0.6) * 0.03 : 0;
    }
  });

  return (
    <group>
      <group ref={torso} position={[0, 1.05, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.27, 0.52, 6, 10]} />
          <meshStandardMaterial color={HOODIE} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.22, 0.16]}>
          <boxGeometry args={[0.34, 0.06, 0.04]} />
          <meshStandardMaterial color={HOODIE_TRIM} emissive={HOODIE_TRIM} emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0, 0.42, 0.02]}>
          <torusGeometry args={[0.16, 0.035, 8, 16, Math.PI]} />
          <meshStandardMaterial color={HOODIE} />
        </mesh>
      </group>

      <group ref={head} position={[0, 1.68, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.23, 18, 18]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.12, -0.02]} scale={[1.08, 0.62, 1.12]}>
          <sphereGeometry args={[0.22, 16, 12]} />
          <meshStandardMaterial color={HAIR} roughness={0.8} />
        </mesh>
        <mesh position={[-0.08, 0.02, 0.2]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.08, 0.02, 0.2]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      <mesh castShadow position={[0, 1.08, -0.3]}>
        <boxGeometry args={[0.34, 0.42, 0.2]} />
        <meshStandardMaterial color={PACK} roughness={0.7} />
      </mesh>

      <group ref={leftArm} position={[-0.38, 1.28, 0]}>
        <mesh castShadow position={[0, -0.32, 0]}>
          <capsuleGeometry args={[0.075, 0.48, 5, 8]} />
          <meshStandardMaterial color={SKIN} />
        </mesh>
        <mesh position={[0, -0.08, 0]}>
          <capsuleGeometry args={[0.09, 0.16, 4, 8]} />
          <meshStandardMaterial color={HOODIE} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.38, 1.28, 0]}>
        <mesh castShadow position={[0, -0.32, 0]}>
          <capsuleGeometry args={[0.075, 0.48, 5, 8]} />
          <meshStandardMaterial color={SKIN} />
        </mesh>
        <mesh position={[0, -0.08, 0]}>
          <capsuleGeometry args={[0.09, 0.16, 4, 8]} />
          <meshStandardMaterial color={HOODIE} />
        </mesh>
      </group>

      <group ref={leftLeg} position={[-0.14, 0.66, 0]}>
        <mesh castShadow position={[0, -0.34, 0]}>
          <capsuleGeometry args={[0.105, 0.52, 5, 8]} />
          <meshStandardMaterial color={JEANS} />
        </mesh>
        <mesh castShadow position={[0, -0.68, 0.06]}>
          <boxGeometry args={[0.2, 0.1, 0.32]} />
          <meshStandardMaterial color={SHOE} roughness={0.45} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.14, 0.66, 0]}>
        <mesh castShadow position={[0, -0.34, 0]}>
          <capsuleGeometry args={[0.105, 0.52, 5, 8]} />
          <meshStandardMaterial color={JEANS} />
        </mesh>
        <mesh castShadow position={[0, -0.68, 0.06]}>
          <boxGeometry args={[0.2, 0.1, 0.32]} />
          <meshStandardMaterial color={SHOE} roughness={0.45} />
        </mesh>
      </group>
    </group>
  );
}
