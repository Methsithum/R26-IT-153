import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CAMPUS_MAPS, DEFAULT_MAP_ID, isMapUnlocked, resolveMap } from "../data/maps";
import { useGameStore } from "./GameStateManager";

export const useMapStore = create(
  persist(
    (set, get) => ({
      selectedMapId: DEFAULT_MAP_ID,
      selectMap: (id, level) => {
        const map = CAMPUS_MAPS.find((item) => item.id === id);
        if (!map || !isMapUnlocked(map, level)) return false;
        set({ selectedMapId: map.id });
        return true;
      },
      activeMap: (level) => resolveMap(get().selectedMapId, level),
    }),
    { name: "smart-uni-guide-campus-map-v1" }
  )
);

export function useActiveMap() {
  const level = useGameStore((s) => s.level);
  const selectedMapId = useMapStore((s) => s.selectedMapId);
  return resolveMap(selectedMapId, level);
}
