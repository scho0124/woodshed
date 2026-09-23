-- Ukulele path, standard GCEA tuning. Chord skills reuse random_chord_picker with
-- "instrument": "ukulele" so the diagram draws 4-string ukulele shapes (see
-- UKULELE_CHORD_SHAPES in src/lib/chordShapes.ts). Strumming, fingerpicking and
-- fretboard drills use cue_picker. Every skill has a tutorial_query.

INSERT INTO skills (id, path, category, name, description, generator_type, config, mastery_reps, sort_order) VALUES

-- Chords
('ukulele.first_chords', 'ukulele', 'Chords', 'First Chords',
 'C, Am, F and G play hundreds of songs. Keep the fretting hand relaxed and aim to land each shape before the next beat.',
 'random_chord_picker',
 '{"instrument": "ukulele", "pool": ["C","Am","F","G","Dm","Em","A","D"], "default_selected": ["C","Am","F","G"],
   "tutorial_query": "ukulele first chords C Am F G beginner lesson",
   "default_bpm": 60, "min_bpm": 40, "max_bpm": 140, "default_sets": 4, "default_reps": 8}'::jsonb,
 180, 10),

('ukulele.more_chords', 'ukulele', 'Chords', 'More Major & Minor Chords',
 'Opens up more keys, including the Bb and Bm barre shapes. Press with the side of the index finger for a cleaner barre.',
 'random_chord_picker',
 '{"instrument": "ukulele", "pool": ["D","A","Dm","Em","Bb","Gm","Bm","F#m","Cm"], "default_selected": ["D","A","Dm","Em","Bb"],
   "tutorial_query": "ukulele Bb chord and barre chords tutorial",
   "default_bpm": 56, "min_bpm": 40, "max_bpm": 130, "default_sets": 3, "default_reps": 8}'::jsonb,
 220, 20),

('ukulele.seventh_chords', 'ukulele', 'Chords', '7th Chords',
 'Dominant, minor and major 7ths. Most are one small change from a shape you already know.',
 'random_chord_picker',
 '{"instrument": "ukulele", "pool": ["C7","G7","A7","D7","E7","Am7","Cmaj7"], "default_selected": ["C7","G7","A7","D7"],
   "tutorial_query": "ukulele 7th chords tutorial",
   "default_bpm": 60, "min_bpm": 40, "max_bpm": 130, "default_sets": 3, "default_reps": 8}'::jsonb,
 200, 30),

-- Strumming
('ukulele.strumming', 'ukulele', 'Strumming', 'Strumming Patterns',
 'The patterns behind most ukulele songs. Keep the wrist moving down and up on every eighth note, even when you skip a strum.',
 'cue_picker',
 '{"pool": ["DOWN","DU","ISLAND","CHUCK","SWING","WALTZ","REGGAE"], "default_selected": ["DOWN","DU","ISLAND"], "pool_label": "Patterns", "tempo_label": "Strum tempo",
   "cues": {"DOWN": "D  D  D  D. One even downstroke per beat",
            "DU": "D U D U D U D U. Steady eighth notes",
            "ISLAND": "D - D U - U D U. The classic island strum",
            "CHUCK": "D X D X. Mute the strings with your palm on 2 and 4",
            "SWING": "D-du D-du. Long down, short up",
            "WALTZ": "D  D U  D U in 3/4. Count 1, 2 and, 3 and",
            "REGGAE": "- U - U. Upstrokes on the offbeats only"},
   "tutorial_query": "ukulele strumming patterns for beginners",
   "default_bpm": 72, "min_bpm": 50, "max_bpm": 160, "default_sets": 3, "default_reps": 6}'::jsonb,
 200, 40),

-- Fingerstyle
('ukulele.fingerpicking', 'ukulele', 'Fingerstyle', 'Fingerpicking Patterns',
 'Thumb on G and C, index on C, middle on E, ring on A. Hold a C chord and loop each pattern until it runs on its own.',
 'cue_picker',
 '{"pool": ["ROLL","PINCH","ARCH","ALT"], "default_selected": ["ROLL","PINCH","ARCH"], "pool_label": "Patterns", "tempo_label": "Picking tempo",
   "cues": {"ROLL": "G C E A. Thumb, index, middle, ring, one note each",
            "PINCH": "Thumb and ring together, then index, then middle",
            "ARCH": "G C E A E C. Up to the A string and back down",
            "ALT": "Thumb alternates G and C while the ring picks A"},
   "tutorial_query": "ukulele fingerpicking patterns beginner",
   "default_bpm": 60, "min_bpm": 40, "max_bpm": 140, "default_sets": 3, "default_reps": 6}'::jsonb,
 220, 50),

-- Fretboard
('ukulele.fretboard_notes', 'ukulele', 'Fretboard', 'Fretboard Notes',
 'A note name appears and you find it on the neck. Builds the map you need for melodies and moving chord shapes.',
 'cue_picker',
 '{"pool": ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"], "default_selected": ["C","D","E","F","G","A","B"], "pool_label": "Notes", "tempo_label": "Cue tempo",
   "patterns": ["Find it on the A string", "Find it on the E string", "Find it on the C string",
                "Find it on the G string", "Find it on every string, low to high"],
   "tutorial_query": "learn the notes on the ukulele fretboard",
   "default_bpm": 30, "min_bpm": 15, "max_bpm": 90, "default_sets": 3, "default_reps": 10}'::jsonb,
 300, 60);
