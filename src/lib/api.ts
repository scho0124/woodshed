import { invoke } from "@tauri-apps/api/core";
import type {
  Profile,
  ProgressStats,
  Session,
  SessionSummary,
  SkillWithProgress,
  GuitarPath,
  TabDetail,
  TabSummary,
} from "./types";

export const api = {
  listProfiles: () => invoke<Profile[]>("list_profiles"),

  createProfile: (name: string, color: string) =>
    invoke<Profile>("create_profile", { name, color }),

  deleteProfile: (profileId: string) => invoke<void>("delete_profile", { profileId }),

  listSkillsByPath: (profileId: string, path: GuitarPath) =>
    invoke<SkillWithProgress[]>("list_skills_by_path", { profileId, path }),

  createSession: (input: {
    profile_id: string;
    skill_id: string;
    sets_planned: number;
    reps_per_set_planned: number;
    tempo_start: number | null;
    settings_snapshot: Record<string, unknown>;
  }) => invoke<Session>("create_session", { input }),

  logSessionEvent: (input: {
    session_id: string;
    seq: number;
    event_type: string;
    payload: Record<string, unknown>;
  }) => invoke<void>("log_session_event", { input }),

  completeSession: (input: {
    session_id: string;
    sets_completed: number;
    reps_completed: number;
    misses: number;
    tempo_end: number | null;
  }) => invoke<Session>("complete_session", { input }),

  listRecentSessions: (profileId: string, limit: number) =>
    invoke<SessionSummary[]>("list_recent_sessions", { profileId, limit }),

  submitFeedback: (input: {
    session_id: string;
    difficulty: string;
    tags: string[];
    notes: string;
  }) => invoke<void>("submit_feedback", { input }),

  getProgressStats: (profileId: string) =>
    invoke<ProgressStats>("get_progress_stats", { profileId }),

  exportSessionsJson: (profileId: string) =>
    invoke<string>("export_sessions_json", { profileId }),

  listTabs: (profileId: string) => invoke<TabSummary[]>("list_tabs", { profileId }),

  getTab: (id: string) => invoke<TabDetail>("get_tab", { id }),

  createTab: (input: {
    profile_id: string;
    title: string;
    artist: string;
    tuning: string;
    file_name: string;
    mime_type: string;
    data: number[];
  }) => invoke<TabSummary>("create_tab", { input }),

  updateTab: (input: { id: string; title: string; artist: string; tuning: string }) =>
    invoke<TabSummary>("update_tab", { input }),

  deleteTab: (id: string) => invoke<void>("delete_tab", { id }),

  openTabFile: (id: string) => invoke<void>("open_tab_file", { id }),
};
