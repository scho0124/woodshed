-- Core schema for Woodshed: profiles, the extensible skill catalog,
-- practice sessions, per-rep session events, and post-session feedback.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE guitar_path AS ENUM ('rhythm', 'lead', 'bass');

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#E3A458',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A skill is data, not code: a generator_type names the algorithm that
-- picks prompts (in the frontend's generator registry) and config carries
-- that generator's parameters. New skills that reuse an existing
-- generator_type are added purely as rows (see 0002_seed_skills.sql).
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  path guitar_path NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  generator_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  mastery_reps INT NOT NULL DEFAULT 200,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  sets_planned INT NOT NULL,
  reps_per_set_planned INT NOT NULL,
  sets_completed INT NOT NULL DEFAULT 0,
  reps_completed INT NOT NULL DEFAULT 0,
  misses INT NOT NULL DEFAULT 0,
  tempo_start INT,
  tempo_end INT,
  settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE session_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_profile ON sessions(profile_id, started_at DESC);
CREATE INDEX idx_sessions_skill ON sessions(skill_id);
CREATE INDEX idx_skills_path ON skills(path, sort_order);
CREATE INDEX idx_session_events_session ON session_events(session_id, seq);
