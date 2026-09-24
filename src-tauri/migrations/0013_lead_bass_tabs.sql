-- Tabs and fretboard shapes for every Lead and Bass drill, instead of a single
-- note name. Three ways a prompt gets its tab:
--   * scale_pattern_picker plays a whole scale position (or a chromatic finger
--     pattern) in the sequence picked from the pool.
--   * line_picker builds a line on the root or chord in the label from
--     `lines` and places it in one hand position (see src/generators/linePicker.ts).
--   * cue_picker shows the tab written for that cue in `tabs`, with the notes
--     of `tab_key` marked as the root.
-- Generated tabs are laid out like writeTab in src/lib/fretboard.ts.

-- Lead Guitar: core

UPDATE skills SET description = 'The first A minor pentatonic box, played through in sequences from the tab. Lock in with a metronome before adding phrasing.',
  config = config || '{"key": "A",
  "pool": ["UP", "DOWN", "THREES", "SKIPS"],
  "default_selected": ["UP", "DOWN"],
  "pool_label": "Sequences",
  "tempo_label": "Click tempo",
  "default_reps": 4}'::jsonb
WHERE id = 'lead.minor_pentatonic_box1';

UPDATE skills SET description = 'All five A minor pentatonic positions, a different one each rep, so the shapes connect across the whole neck.',
  config = config || '{"key": "A",
  "pool": ["UP", "DOWN", "THREES", "SKIPS"],
  "default_selected": ["UP", "DOWN"],
  "pool_label": "Sequences",
  "tempo_label": "Click tempo",
  "default_reps": 5}'::jsonb
WHERE id = 'lead.minor_pentatonic_all_positions';

UPDATE skills SET description = 'Strict down-up picking through four-fret chromatic patterns on every string. Speed comes after accuracy.',
  config = config || '{"pool": ["1-2-3-4", "1-3-2-4", "4-3-2-1", "1-2-4-3", "2-4-1-3"],
  "default_selected": ["1-2-3-4", "1-3-2-4", "4-3-2-1"],
  "pool_label": "Finger orders",
  "start_fret": 5,
  "tempo_label": "Click tempo",
  "default_reps": 4}'::jsonb
WHERE id = 'lead.alternate_picking';

-- Lead Guitar: genre techniques, one tab per cue

UPDATE skills SET config = config || '{"tab_key": "A",
  "tabs": {
    "WHOLE": ["e|--------|-----------|",
              "B|--------|-----------|",
              "G|--9-----|-7b9-------|",
              "D|--------|-----------|",
              "A|--------|-----------|",
              "E|--------|-----------|"],
    "CURL": ["e|----------------|",
             "B|--8-5-----------|",
             "G|------7-5b¼-----|",
             "D|--------------7-|",
             "A|----------------|",
             "E|----------------|"],
    "PRE": ["e|----------------|",
            "B|----------------|",
            "G|--7b9r7---5-----|",
            "D|--------------7-|",
            "A|----------------|",
            "E|----------------|"],
    "RELEASE": ["e|--------------------|",
                "B|--8b10---8b10r8---5-|",
                "G|--------------------|",
                "D|--------------------|",
                "A|--------------------|",
                "E|--------------------|"],
    "UNISON": ["e|--------------|",
               "B|--5-------5---|",
               "G|--7b9-----7b9-|",
               "D|--------------|",
               "A|--------------|",
               "E|--------------|"],
    "VIBRATO": ["e|--------------|",
                "B|--8~~~~-------|",
                "G|--------------|",
                "D|--------------|",
                "A|--------------|",
                "E|--------------|"]}}'::jsonb
WHERE id = 'lead.blues_bends';

UPDATE skills SET config = config || '{"tab_key": "A",
  "tabs": {
    "CALL": ["e|--8-5-----|---------|---------|---------|",
             "B|------8-5-|---------|---------|---------|",
             "G|----------|-7-5-----|---------|---------|",
             "D|----------|-----7---|---------|---------|",
             "A|----------|---------|---------|---------|",
             "E|----------|---------|---------|---------|"],
    "ANSWER": ["e|--------|---------|",
               "B|--8-5---|---------|",
               "G|------7-|---------|",
               "D|--------|-7-------|",
               "A|--------|---------|",
               "E|--------|---------|"],
    "REPEAT": ["e|------5-------5-------8-|",
               "B|--5-8-----5-8-----5-8---|",
               "G|------------------------|",
               "D|------------------------|",
               "A|------------------------|",
               "E|------------------------|"],
    "BLUE": ["e|--------------------|",
             "B|--------------------|",
             "G|--7-5---------------|",
             "D|------7-5-----------|",
             "A|----------7-6-5-----|",
             "E|----------------8-5-|"],
    "TARGET": ["e|--5-------|---------|",
               "B|----8-5---|-7-------|",
               "G|--------7-|---------|",
               "D|----------|---------|",
               "A|----------|---------|",
               "E|----------|---------|"],
    "SPACE": ["e|------------------|",
              "B|--8---5-----------|",
              "G|------------7-----|",
              "D|----------------7-|",
              "A|------------------|",
              "E|------------------|"]}}'::jsonb
WHERE id = 'lead.blues_phrasing';

UPDATE skills SET config = config || '{"tab_key": "A",
  "tabs": {
    "REPEAT": ["e|--8p5---8p5---8p5---|",
               "B|------8-----8-----8-|",
               "G|--------------------|",
               "D|--------------------|",
               "A|--------------------|",
               "E|--------------------|"],
    "DOUBLE": ["e|--8-8-8-8-|-5-5-5-5-|",
               "B|--8-8-8-8-|-5-5-5-5-|",
               "G|----------|---------|",
               "D|----------|---------|",
               "A|----------|---------|",
               "E|----------|---------|"],
    "RUN": ["e|--8-5---------------------------------------------|",
            "B|------8-5-----8-5---------------------------------|",
            "G|----------7-5-----7-5-----7-5---------------------|",
            "D|----------------------7-5-----7-5-----7-5---------|",
            "A|----------------------------------7-5-----7-5-----|",
            "E|----------------------------------------------8-5-|"],
    "SLIDE": ["e|--------------|",
              "B|--------------|",
              "G|--5/7-5-------|",
              "D|--------7-----|",
              "A|--------------|",
              "E|--------------|"]}}'::jsonb
WHERE id = 'lead.rock_licks';

UPDATE skills SET config = config || '{"tab_key": "A",
  "tabs": {
    "HAMMER": ["e|----------------------|",
               "B|----------------------|",
               "G|--------------5h7h9---|",
               "D|--------5h7h9---------|",
               "A|--5h7h8---------------|",
               "E|----------------------|"],
    "PULL": ["e|--8p7p5---------------|",
             "B|--------8p6p5---------|",
             "G|--------------7p5p4---|",
             "D|----------------------|",
             "A|----------------------|",
             "E|----------------------|"],
    "ROLL": ["e|--------------------|",
             "B|--------------------|",
             "G|--5h7p5h7p5h7p5h7---|",
             "D|--------------------|",
             "A|--------------------|",
             "E|--------------------|"],
    "ASCEND": ["e|----------------------5h8-|",
               "B|------------------5h8-----|",
               "G|--------------5h7---------|",
               "D|----------5h7-------------|",
               "A|------5h7-----------------|",
               "E|--5h8---------------------|"],
    "DESCEND": ["e|--8p5---------------------|",
                "B|------8p5-----------------|",
                "G|----------7p5-------------|",
                "D|--------------7p5---------|",
                "A|------------------7p5-----|",
                "E|----------------------8p5-|"]}}'::jsonb
WHERE id = 'lead.rock_legato';

UPDATE skills SET config = config || '{"tab_key": "E",
  "tabs": {
    "BURST": ["e|--12-10---------------|",
              "B|--------12-10---------|",
              "G|----------------------|",
              "D|----------------------|",
              "A|----------------------|",
              "E|----------------------|"],
    "SIXES": ["e|--15-12-------------------------------|",
              "B|--------15-12-------15-12-------------|",
              "G|--------------14-12-------14-12-------|",
              "D|--------------------------------14-12-|",
              "A|--------------------------------------|",
              "E|--------------------------------------|"],
    "3NPS": ["e|-----------------------------------------------14-15-17-|",
             "B|--------------------------------------13-15-17----------|",
             "G|-----------------------------12-14-16-------------------|",
             "D|--------------------12-14-16----------------------------|",
             "A|-----------12-14-15-------------------------------------|",
             "E|--12-14-15----------------------------------------------|"],
    "CROSS": ["e|--------------------------------12-15-15-12-------------------------------|",
              "B|--------------------------12-15-------------15-12-------------------------|",
              "G|--------------------12-14-------------------------14-12-------------------|",
              "D|--------------12-14-------------------------------------14-12-------------|",
              "A|--------12-14-------------------------------------------------14-12-------|",
              "E|--12-15-------------------------------------------------------------15-12-|"]}}'::jsonb
WHERE id = 'lead.metal_shred';

UPDATE skills SET config = config || '{"tab_key": "A",
  "tabs": {
    "SWEEP3": ["e|--------12---------12---|",
               "B|-----13---------13------|",
               "G|--14---------14---------|",
               "D|------------------------|",
               "A|------------------------|",
               "E|------------------------|"],
    "SWEEP5": ["e|--------------12-17-12-------------|",
               "B|-----------13----------13----------|",
               "G|--------14----------------14-------|",
               "D|-----14----------------------14----|",
               "A|--12----------------------------12-|",
               "E|-----------------------------------|"],
    "TAP": ["e|--t12p5h8-t12p5h8-t12p5h8-t12p5h8-|",
            "B|----------------------------------|",
            "G|----------------------------------|",
            "D|----------------------------------|",
            "A|----------------------------------|",
            "E|----------------------------------|"],
    "MOVE": ["e|--t12p5h8-t12p5h8-|-t13p5h8-t13p5h8-|-t15p7h10-t15p7h10-|",
             "B|------------------|-----------------|-------------------|",
             "G|------------------|-----------------|-------------------|",
             "D|------------------|-----------------|-------------------|",
             "A|------------------|-----------------|-------------------|",
             "E|------------------|-----------------|-------------------|"]}}'::jsonb
WHERE id = 'lead.metal_sweeps_tapping';

UPDATE skills SET config = config || '{"tab_key": "A",
  "tabs": {
    "HYBRID": ["e|------------------|",
               "B|----5---5---5---5-|",
               "G|----------6---6---|",
               "D|--7---7-----------|",
               "A|------------------|",
               "E|------------------|"],
    "SNAP": ["e|--------------------|",
             "B|--5---7---5---------|",
             "G|--------------6-----|",
             "D|------------------7-|",
             "A|--------------------|",
             "E|--------------------|"],
    "CLUCK": ["e|----------------|",
              "B|----------x-5---|",
              "G|------x-6-------|",
              "D|--x-7-----------|",
              "A|----------------|",
              "E|----------------|"],
    "ROLL": ["e|------5-----5-----|",
             "B|----5-----5-----5-|",
             "G|--6-----6-----6---|",
             "D|------------------|",
             "A|------------------|",
             "E|------------------|"]}}'::jsonb
WHERE id = 'lead.country_chicken_picking';

UPDATE skills SET config = config || '{"tab_key": "A",
  "tabs": {
    "STEEL": ["e|--------------------|",
              "B|--5-5-----5---------|",
              "G|--4-4b6---4b6r4-----|",
              "D|------------------7-|",
              "A|--------------------|",
              "E|--------------------|"],
    "3RDS": ["e|---------------|",
             "B|--2-3-5-7-9-10-|",
             "G|--2-4-6-7-9-11-|",
             "D|---------------|",
             "A|---------------|",
             "E|---------------|"],
    "6THS": ["e|--5-7-9-10-12-14-|",
             "B|-----------------|",
             "G|--6-7-9-11-13-14-|",
             "D|-----------------|",
             "A|-----------------|",
             "E|-----------------|"],
    "MAJOR": ["e|----------------------2-5-|",
              "B|------------------2-5-----|",
              "G|--------------2-4---------|",
              "D|----------2-4-------------|",
              "A|------2-4-----------------|",
              "E|--2-5---------------------|"]}}'::jsonb
WHERE id = 'lead.country_steel_bends';

UPDATE skills SET config = config || '{"tab_key": "C",
  "tabs": {
    "BELOW": ["e|-------------------|",
              "B|-------------------|",
              "G|-------------------|",
              "D|---------------8-9-|",
              "A|------6-7-9-10-----|",
              "E|--7-8--------------|"],
    "ABOVE": ["e|---------------------|",
              "B|---------------------|",
              "G|---------------------|",
              "D|-----------7----10-9-|",
              "A|-------8-7---10------|",
              "E|--10-8---------------|"],
    "ENCLOSE": ["e|-----------------|",
                "B|-----------------|",
                "G|-----------------|",
                "D|----------10-8-9-|",
                "A|--8-6-7----------|",
                "E|-----------------|"],
    "PASSING": ["e|-----------|----------|",
                "B|-----------|----------|",
                "G|-----------|----------|",
                "D|--10-9-8-7-|----------|",
                "A|-----------|-10-9-8-7-|",
                "E|-----------|----------|"],
    "BEBOP": ["e|--------------------|",
              "B|--8-7-6-5-----------|",
              "G|----------7-5-4-----|",
              "D|----------------7-5-|",
              "A|--------------------|",
              "E|--------------------|"]}}'::jsonb
WHERE id = 'lead.jazz_enclosures';

-- Lead Guitar: arpeggios built on each chord, in movable shapes

UPDATE skills SET generator_type = 'line_picker',
  config = (config - 'patterns') || '{"instrument": "guitar",
  "open_strings": false,
  "lines": [
    {"text": "Arpeggiate up from the root: 1, 3, 5, 7", "steps": ["R", "3", "5", "7"]},
    {"text": "Arpeggiate down from the 7th to the root", "steps": ["7", "5", "3", "R"]},
    {"text": "Start on the 3rd: 3, 5, 7, 9", "steps": ["3", "5", "7", "9"]},
    {"text": "Approach the 3rd from a half step below, then up to the octave", "steps": ["3-1", "3", "5", "7", "R+12"]}]}'::jsonb
WHERE id = 'lead.jazz_arpeggios';

-- Bass Guitar: lines built on each root

UPDATE skills SET generator_type = 'line_picker',
  config = (config - 'roots' - 'pattern') || '{"pool": ["E", "A", "D", "G", "C"],
  "default_selected": ["E", "A", "D", "G", "C"],
  "pool_label": "Roots",
  "tempo_label": "Groove tempo",
  "lines": [
    {"text": "Root, fifth, root, fifth", "steps": [0, "-", 7, "-", 0, "-", 7, "-"]},
    {"text": "Root, fifth, octave, fifth", "steps": [0, "-", 7, "-", 12, "-", 7, "-"]},
    {"text": "Root, the fifth below, root, fifth above", "steps": [0, "-", -5, "-", 0, "-", 7, "-"]},
    {"text": "Root on 1 and the & of 2, fifth on 3", "steps": [0, "-", "-", 0, 7, "-", "-", "-"]}]}'::jsonb
WHERE id = 'bass.root_fifth_grooves';

UPDATE skills SET generator_type = 'line_picker',
  description = 'Quarter-note walking lines built from each root. Every note the same length, always moving toward the next bar.',
  config = (config - 'roots' - 'pattern') || '{"pool": ["E", "A", "D", "G", "C", "B"],
  "default_selected": ["E", "A", "D", "G", "C", "B"],
  "pool_label": "Roots",
  "tempo_label": "Walking tempo",
  "lines": [
    {"text": "1, 3, 5, 6 up, then 8, 6, 5, 3 back down", "steps": [0, 4, 7, 9, "|", 12, 9, 7, 4]},
    {"text": "Up the major scale 1, 2, 3, 5, then 6, 5, 3, 2", "steps": [0, 2, 4, 7, "|", 9, 7, 4, 2]},
    {"text": "Arpeggio 1, 3, 5, b7, landing on the octave", "steps": [0, 4, 7, 10, "|", 12, "-", "-", "-"]},
    {"text": "Chromatic climb: 1, 2, b3, 3, then 5, 6, b7, 7 to the octave", "steps": [0, 2, 3, 4, "|", 7, 9, 10, 11, "|", 12]}]}'::jsonb
WHERE id = 'bass.walking_bass_lines';

UPDATE skills SET generator_type = 'line_picker',
  config = (config - 'patterns') || '{"lines": [
    {"text": "Boogie line in swung eighths: 1, 3, 5, 6, b7, 6, 5, 3", "steps": [0, 4, 7, 9, 10, 9, 7, 4]},
    {"text": "Root and octave shuffle, long-short", "steps": [0, 12, 0, 12, 0, 12, 0, 12]},
    {"text": "1, 5, 6, 5 shuffle, repeating", "steps": [0, 7, 9, 7, 0, 7, 9, 7]},
    {"text": "1, 3, 5, 6 up to the octave, then back down", "steps": [0, 4, 7, 9, 12, 9, 7, 4]}]}'::jsonb
WHERE id = 'bass.blues_shuffle';

UPDATE skills SET generator_type = 'line_picker',
  config = (config - 'patterns') || '{"lines": [
    {"text": "Steady eighths on the root, locked to the kick", "steps": [0, 0, 0, 0, 0, 0, 0, 0]},
    {"text": "Root eighths with an octave jump on beat 4", "steps": [0, 0, 0, 0, 0, 0, 12, 12]},
    {"text": "Root eighths with the fifth on the & of 4", "steps": [0, 0, 0, 0, 0, 0, 0, 7]},
    {"text": "Four eighths on the root, four on the fifth", "steps": [0, 0, 0, 0, 7, 7, 7, 7]}]}'::jsonb
WHERE id = 'bass.rock_eighths';

UPDATE skills SET generator_type = 'line_picker',
  config = (config - 'patterns') || '{"lines": [
    {"text": "Root, octave, root, octave in eighths", "steps": [0, 12, 0, 12, 0, 12, 0, 12]},
    {"text": "Root for 3 beats, then a 4-note fill up the minor pentatonic", "steps": [0, 0, 0, 0, 0, 0, 3, 5, 7, 10, "|", 12]},
    {"text": "Root, fifth, octave, fifth in eighths", "steps": [0, 7, 12, 7, 0, 7, 12, 7]},
    {"text": "Root eighths, then a fill down: octave, b7, fifth", "steps": [0, 0, 0, 0, 0, 12, 10, 7]}]}'::jsonb
WHERE id = 'bass.rock_octaves_fills';

UPDATE skills SET generator_type = 'line_picker',
  config = (config - 'patterns') || '{"lines": [
    {"text": "Downpicked eighths on the root, no breaks", "steps": [0, 0, 0, 0, 0, 0, 0, 0]},
    {"text": "Follow a I to IV change, root for root", "steps": [0, 0, 0, 0, 0, 0, 0, 0, "|", 5, 5, 5, 5, 5, 5, 5, 5]},
    {"text": "Root eighths, walking up 2, 3, 4 at the end of the bar", "steps": [0, 0, 0, 0, 0, 2, 4, 5]},
    {"text": "Root eighths, jumping to the octave for the last two", "steps": [0, 0, 0, 0, 0, 0, 12, 12]}]}'::jsonb
WHERE id = 'bass.punk_downpicking';

UPDATE skills SET generator_type = 'line_picker',
  config = (config - 'patterns') || '{"lines": [
    {"text": "Walk up the major scale from the root to the octave", "steps": [0, 2, 4, 5, 7, 9, 11, 12]},
    {"text": "Root for 2 beats, then run 2, 3, 4, #4 up to the fifth", "steps": [0, 0, 0, 0, 2, 4, 5, 6, "|", 7]},
    {"text": "The 3rd and 5th under the chord instead of the root", "steps": [4, 4, 4, 4, 7, 7, 7, 7]},
    {"text": "Run down the major scale from the octave to the root", "steps": [12, 11, 9, 7, 5, 4, 2, 0]}]}'::jsonb
WHERE id = 'bass.punk_runs';

UPDATE skills SET generator_type = 'line_picker',
  config = (config - 'patterns') || '{"lines": [
    {"text": "Hit the one hard, ghost the sixteenths around it", "steps": [0, "x", "x", "x", 0, "x", "x", "x"]},
    {"text": "Root, ghost, b7, octave in sixteenths, twice", "steps": [0, "x", 10, 12, 0, "x", 10, 12]},
    {"text": "Busy first half, then leave beat 3 empty and come back on its &", "steps": [0, "x", 0, "x", 12, "x", 10, "x", "-", "-", 0, "x", 7, "x", 10, "x"]},
    {"text": "Root on the one and the & of 2, ghost notes everywhere else", "steps": [0, "x", "x", "x", "x", "x", 0, "x", "x", "x", "x", "x", "x", "x", "x", "x"]}]}'::jsonb
WHERE id = 'bass.funk_fingerstyle';

UPDATE skills SET generator_type = 'line_picker',
  config = (config - 'patterns') || '{"lines": [
    {"text": "Rest through beats 1 and 2, then the root on 3 and 4 with the kick", "steps": ["-", "-", "-", "-", 0, "-", 0, "-"]},
    {"text": "Root, then walk down the minor pentatonic to the fifth", "steps": [0, "-", -2, "-", -5, "-", "-", "-"]},
    {"text": "Root held through beats 1 and 2, silence, then the root on 4", "steps": [0, "-", "-", "-", "-", "-", 0, "-"]},
    {"text": "Root and octave, short and round, with space between", "steps": [0, "-", 12, "-", "-", "-", 0, "-"]}]}'::jsonb
WHERE id = 'bass.reggae_one_drop';

UPDATE skills SET generator_type = 'line_picker',
  config = (config - 'patterns') || '{"lines": [
    {"text": "Walk quarter notes up the major scale and back", "steps": [0, 2, 4, 5, "|", 7, 5, 4, 2]},
    {"text": "Root, fifth, octave, fifth in quarter notes", "steps": [0, 7, 12, 7]},
    {"text": "1, 2, 3, #4 walking up into the fifth", "steps": [0, 2, 4, 6, "|", 7, "-", "-", "-"]},
    {"text": "1, 3, 5, octave, then walk down 7, 6, 5", "steps": [0, 4, 7, 12, "|", 11, 9, 7, "-"]}]}'::jsonb
WHERE id = 'bass.ska_walking';

-- Bass Guitar: genre techniques, one tab per cue

UPDATE skills SET config = config || '{"tab_key": "E",
  "tabs": {
    "SLOW": ["G|----|---|---|---|---|---|---|---|---|---|---|---|",
             "D|----|---|---|---|---|---|---|---|---|---|---|---|",
             "A|----|---|---|---|-0-|-0-|---|---|-2-|-0-|---|-2-|",
             "E|--0-|-0-|-0-|-0-|---|---|-0-|-0-|---|---|-0-|---|"],
    "QUICK": ["G|----|---|---|---|---|---|---|---|---|---|---|---|",
              "D|----|---|---|---|---|---|---|---|---|---|---|---|",
              "A|----|-0-|---|---|-0-|-0-|---|---|-2-|-0-|---|-2-|",
              "E|--0-|---|-0-|-0-|---|---|-0-|-0-|---|---|-0-|---|"],
    "STOP": ["G|----------|---------|---------|---------|",
             "D|----------|---------|---------|---------|",
             "A|----------|---------|---------|---------|",
             "E|--0-------|-0-------|-0-------|-0-------|"],
    "MINOR": ["G|----|---|---|---|---|---|---|---|---|---|---|---|",
              "D|----|---|---|---|---|---|---|---|---|---|---|---|",
              "A|----|---|---|---|-0-|-0-|---|---|-3-|-2-|---|-2-|",
              "E|--0-|-0-|-0-|-0-|---|---|-0-|-0-|---|---|-0-|---|"],
    "TURN": ["G|----------|---------|",
             "D|----------|---------|",
             "A|------0-1-|-2-------|",
             "E|--0-4-----|---------|"]}}'::jsonb
WHERE id = 'bass.blues_twelve_bar';

UPDATE skills SET config = config || '{"tab_key": "E",
  "tabs": {
    "GALLOP": ["G|----------------------------------|",
               "D|----------------------------------|",
               "A|----------------------------------|",
               "E|--0---0-0-0---0-0-0---0-0-0---0-0-|"],
    "REVERSE": ["G|----------------------------------|",
                "D|----------------------------------|",
                "A|----------------------------------|",
                "E|--0-0-0---0-0-0---0-0-0---0-0-0---|"],
    "16THS": ["G|----------------------------------|",
              "D|----------------------------------|",
              "A|----------------------------------|",
              "E|--0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-|"],
    "PEDAL": ["G|------------------|",
              "D|------------------|",
              "A|------------------|",
              "E|--0-3-0-5-0-6-0-5-|"],
    "CHUG": ["G|--------------------------|",
             "D|--------------------------|",
             "A|--------------------------|",
             "E|--0---0-----0-----0-0-----|"]}}'::jsonb
WHERE id = 'bass.metal_gallops';

UPDATE skills SET config = config || '{"tab_key": "E",
  "tabs": {
    "BURST": ["G|----------------------------------|",
              "D|----------------------------------|",
              "A|----------------------------------|",
              "E|--0-0-0-0---------0-0-0-0---------|"],
    "ENDURE": ["G|----------------------------------|",
               "D|----------------------------------|",
               "A|----------------------------------|",
               "E|--0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-|"],
    "STRING": ["G|----------------------------------|",
               "D|----------------------------------|",
               "A|----------2-2-2-2---------2-2-2-2-|",
               "E|--0-0-0-0---------0-0-0-0---------|"],
    "MUTE": ["G|----------------------------------|",
             "D|----------2-2-2-2-----------------|",
             "A|--2-2-2-2---------2-2-2-2---------|",
             "E|--------------------------0-0-0-0-|"]}}'::jsonb
WHERE id = 'bass.metal_speed';

UPDATE skills SET config = config || '{"tab_key": "E",
  "tabs": {
    "THUMB": ["G|------------------|",
              "D|------------------|",
              "A|------------------|",
              "E|--0---0---0---0---|"],
    "POP": ["G|--------------4---|",
            "D|------2-----------|",
            "A|------------------|",
            "E|--0-------0-------|"],
    "OCTAVE": ["G|------------------|",
               "D|----2---2---2---2-|",
               "A|------------------|",
               "E|--0---0---0---0---|"],
    "GHOST": ["G|------------------|",
              "D|------2-x-----2-x-|",
              "A|------------------|",
              "E|--0-x-----0-x-----|"],
    "HAMMER": ["G|--------------------------|",
               "D|--------------------------|",
               "A|--------------0h2---0h2---|",
               "E|--0h2---0h2---------------|"]}}'::jsonb
WHERE id = 'bass.funk_slap';
