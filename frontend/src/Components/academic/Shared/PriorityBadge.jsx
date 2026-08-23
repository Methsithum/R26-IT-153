import { PRIORITY_COLORS } from "../../../utils/featureNameMap";

export default function PriorityBadge({ priority, size = "md" }) {
  const colors = PRIORITY_COLORS[priority] || PRIORITY_COLORS.Medium;
  const sizeClasses = size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${colors.bg} ${colors.text} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {priority}
    </span>
  );
}
