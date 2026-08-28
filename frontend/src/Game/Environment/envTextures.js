import { useMemo } from "react";
import * as THREE from "three";

function hexToRgb(hex) {
  const value = String(hex || "#888888").replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

export function makeGroundTexture({ base, accent, size = 256, speck = 0.16, stripes = false }) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const a = hexToRgb(base);
  const b = hexToRgb(accent || base);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = Math.random();
      const wave = stripes ? (Math.sin(x * 0.35) * 0.08 + Math.sin(y * 0.08) * 0.04) : 0;
      const t = Math.min(1, Math.max(0, n * speck + wave + 0.35));
      const i = (y * size + x) * 4;
      img.data[i] = mix(a.r, b.r, t);
      img.data[i + 1] = mix(a.g, b.g, t);
      img.data[i + 2] = mix(a.b, b.b, t);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function useMapTextures(map) {
  return useMemo(() => {
    const asphalt = makeGroundTexture({
      base: map.road,
      accent: map.roadAccent,
      speck: 0.28,
      stripes: true,
    });
    asphalt.repeat.set(2.2, 18);
    const sidewalk = makeGroundTexture({
      base: map.sidewalk,
      accent: map.curb,
      speck: 0.14,
    });
    sidewalk.repeat.set(1.4, 16);
    const grass = makeGroundTexture({
      base: map.grass,
      accent: map.grassDark,
      speck: 0.22,
    });
    grass.repeat.set(6, 14);
    return { asphalt, sidewalk, grass };
  }, [map.id, map.road, map.roadAccent, map.sidewalk, map.curb, map.grass, map.grassDark]);
}
