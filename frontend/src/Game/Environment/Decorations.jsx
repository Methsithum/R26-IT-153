import { Tree, LampPost } from "./props";

export default function Decoration({ decoration }) {
  const x = decoration.side * decoration.offset;
  const position = [x, 0, decoration.z];
  return decoration.kind === "tree" ? (
    <Tree position={position} />
  ) : (
    <LampPost position={position} />
  );
}
