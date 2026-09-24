export type GuitarPath =
  | "rhythm"
  | "lead"
  | "bass"
  | "piano"
  | "clean_vocals"
  | "vocals"
  | "ukulele";

export interface Profile {
  id: string;
  name: string;
  color: string;
  created_at: string;
  /** When this profile allowed audio input; null means not allowed. */
  audio_consent_at: string | null;
}

export interface SkillWithProgress {
  id: string;
  path: GuitarPath;
  category: string;
  name: string;
  description: string;
  generator_type: string;
  config: Record<string, unknown>;
  mastery_reps: number;
  sort_order: number;
  total_reps: number;
  last_practiced_at: string | null;
  best_tempo: number | null;
}

export interface Session {
  id: string;
  profile_id: string;
  skill_id: string;
  started_at: string;
  ended_at: string | null;
  sets_planned: number;
  reps_per_set_planned: number;
  sets_completed: number;
  reps_completed: number;
  misses: number;
  tempo_start: number | null;
  tempo_end: number | null;
  settings_snapshot: Record<string, unknown>;
}

export interface SessionSummary {
  id: string;
  skill_id: string;
  skill_name: string;
  path: GuitarPath;
  started_at: string;
  ended_at: string | null;
  sets_completed: number;
  reps_completed: number;
  tempo_start: number | null;
  tempo_end: number | null;
  difficulty: string | null;
}

export interface WeekCount {
  week_start: string;
  session_count: number;
}

export interface ProgressStats {
  total_sessions: number;
  current_streak_days: number;
  total_practice_seconds: number;
  skills_mastered: number;
  weekly_session_counts: WeekCount[];
}

export type Difficulty = "too_easy" | "easy" | "just_right" | "hard" | "too_hard";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  too_easy: "Too Easy",
  easy: "Easy",
  just_right: "Just Right",
  hard: "Hard",
  too_hard: "Too Hard",
};

export const PATH_LABELS: Record<GuitarPath, string> = {
  rhythm: "Rhythm Guitar",
  lead: "Lead Guitar",
  bass: "Bass Guitar",
  piano: "Piano",
  clean_vocals: "Clean Vocals",
  vocals: "Extreme Vocals",
  ukulele: "Ukulele",
};

export const PATH_ACCENT: Record<GuitarPath, { text: string; bg: string; tint: string }> = {
  rhythm: { text: "text-rhythm", bg: "bg-rhythm", tint: "bg-rhythm-tint" },
  lead: { text: "text-lead", bg: "bg-lead", tint: "bg-lead-tint" },
  bass: { text: "text-bass", bg: "bg-bass", tint: "bg-bass-tint" },
  piano: { text: "text-piano", bg: "bg-piano", tint: "bg-piano-tint" },
  clean_vocals: { text: "text-clean-vocals", bg: "bg-clean-vocals", tint: "bg-clean-vocals-tint" },
  vocals: { text: "text-vocals", bg: "bg-vocals", tint: "bg-vocals-tint" },
  ukulele: { text: "text-ukulele", bg: "bg-ukulele", tint: "bg-ukulele-tint" },
};

/** A tutorial pick; see src-tauri/src/tutorials.rs for how it's ranked. */
export interface TutorialVideo {
  video_id: string;
  title: string;
  channel: string;
  thumbnail_url: string;
  duration_seconds: number;
  views: number;
  /** null when the uploader hides likes. */
  likes: number | null;
  comments_sampled: number;
  positive_comments: number;
  negative_comments: number;
  score: number;
}

export interface SkillTutorial {
  query: string;
  /** A plain YouTube search for the same query, for when there's no pick. */
  search_url: string;
  /** Best first. */
  videos: TutorialVideo[];
  fetched_at: string | null;
  /** True when YOUTUBE_API_KEY isn't set in src-tauri/.env. */
  missing_api_key: boolean;
}

export interface TabSummary {
  id: string;
  title: string;
  artist: string;
  tuning: string;
  capo: number;
  file_name: string;
  mime_type: string;
  created_at: string;
}

export interface TabDetail extends TabSummary {
  /** The tab text for text files; null for files that open in another app. */
  content: string | null;
}

/** Events streamed from the Rust audio analysis (see src-tauri/src/audio/analysis.rs). */
export type AudioEvent =
  | { type: "frame"; t: number; hz: number | null; clarity: number; level_db: number; clipping: boolean }
  | { type: "onset"; t: number }
  | { type: "note"; t: number; hz: number; legato: boolean }
  | { type: "error"; message: string };

export interface AudioInputInfo {
  id: string;
  name: string;
  channels: number;
  sample_rate: number;
  is_default: boolean;
  likely_instrument: boolean;
}

export interface AudioSettings {
  device_id: string | null;
  /** Input channel to listen to; null mixes all channels. */
  channel: number | null;
  gate_db: number;
  a4_hz: number;
}

export interface StartedInput {
  session: number;
  device_name: string;
  sample_rate: number;
  channels: number;
}

export interface PlayAlongRunSummary {
  id: string;
  tab_id: string;
  started_at: string;
  ended_at: string;
  completed: boolean;
  notes_played: number;
  first_try_hits: number;
  retried_hits: number;
  skipped: number;
  wrong_notes: number;
}
