import {
  Tree,
  LampPost,
  Hedge,
  Bush,
  Fence,
  PlanterBox,
  Puddle,
  Colonnade,
  Reed,
  Bleacher,
  GoalPost,
} from "./props";

export default function Decoration({ decoration, map }) {
  const x = decoration.side * decoration.offset;
  const position = [x, 0, decoration.z];
  const scale = decoration.scale || 1;

  if (decoration.kind === "hedge") {
    return <Hedge position={position} map={map} length={decoration.length || 9} />;
  }
  if (decoration.kind === "bush") {
    return <Bush position={position} map={map} scale={scale} />;
  }
  if (decoration.kind === "fence") {
    return <Fence position={position} map={map} />;
  }
  if (decoration.kind === "lamp") {
    return <LampPost position={position} map={map} />;
  }
  if (decoration.kind === "planter") {
    return <PlanterBox position={position} map={map} />;
  }
  if (decoration.kind === "puddle") {
    return <Puddle position={position} scale={scale} />;
  }
  if (decoration.kind === "colonnade") {
    return <Colonnade position={position} map={map} />;
  }
  if (decoration.kind === "reed") {
    return <Reed position={position} map={map} scale={scale} />;
  }
  if (decoration.kind === "bleacher") {
    return <Bleacher position={position} map={map} side={decoration.side} />;
  }
  if (decoration.kind === "goal") {
    return <GoalPost position={position} map={map} />;
  }
  return <Tree position={position} map={map} scale={scale} />;
}
