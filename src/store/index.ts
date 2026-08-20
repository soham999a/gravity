"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Mission } from "@/types";

interface GravityState {
  recentMissions: Mission[];
  activeMissionId: string | null;
  density: "comfortable" | "compact";
  addRecentMission: (mission: Mission) => void;
  setActiveMission: (id: string | null) => void;
  setDensity: (d: "comfortable" | "compact") => void;
}

export const useGravityStore = create<GravityState>()(
  persist(
    (set) => ({
      recentMissions: [] as Mission[],
      activeMissionId: null as string | null,
      density: "comfortable" as "comfortable" | "compact",
      addRecentMission: (mission: Mission) =>
        set((state) => ({
          recentMissions: [mission, ...state.recentMissions.filter((m) => m.id !== mission.id)].slice(0, 12),
        })),
      setActiveMission: (id: string | null) => set({ activeMissionId: id }),
      setDensity: (d: "comfortable" | "compact") => set({ density: d }),
    }),
    { name: "gravity.state.v1" }
  )
);
