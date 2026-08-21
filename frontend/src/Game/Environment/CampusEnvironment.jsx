import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useRunnerStore } from "../state/runnerStore";
import { useActiveMap } from "../state/mapStore";
import { CHUNK_LENGTH, LOOKAHEAD_CHUNKS, BEHIND_CHUNKS, generateChunk } from "./chunkGenerator";
import Road from "./Road";
import Obstacle from "./Obstacles";
import Pickup from "./Pickups";
import Decoration from "./Decorations";
import BuildingLandmark from "./Buildings";

function Horizon({ map }) {
  const ref = useRef();
  useFrame(() => {
    const { posZ } = useRunnerStore.getState();
    if (ref.current) ref.current.position.z = posZ + 70;
  });
  const hill = map.grassDark;
  return (
    <group ref={ref}>
      {[-48, -28, 28, 52].map((x, i) => (
        <mesh key={x} position={[x, -4 + (i % 2), -8]} scale={[18, 9 + (i % 3), 10]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={hill} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

export default function CampusEnvironment() {
  const map = useActiveMap();
  const [chunks, setChunks] = useState(() =>
    Array.from({ length: LOOKAHEAD_CHUNKS }, (_, i) => generateChunk(i, map))
  );
  const lastCheckedChunk = useRef(0);

  useEffect(() => {
    lastCheckedChunk.current = 0;
    setChunks(Array.from({ length: LOOKAHEAD_CHUNKS }, (_, i) => generateChunk(i, map)));
  }, [map.id]);

  useFrame(() => {
    const { posZ } = useRunnerStore.getState();
    const currentChunkIndex = Math.floor(posZ / CHUNK_LENGTH);
    if (currentChunkIndex === lastCheckedChunk.current) return;
    lastCheckedChunk.current = currentChunkIndex;

    setChunks((prev) => {
      const maxIndex = prev.length ? prev[prev.length - 1].index : -1;
      const needed = currentChunkIndex + LOOKAHEAD_CHUNKS;
      const additions = [];
      for (let i = maxIndex + 1; i <= needed; i++) additions.push(generateChunk(i, map));
      const merged = additions.length ? [...prev, ...additions] : prev;
      const minKeep = currentChunkIndex - BEHIND_CHUNKS;
      return merged.filter((c) => c.index >= minKeep);
    });
  });

  return (
    <group>
      <Horizon map={map} />
      <Road map={map} />
      {chunks.map((chunk) => (
        <group key={`${map.id}-${chunk.index}`}>
          {chunk.obstacles.map((o) => (
            <Obstacle key={o.id} obstacle={o} />
          ))}
          {(chunk.pickups || []).map((p) => (
            <Pickup key={p.id} pickup={p} />
          ))}
          {chunk.decorations.map((d) => (
            <Decoration key={d.id} decoration={d} map={map} />
          ))}
          {chunk.building && <BuildingLandmark building={chunk.building} map={map} />}
        </group>
      ))}
    </group>
  );
}
