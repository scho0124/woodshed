import { create } from "zustand";
import type { GuitarPath, Profile, SkillWithProgress } from "@/lib/types";

export interface SessionConfig {
  sets: number;
  repsPerSet: number;
  tempo: number;
  restSeconds: number;
  selectedPoolItems: string[];
  autoProgress: boolean;
}

export type TabSortKey = "title" | "artist" | "tuning" | "created_at";

/** Tab library search/sort, kept here so it survives opening a tab and coming back. */
export interface TabFilters {
  query: string;
  tuning: string | null;
  sortKey: TabSortKey;
  sortDir: "asc" | "desc";
}

interface AppState {
  profile: Profile | null;
  activePath: GuitarPath | null;
  activeSkill: SkillWithProgress | null;
  sessionConfig: SessionConfig | null;
  activeSessionId: string | null;
  sessionStartedAt: string | null;
  tabFilters: TabFilters;

  setProfile: (profile: Profile | null) => void;
  setActivePath: (path: GuitarPath | null) => void;
  setActiveSkill: (skill: SkillWithProgress | null) => void;
  setSessionConfig: (config: SessionConfig) => void;
  setActiveSessionId: (id: string | null) => void;
  setSessionStartedAt: (iso: string | null) => void;
  setTabFilters: (patch: Partial<TabFilters>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  activePath: null,
  activeSkill: null,
  sessionConfig: null,
  activeSessionId: null,
  sessionStartedAt: null,
  tabFilters: { query: "", tuning: null, sortKey: "title", sortDir: "asc" },

  setProfile: (profile) => set({ profile }),
  setActivePath: (activePath) => set({ activePath }),
  setActiveSkill: (activeSkill) => set({ activeSkill }),
  setSessionConfig: (sessionConfig) => set({ sessionConfig }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setSessionStartedAt: (sessionStartedAt) => set({ sessionStartedAt }),
  setTabFilters: (patch) => set((s) => ({ tabFilters: { ...s.tabFilters, ...patch } })),
}));
