import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  AudioEvent,
  AudioInputInfo,
  AudioSettings,
  PlayAlongRunSummary,
  Profile,
  StartedInput,
  ProgressStats,
  Session,
  SessionSummary,
  SkillTutorial,
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

  /** `refresh` skips the cached pick and asks YouTube again. */
  getSkillTutorial: (skillId: string, refresh = false) =>
    invoke<SkillTutorial>("get_skill_tutorial", { skillId, refresh }),

  /** Plays a tutorial in Woodshed's player window (in the browser off Linux). */
  watchTutorial: (videoId: string, title: string) =>
    invoke<void>("watch_tutorial", { videoId, title }),

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
    capo: number;
    file_name: string;
    mime_type: string;
    data: number[];
  }) => invoke<TabSummary>("create_tab", { input }),

  updateTab: (input: { id: string; title: string; artist: string; tuning: string; capo: number }) =>
    invoke<TabSummary>("update_tab", { input }),

  deleteTab: (id: string) => invoke<void>("delete_tab", { id }),

  openTabFile: (id: string) => invoke<void>("open_tab_file", { id }),

  listAudioInputs: () => invoke<AudioInputInfo[]>("list_audio_inputs"),

  getAudioSettings: () => invoke<AudioSettings>("get_audio_settings"),

  setAudioSettings: (settings: AudioSettings) =>
    invoke<AudioSettings>("set_audio_settings", { settings }),

  setAudioConsent: (profileId: string, granted: boolean) =>
    invoke<Profile>("set_audio_consent", { profileId, granted }),

  startAudioInput: (profileId: string, range: "guitar" | "bass" | "voice", onEvent: Channel<AudioEvent>) =>
    invoke<StartedInput>("start_audio_input", { profileId, range, onEvent }),

  /** Pass the session from startAudioInput; null stops whatever is running. */
  stopAudioInput: (session: number | null) => invoke<void>("stop_audio_input", { session }),

  createPlayAlongRun: (input: {
    profile_id: string;
    tab_id: string;
    started_at: string;
    ended_at: string;
    completed: boolean;
    notes_played: number;
    first_try_hits: number;
    retried_hits: number;
    skipped: number;
    wrong_notes: number;
    settings: Record<string, unknown>;
    details: Record<string, unknown>;
  }) => invoke<PlayAlongRunSummary>("create_playalong_run", { input }),

  listPlayAlongRuns: (profileId: string, tabId: string) =>
    invoke<PlayAlongRunSummary[]>("list_playalong_runs", { profileId, tabId }),
};
