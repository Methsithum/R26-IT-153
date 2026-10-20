import { motion } from "framer-motion";
import { buildSmoothPath } from "./chartMath";
import { BRAND } from "./chartTheme";

export default function Sparkline({ values = [], width = 90, height = 28, color = BRAND[500] }) {
  if (!values || values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="trend sparkline">
      <motion.path
        d={buildSmoothPath(points)}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6 }}
      />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={1.8} fill={color} />
    </svg>
  );
}
