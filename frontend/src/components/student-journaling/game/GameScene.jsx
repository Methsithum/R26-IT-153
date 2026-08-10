import { Suspense, useCallback, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import Player from './Player';
import Collectible, { generateCollectibles } from './Collectible';
import Obstacle, { generateObstacles } from './Obstacle';
import QuestionGate, { generateQuestionGates } from './QuestionGate';
import MissionGoal from './MissionGoal';
import GameEnvironment, { GameLighting } from './GameEnvironment';
import { LANES, MAP_COMPLETE_DISTANCE } from '../../../constants/gameMaps';

function RunnerCamera({ playerPosRef, isPaused }) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const p = playerPosRef.current;
    const followSpeed = isPaused ? 4 : 10;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, p.x * 0.35, followSpeed * delta);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 3.8, followSpeed * delta);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, p.z + 7, followSpeed * delta);
    lookAt.current.set(p.x * 0.15, 1.6, p.z - 18);
    camera.lookAt(lookAt.current);
  });

  return null;
}

/** Temple Run–style path with stone blocks and cliff walls */
function EnhancedPath({ color, accent, secondary }) {
  const blocks = useMemo(() => {
    const items = [];
    for (let i = 0; i < 90; i++) {
      items.push({ z: -i * 5.5, shade: i % 2 });
    }
    return items;
  }, []);

  return (
    <group>
      {/* cliff sides */}
      {[-7, 7].map((x) => (
        <group key={x} position={[x, 0, -150]}>
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[2.5, 2.4, 500]} />
            <meshStandardMaterial color={secondary || '#1a3324'} roughness={0.95} />
          </mesh>
          {/* torches */}
          {Array.from({ length: 25 }).map((_, i) => (
            <group key={i} position={[x > 0 ? -0.8 : 0.8, 1.8, -i * 20]}>
              <mesh>
                <boxGeometry args={[0.12, 0.35, 0.12]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
              <mesh position={[0, 0.35, 0]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.9} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* main path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -150]} receiveShadow>
        <planeGeometry args={[11, 520]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>

      {/* stone block rhythm */}
      {blocks.map((b) => (
        <group key={b.z} position={[0, 0, b.z]}>
          {LANES.map((lane) => (
            <mesh key={lane} rotation={[-Math.PI / 2, 0, 0]} position={[lane, 0.02, 0]}>
              <planeGeometry args={[2.4, 4.8]} />
              <meshStandardMaterial
                color={b.shade ? color : secondary || '#234a32'}
                roughness={0.9}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* center stripe */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -150]}>
        <planeGeometry args={[0.15, 520]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
      </mesh>

      {/* glowing rails */}
      {[-5.75, 5.75].map((x) => (
        <mesh key={x} position={[x, 0.2, -150]}>
          <boxGeometry args={[0.14, 0.35, 520]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function WorldScroller({
  mapDef,
  onCollect,
  onHit,
  onResolveGate,
  playerPosRef,
  laneIndexRef,
  resolvedGateIds,
  customGates,
  minimalWorld,
  collectibleCount = 30,
}) {
  const collectibles = useMemo(
    () => (minimalWorld ? [] : generateCollectibles(mapDef, collectibleCount)),
    [mapDef?.id, minimalWorld, collectibleCount],
  );
  const obstacles = useMemo(() => (minimalWorld ? [] : generateObstacles(12)), [mapDef?.id, minimalWorld]);
  const staticGates = useMemo(() => generateQuestionGates(mapDef?.id), [mapDef?.id]);
  const gates = customGates ?? staticGates;
  const accent = mapDef?.accentColor || '#4ade80';

  return (
    <>
      <EnhancedPath
        color={mapDef?.groundColor || '#2d5a3d'}
        accent={accent}
        secondary={mapDef?.pathSecondary || '#1e4030'}
      />
      <GameEnvironment mapDef={mapDef} />
      <Sparkles count={80} scale={[8, 4, 100]} size={2.5} speed={0.25} color={accent} position={[0, 3, -50]} />
      <Cloud opacity={0.25} speed={0.1} segments={20} position={[-6, 8, -30]} />
      <Cloud opacity={0.2} speed={0.08} segments={16} position={[7, 7, -60]} />

      {!minimalWorld && collectibles.map((c) => (
        <Collectible key={c.id} type={c.type} position={c.position} onCollect={onCollect} playerPosRef={playerPosRef} />
      ))}
      {!minimalWorld && obstacles.map((o) => (
        <Obstacle key={o.id} type={o.type} position={o.position} onHit={onHit} playerPosRef={playerPosRef} />
      ))}
      {gates.map((gate) => (
        <QuestionGate
          key={gate.id}
          gate={gate}
          playerPosRef={playerPosRef}
          laneIndexRef={laneIndexRef}
          resolved={resolvedGateIds.includes(gate.id)}
          onResolve={onResolveGate}
          accent={accent}
        />
      ))}
      {!minimalWorld && <MissionGoal z={-MAP_COMPLETE_DISTANCE} accent={accent} />}
    </>
  );
}

function SceneContent({
  mapDef,
  laneIndexRef,
  jumpQueuedRef,
  haltMovement,
  slowCamera,
  resolvedGateIds,
  onTick,
  onCollect,
  onHit,
  onResolveGate,
  customGates,
  minimalWorld,
  collectibleCount,
}) {
  const playerPosRef = useRef({ x: 0, y: 1.05, z: 0 });

  const handlePosition = useCallback((pos) => {
    playerPosRef.current = pos;
    onTick(Math.abs(pos.z), pos.z);
  }, [onTick]);

  return (
    <>
      <color attach="background" args={[mapDef?.skyColor || '#0a1628']} />
      <fog attach="fog" args={[mapDef?.fogColor || '#1a3a2a', 30, 130]} />
      <GameLighting mapDef={mapDef} />
      <RunnerCamera playerPosRef={playerPosRef} isPaused={slowCamera} />
      <Player
        laneIndexRef={laneIndexRef}
        jumpQueuedRef={jumpQueuedRef}
        haltMovement={haltMovement}
        onPositionChange={handlePosition}
      />
      <WorldScroller
        mapDef={mapDef}
        onCollect={onCollect}
        onHit={onHit}
        onResolveGate={onResolveGate}
        playerPosRef={playerPosRef}
        laneIndexRef={laneIndexRef}
        resolvedGateIds={resolvedGateIds}
        customGates={customGates}
        minimalWorld={minimalWorld}
        collectibleCount={collectibleCount}
      />
    </>
  );
}

export default function GameScene({
  mapDef,
  gameState,
  laneIndexRef,
  jumpQueuedRef,
  onTick,
  onCollect,
  onHit,
  onResolveGate,
  customGates,
  minimalWorld,
  collectibleCount,
}) {
  const haltMovement = gameState.haltMovement ?? gameState.missionComplete;
  const slowCamera = gameState.slowCamera ?? (gameState.isPaused || gameState.missionComplete);
  if (!mapDef) return null;

  return (
    <div className="absolute inset-0 touch-none z-0 pointer-events-none">
      <Canvas
        frameloop="always"
        shadows
        dpr={[1, 1.5]}
        style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
        camera={{ position: [0, 3.8, 7], fov: 58, near: 0.1, far: 220 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <SceneContent
            mapDef={mapDef}
            laneIndexRef={laneIndexRef}
            jumpQueuedRef={jumpQueuedRef}
            haltMovement={haltMovement}
            slowCamera={slowCamera}
            resolvedGateIds={gameState.resolvedGateIds}
            onTick={onTick}
            onCollect={onCollect}
            onHit={onHit}
            onResolveGate={onResolveGate}
            customGates={customGates}
            minimalWorld={minimalWorld}
            collectibleCount={collectibleCount}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
