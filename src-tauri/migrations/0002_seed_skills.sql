-- Starter skill catalog across all three paths. Adding a new skill that
-- reuses an existing generator_type is exactly this: one INSERT, no code
-- change. A skill needing a new kind of prompt logic also needs a new
-- generator registered in src/generators/index.ts on the frontend.

INSERT INTO skills (id, path, category, name, description, generator_type, config, mastery_reps, sort_order) VALUES

-- Rhythm Guitar
('rhythm.open_chords_basic', 'rhythm', 'Chords', 'Open Chords (Basic)',
 'Randomly cycles through open-position chords from your selected pool. Focus on clean transitions and consistent strum timing before the next chord loads.',
 'random_chord_picker',
 '{"pool": ["E","A","D","G","C","Am","Em","Dm","F"], "default_selected": ["E","A","D","G","C","Am","Em"], "default_bpm": 72, "min_bpm": 40, "max_bpm": 160, "default_sets": 4, "default_reps": 8}'::jsonb,
 200, 10),

('rhythm.barre_chords', 'rhythm', 'Chords', 'Barre Chords',
 'Movable major and minor barre shapes rooted on the low-E and A strings. Watch for buzz on the barred strings.',
 'random_chord_picker',
 '{"pool": ["F","Bm","B","F#m","C#m","Gm"], "default_selected": ["F","Bm","B","F#m"], "default_bpm": 60, "min_bpm": 40, "max_bpm": 140, "default_sets": 3, "default_reps": 6}'::jsonb,
 240, 20),

('rhythm.power_chords', 'rhythm', 'Chords', 'Power Chords',
 'Two and three-note 5-chords for driving rhythm parts. Mute the unused strings cleanly.',
 'random_chord_picker',
 '{"pool": ["E5","A5","D5","G5","C5","B5"], "default_selected": ["E5","A5","D5","G5","C5"], "default_bpm": 100, "min_bpm": 60, "max_bpm": 180, "default_sets": 4, "default_reps": 10}'::jsonb,
 180, 30),

('rhythm.seventh_chords', 'rhythm', 'Chords', '7th Chords',
 'Dominant, major and minor 7th voicings layered on top of the open-chord shapes you already know.',
 'random_chord_picker',
 '{"pool": ["E7","A7","D7","G7","Cmaj7","Am7","Dm7"], "default_selected": ["E7","A7","D7","G7"], "default_bpm": 66, "min_bpm": 40, "max_bpm": 140, "default_sets": 3, "default_reps": 8}'::jsonb,
 220, 40),

('rhythm.add9_sus_chords', 'rhythm', 'Chords', 'Add9 & Sus Chords',
 'Color tones for open voicings: sus2, sus4 and add9 shapes that sit well under vocals.',
 'random_chord_picker',
 '{"pool": ["Dsus2","Dsus4","Asus2","Asus4","Cadd9","Gadd9"], "default_selected": ["Dsus2","Dsus4","Asus2","Cadd9"], "default_bpm": 68, "min_bpm": 40, "max_bpm": 140, "default_sets": 3, "default_reps": 8}'::jsonb,
 220, 50),

-- Lead Guitar
('lead.minor_pentatonic_box1', 'lead', 'Scales', 'Minor Pentatonic Box 1',
 'The first minor pentatonic shape, cued note by note up and down the box. Lock in with a metronome before adding phrasing.',
 'scale_pattern_picker',
 '{"scale": "minor_pentatonic", "positions": [1], "default_position": 1, "default_bpm": 80, "min_bpm": 50, "max_bpm": 160, "default_sets": 3, "default_reps": 12}'::jsonb,
 300, 10),

('lead.minor_pentatonic_all_positions', 'lead', 'Scales', 'Minor Pentatonic (All 5 Positions)',
 'Random note cues drawn from all five pentatonic box positions to build fretboard-wide fluency.',
 'scale_pattern_picker',
 '{"scale": "minor_pentatonic", "positions": [1,2,3,4,5], "default_position": null, "default_bpm": 76, "min_bpm": 50, "max_bpm": 160, "default_sets": 4, "default_reps": 12}'::jsonb,
 400, 20),

('lead.alternate_picking', 'lead', 'Technique', 'Alternate Picking Drills',
 'Strict down-up picking through pentatonic runs at a click. Speed comes after accuracy.',
 'scale_pattern_picker',
 '{"scale": "chromatic_run", "positions": [1], "default_position": 1, "default_bpm": 90, "min_bpm": 60, "max_bpm": 200, "default_sets": 4, "default_reps": 16}'::jsonb,
 350, 30),

-- Bass Guitar
('bass.root_fifth_grooves', 'bass', 'Grooves', 'Root-Fifth Grooves',
 'Locks root-fifth patterns to a click across common progressions. Locking in with the kick matters more than speed.',
 'groove_root_picker',
 '{"roots": ["E","A","D","G","C"], "pattern": "root_fifth", "default_bpm": 90, "min_bpm": 60, "max_bpm": 160, "default_sets": 3, "default_reps": 8}'::jsonb,
 240, 10),

('bass.walking_bass_lines', 'bass', 'Grooves', 'Walking Bass Lines',
 'Quarter-note walking lines connecting chord roots. Cues the next chord early so you can plan the approach note.',
 'groove_root_picker',
 '{"roots": ["E","A","D","G","C","B"], "pattern": "walking", "default_bpm": 96, "min_bpm": 60, "max_bpm": 160, "default_sets": 3, "default_reps": 8}'::jsonb,
 260, 20);
