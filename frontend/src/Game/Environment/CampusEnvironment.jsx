import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useRunnerStore } from "../state/runnerStore";
import { CHUNK_LENGTH, LOOKAHEAD_CHUNKS, BEHIND_CHUNKS, generateChunk } from "./chunkGenerator";
import Road from "./Road";
import Obstacle from "./Obstacles";
import Pickup from "./Pickups";
import Decoration from "./Decorations";
import BuildingLandmark from "./Buildings";

export default function CampusEnvironment() {
  const [chunks, setChunks] = useState(() =>
    Array.from({ length: LOOKAHEAD_CHUNKS }, (_, i) => generateChunk(i))
  );
  const lastCheckedChunk = useRef(0);

  useFrame(() => {
    const { posZ } = useRunnerStore.getState();
    const currentChunkIndex = Math.floor(posZ / CHUNK_LENGTH);
    if (currentChunkIndex === lastCheckedChunk.current) return;
    lastCheckedChunk.current = currentChunkIndex;

    setChunks((prev) => {
      const maxIndex = prev.length ? prev[prev.length - 1].index : -1;
      const needed = currentChunkIndex + LOOKAHEAD_CHUNKS;
      const additions = [];
      for (let i = maxIndex + 1; i <= needed; i++) additions.push(generateChunk(i));
      const merged = additions.length ? [...prev, ...additions] : prev;
      const minKeep = currentChunkIndex - BEHIND_CHUNKS;
      return merged.filter((c) => c.index >= minKeep);
    });
  });

  return (
    <group>
      <Road />
      {chunks.map((chunk) => (
        <group key={chunk.index}>
          {chunk.obstacles.map((o) => (
            <Obstacle key={o.id} obstacle={o} />
          ))}
          {(chunk.pickups || []).map((p) => (
            <Pickup key={p.id} pickup={p} />
          ))}
          {chunk.decorations.map((d) => (
            <Decoration key={d.id} decoration={d} />
          ))}
          {chunk.building && <BuildingLandmark building={chunk.building} />}
        </group>
      ))}
    </group>
  );
}
