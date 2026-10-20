import { useState } from "react";
import { Download } from "lucide-react";
import { pngExportSize } from "./chartHelpers";

// Native SVG-to-canvas export, no dependency: serializes the sibling SVG to
// a data URL, draws it into an offscreen canvas at 2x scale, then triggers
// a PNG download.
export default function DownloadPngButton({ targetRef, fileName = "chart.png", scale = 2 }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const svg = targetRef?.current?.querySelector("svg");
    if (!svg) return;
    setBusy(true);
    try {
      const rect = svg.getBoundingClientRect();
      const { width, height } = pngExportSize(rect.width || 300, rect.height || 160, scale);
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Download PNG"
      aria-label="Download chart as PNG"
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
    >
      <Download size={12} strokeWidth={2.2} />
      PNG
    </button>
  );
}
