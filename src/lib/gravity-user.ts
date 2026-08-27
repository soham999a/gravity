"use client";

import { create } from "zustand";

export interface GravityUser {
  name: string;
  role: string;
  onboarded: boolean;
  intents: string[];
  defaultSurface: "home" | "projects";
  confirmDelete: boolean;
}

const STORAGE_KEY = "gravity.user.v1";

const defaults: GravityUser = {
  name: "",
  role: "",
  onboarded: false,
  intents: [],
  defaultSurface: "home",
  confirmDelete: true,
};

export const INTENTS = [
  { label: "ANALYZE", description: "Find the signal in what you already have." },
  { label: "DECIDE", description: "Turn a hard choice into a reasoned recommendation." },
  { label: "RESEARCH", description: "Explore a question with the right depth." },
  { label: "CREATE", description: "Make something from a blank page." },
  { label: "PLAN", description: "Break ambition into an executable sequence." },
  { label: "MEASURE", description: "Let computation speak before models do." },
];

function load(): GravityUser {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<GravityUser>) };
  } catch {
    return defaults;
  }
}

interface GravityUserState extends GravityUser {
  hydrate: () => void;
  update: (patch: Partial<GravityUser>) => void;
  complete: (patch: Pick<GravityUser, "name" | "role" | "intents">) => void;
  reset: () => void;
}

function persist(state: GravityUserState) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        name: state.name,
        role: state.role,
        onboarded: state.onboarded,
        intents: state.intents,
        defaultSurface: state.defaultSurface,
        confirmDelete: state.confirmDelete,
      }),
    );
  } catch {
    /* storage unavailable */
  }
}

export const useGravityUser = create<GravityUserState>((set, get) => ({
  ...defaults,
  hydrate: () => set(load()),
  update: (patch) => {
    set(patch);
    persist(get());
  },
  complete: (patch) => {
    set({ ...patch, onboarded: true });
    persist(get());
  },
  reset: () => {
    set(defaults);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
}));