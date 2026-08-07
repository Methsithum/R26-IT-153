import { forwardRef } from 'react';
import { RoundedBox, Sphere, Capsule } from '@react-three/drei';

const SKIN = '#f5cba7';
const HOODIE = '#e85d04';
const HOODIE_DARK = '#dc2f02';
const JEANS = '#1d3557';
const SHOE = '#f8f9fa';
const SHOE_SOLE = '#212529';
const HAIR = '#2b1810';

const toon = (color, emissive) => (
  <meshStandardMaterial color={color} emissive={emissive || color} emissiveIntensity={0.08} roughness={0.82} metalness={0} />
);

/** Stylized Temple Run–style student runner (cartoon proportions). */
export default function RunnerCharacter({
  visualRef,
  leftLeg,
  rightLeg,
  leftArm,
  rightArm,
}) {
  return (
    <group ref={visualRef} rotation={[0, 0, 0]}>
      <RoundedBox args={[0.44, 0.52, 0.3]} radius={0.08} smoothness={4} castShadow position={[0, 0.58, 0]} rotation={[-0.18, 0, 0]}>
        {toon(HOODIE)}
      </RoundedBox>
      <RoundedBox args={[0.28, 0.18, 0.06]} radius={0.03} position={[0, 0.48, 0.16]} rotation={[-0.18, 0, 0]}>
        {toon(HOODIE_DARK)}
      </RoundedBox>
      <Sphere args={[0.2, 12, 12]} castShadow position={[0, 0.88, -0.06]}>
        {toon(HOODIE)}
      </Sphere>

      <Sphere args={[0.22, 16, 16]} castShadow position={[0, 1.02, 0.04]}>
        {toon(SKIN, '#000000')}
      </Sphere>
      <Sphere args={[0.23, 12, 12]} position={[0, 1.1, -0.02]} scale={[1, 0.75, 0.95]}>
        {toon(HAIR, '#000000')}
      </Sphere>
      <Sphere args={[0.035, 8, 8]} position={[-0.07, 1.04, 0.2]}>
        <meshBasicMaterial color="#1a1a2e" />
      </Sphere>
      <Sphere args={[0.035, 8, 8]} position={[0.07, 1.04, 0.2]}>
        <meshBasicMaterial color="#1a1a2e" />
      </Sphere>

      <RoundedBox args={[0.3, 0.36, 0.14]} radius={0.04} castShadow position={[0, 0.62, -0.2]} rotation={[-0.18, 0, 0]}>
        {toon('#7c3aed')}
      </RoundedBox>
      <RoundedBox args={[0.08, 0.5, 0.04]} radius={0.02} position={[-0.16, 0.62, -0.12]} rotation={[-0.18, 0.2, 0]}>
        {toon('#5b21b6')}
      </RoundedBox>
      <RoundedBox args={[0.08, 0.5, 0.04]} radius={0.02} position={[0.16, 0.62, -0.12]} rotation={[-0.18, -0.2, 0]}>
        {toon('#5b21b6')}
      </RoundedBox>

      <group ref={leftArm} position={[-0.3, 0.78, 0.02]}>
        <Capsule args={[0.07, 0.28, 4, 8]} castShadow rotation={[0, 0, 0.15]}>
          {toon(HOODIE)}
        </Capsule>
        <Sphere args={[0.07, 8, 8]} position={[0, -0.22, 0.04]}>
          {toon(SKIN, '#000000')}
        </Sphere>
      </group>
      <group ref={rightArm} position={[0.3, 0.78, 0.02]}>
        <Capsule args={[0.07, 0.28, 4, 8]} castShadow rotation={[0, 0, -0.15]}>
          {toon(HOODIE)}
        </Capsule>
        <Sphere args={[0.07, 8, 8]} position={[0, -0.22, 0.04]}>
          {toon(SKIN, '#000000')}
        </Sphere>
      </group>

      <RoundedBox args={[0.38, 0.2, 0.28]} radius={0.05} position={[0, 0.28, 0.02]} rotation={[-0.08, 0, 0]}>
        {toon(JEANS, '#000000')}
      </RoundedBox>

      <group ref={leftLeg} position={[-0.11, 0.18, 0.04]}>
        <Capsule args={[0.08, 0.32, 4, 8]} castShadow>
          {toon(JEANS, '#000000')}
        </Capsule>
        <RoundedBox args={[0.16, 0.1, 0.26]} radius={0.04} position={[0, -0.38, 0.06]}>
          {toon(SHOE, '#000000')}
        </RoundedBox>
        <RoundedBox args={[0.17, 0.04, 0.28]} radius={0.02} position={[0, -0.44, 0.06]}>
          {toon(SHOE_SOLE, '#000000')}
        </RoundedBox>
      </group>
      <group ref={rightLeg} position={[0.11, 0.18, 0.04]}>
        <Capsule args={[0.08, 0.32, 4, 8]} castShadow>
          {toon(JEANS, '#000000')}
        </Capsule>
        <RoundedBox args={[0.16, 0.1, 0.26]} radius={0.04} position={[0, -0.38, 0.06]}>
          {toon(SHOE, '#000000')}
        </RoundedBox>
        <RoundedBox args={[0.17, 0.04, 0.28]} radius={0.02} position={[0, -0.44, 0.06]}>
          {toon(SHOE_SOLE, '#000000')}
        </RoundedBox>
      </group>
    </group>
  );
}

export const RunnerShadow = forwardRef(function RunnerShadow(_props, ref) {
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <circleGeometry args={[0.45, 16]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.25} />
    </mesh>
  );
});
