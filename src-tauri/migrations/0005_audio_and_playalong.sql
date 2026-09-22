-- Audio input for the tuner and play-along.

-- When this profile allowed Woodshed to listen to the audio input. NULL means
-- not allowed; the backend refuses to start capture without it.
ALTER TABLE profiles ADD COLUMN audio_consent_at TIMESTAMPTZ;

-- Machine-wide settings (the audio device belongs to the computer, not a profile).
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Frets in a tab are relative to the capo, so play-along needs it to know the real pitch.
ALTER TABLE tabs ADD COLUMN capo INT NOT NULL DEFAULT 0;

-- One play-along attempt at a tab. Counts cover every pass through the tab,
-- including repeated passes through a loop. `details` holds per-step results.
CREATE TABLE playalong_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  completed BOOLEAN NOT NULL,
  notes_played INT NOT NULL,
  first_try_hits INT NOT NULL,
  retried_hits INT NOT NULL,
  skipped INT NOT NULL,
  wrong_notes INT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_playalong_runs_tab ON playalong_runs(tab_id, profile_id, started_at DESC);
CREATE INDEX idx_playalong_runs_profile ON playalong_runs(profile_id, started_at DESC);
