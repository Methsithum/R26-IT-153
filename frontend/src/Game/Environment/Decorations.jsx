import { Tree, LampPost, Hedge, Bush, Fence } from "./props";

export default function Decoration({ decoration, map }) {
  const x = decoration.side * decoration.offset;
  const position = [x, 0, decoration.z];
  if (decoration.kind === "hedge") {
    return <Hedge position={position} map={map} length={decoration.length || 9} />;
  }
  if (decoration.kind === "bush") {
    return <Bush position={position} map={map} scale={decoration.scale || 1} />;
  }
  if (decoration.kind === "fence") {
    return <Fence position={position} map={map} />;
  }
  if (decoration.kind === "lamp") {
    return <LampPost position={position} map={map} />;
  }
  return <Tree position={position} map={map} scale={decoration.scale || 1} />;
}
