import { Suspense, useCallback, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import Player from './Player';
import Collectible, { generateCollectibles } from './Collectible';
import Obstacle, { generateObstacles } from './Obstacle';
import GameEnvironment, { GameLighting } from './GameEnvironment';
import GuideCharacter from './GuideCharacter';
import Monster from './Monster';
import { LANES } from '../../../constants/gameMaps';

function RunnerCamera({ playerPosRef, isPaused }) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const p = playerPosRef.current;
    const followSpeed = isPaused ? 4 : 10;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, p.x * 0.3, followSpeed * delta);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 3.4, followSpeed * delta);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, p.z + 6, followSpeed * delta);
    lookAt.current.set(p.x * 0.12, 1.45, p.z - 16);
    camera.lookAt(lookAt.current);
  });

  return null;
}

/** Temple Run–style 3-lane path with glowing edges */
function StylizedPath({ color, accent }) {
  return (
    <group>
      {/* base path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -150]} receiveShadow>
        <planeGeometry args={[5.5, 500]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* center stripe */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -150]}>
        <planeGeometry args={[0.12, 500]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} />
      </mesh>
      {/* lane lines */}
      {LANES.slice(0, 2).map((lane, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[(lane + LANES[i + 1]) / 2, 0.025, -150]}>
          <planeGeometry args={[0.06, 500]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.2} />
        </mesh>
      ))}
      {/* glowing rails */}
      {[-2.85, 2.85].map((x) => (
        <mesh key={x} position={[x, 0.15, -150]}>
          <boxGeometry args={[0.12, 0.3, 500]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} />
        </mesh>
      ))}
      {/* path tiles (visual rhythm) */}
      {Array.from({ length: 80 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -i * 6]}>
          <planeGeometry args={[5.3, 2.8]} />
          <meshStandardMaterial color={i % 2 === 0 ? color : '#000000'} transparent opacity={i % 2 === 0 ? 1 : 0.06} />
        </mesh>
      ))}
    </group>
  );
}

function WorldScroller({ mapDef, onCollect, onHit, playerPosRef }) {
  const collectibles = useMemo(() => generateCollectibles(mapDef, 36), [mapDef?.id]);
  const obstacles = useMemo(() => generateObstacles(10), [mapDef?.id]);
  const accent = mapDef?.accentColor || '#4ade80';

  return (
    <>
      <StylizedPath color={mapDef?.groundColor || '#2d5a3d'} accent={accent} />
      <GameEnvironment mapDef={mapDef} />
      <Sparkles count={60} scale={[6, 3, 80]} size={2} speed={0.3} color={accent} position={[0, 2, -40]} />
      {collectibles.map((c) => (
        <Collectible key={c.id} type={c.type} position={c.position} onCollect={onCollect} playerPosRef={playerPosRef} />
      ))}
      {obstacles.map((o) => (
        <Obstacle key={o.id} type={o.type} position={o.position} onHit={onHit} playerPosRef={playerPosRef} />
      ))}
    </>
  );
}

function SceneContent({ mapDef, laneIndex, jumpTrigger, isPaused, showGuide, showMonster, bossDefeated, onTick, onCollect, onHit }) {
  const playerPosRef = useRef({ x: 0, y: 1.05, z: 0 });

  const handlePosition = useCallback((pos) => {
    playerPosRef.current = pos;
    onTick(Math.abs(pos.z));
  }, [onTick]);

  return (
    <>
      <color attach="background" args={[mapDef?.skyColor || '#0a1628']} />
      <fog attach="fog" args={[mapDef?.fogColor || '#1a3a2a', 35, 120]} />
      <GameLighting mapDef={mapDef} />
      <RunnerCamera playerPosRef={playerPosRef} isPaused={isPaused} />
      <Player laneIndex={laneIndex} jumpTrigger={jumpTrigger} isPaused={isPaused} onPositionChange={handlePosition} />
      <WorldScroller mapDef={mapDef} onCollect={onCollect} onHit={onHit} playerPosRef={playerPosRef} />
      <GuideCharacter visible={showGuide} />
      <Monster mapDef={mapDef} visible={showMonster} defeated={bossDefeated} />
    </>
  );
}

export default function GameScene({ mapDef, gameState, laneIndex, jumpTrigger, onTick, onCollect, onHit }) {
  const isPaused = gameState.isPaused || gameState.isCheckpoint || gameState.mapComplete;
  if (!mapDef) return null;

  return (
    <div className="absolute inset-0 touch-none z-0">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        style={{ width: '100%', height: '100%', display: 'block' }}
        camera={{ position: [0, 3.4, 6], fov: 55, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <SceneContent
            mapDef={mapDef}
            laneIndex={laneIndex}
            jumpTrigger={jumpTrigger}
            isPaused={isPaused}
            showGuide={gameState.isCheckpoint}
            showMonster={gameState.isBossEncounter || gameState.mapComplete}
            bossDefeated={gameState.bossDefeated}
            onTick={onTick}
            onCollect={onCollect}
            onHit={onHit}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
