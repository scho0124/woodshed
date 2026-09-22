-- Piano path skills. These use the piano generators registered in
-- src/generators/index.ts, which draw a keyboard instead of a fretboard.

INSERT INTO skills (id, path, category, name, description, generator_type, config, mastery_reps, sort_order) VALUES

('piano.triads', 'piano', 'Chords', 'Major & Minor Triads',
 'Root-position triads across the common keys. Land all three notes together and keep the hand relaxed between changes.',
 'piano_chord_picker',
 '{"pool": ["C","Dm","Em","F","G","Am","D","E","A","Bb"], "default_selected": ["C","Dm","Em","F","G","Am"], "default_bpm": 60, "min_bpm": 40, "max_bpm": 140, "default_sets": 4, "default_reps": 8}'::jsonb,
 200, 10),

('piano.triad_inversions', 'piano', 'Chords', 'Triad Inversions',
 'Each chord is cued in root position, 1st or 2nd inversion. Move to the nearest voicing instead of jumping the whole hand.',
 'piano_chord_picker',
 '{"pool": ["C","F","G","Am","Dm","Em"], "default_selected": ["C","F","G","Am"], "inversions": true, "default_bpm": 56, "min_bpm": 40, "max_bpm": 120, "default_sets": 4, "default_reps": 8}'::jsonb,
 240, 20),

('piano.seventh_chords', 'piano', 'Chords', '7th Chords',
 'Major 7, dominant 7 and minor 7 voicings, the building blocks of jazz and pop comping.',
 'piano_chord_picker',
 '{"pool": ["Cmaj7","Dm7","Em7","Fmaj7","G7","Am7","D7","E7"], "default_selected": ["Cmaj7","Dm7","G7","Am7"], "default_bpm": 54, "min_bpm": 40, "max_bpm": 120, "default_sets": 3, "default_reps": 8}'::jsonb,
 220, 30),

('piano.major_scales', 'piano', 'Scales', 'Major Scales',
 'One key at a time, one octave up and down. Keep the thumb-under smooth and the tempo even.',
 'piano_scale_picker',
 '{"scale": "major", "pool": ["C","G","D","A","E","F","Bb","Eb"], "default_selected": ["C","G","D","F"], "pool_label": "Keys", "default_bpm": 72, "min_bpm": 40, "max_bpm": 160, "default_sets": 3, "default_reps": 6}'::jsonb,
 240, 40),

('piano.minor_scales', 'piano', 'Scales', 'Natural Minor Scales',
 'The relative minors of the keys you already know, one octave up and down.',
 'piano_scale_picker',
 '{"scale": "natural_minor", "pool": ["A","E","B","D","G","C","F#"], "default_selected": ["A","E","D"], "pool_label": "Keys", "default_bpm": 66, "min_bpm": 40, "max_bpm": 160, "default_sets": 3, "default_reps": 6}'::jsonb,
 240, 50),

('piano.note_finding', 'piano', 'Reading', 'Note Finding',
 'A note name appears and you play every copy of it on the keyboard, low to high. Builds instant key recognition for reading.',
 'piano_note_finder',
 '{"pool": ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"], "default_selected": ["C","D","E","F","G","A","B"], "pool_label": "Notes", "tempo_label": "Cue tempo", "default_bpm": 40, "min_bpm": 20, "max_bpm": 100, "default_sets": 3, "default_reps": 10}'::jsonb,
 300, 60);

-- Tab library: files a profile uploads, with metadata for search and sorting.
-- Text tabs are shown in the app; other files (PDF, Guitar Pro) open in the
-- system's default app.
CREATE TABLE tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  tuning TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tabs_profile ON tabs(profile_id, created_at DESC);
