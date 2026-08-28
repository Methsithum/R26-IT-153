import { GraduationCap, Sparkles } from "lucide-react";

// The app's mark: a graduation cap (uni student) with a small "smart"
// sparkle badge layered on top — reads as "AI-powered student tool" rather
// than a generic sparkle, without hand-authoring custom SVG paths.
export default function Logo({ size = 40, className = "" }) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-2xl bg-gradient-to-br bg-accent-blue flex items-center justify-center shadow-playful">
        <GraduationCap className="text-white" size={size * 0.56} strokeWidth={2.4} />
      </div>
      
    </div>
  );
}
