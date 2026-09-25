-- Mic checks for every Extreme Vocals and Clean Vocals skill: a short
-- exercise the app listens to through a mic (never the guitar input), then
-- scores for pitch, sustain and steadiness, and for safety signs like pushing
-- past your speaking volume, long bursts or too little rest. `kind` picks the
-- scoring in src/lib/voiceCheck.ts; `prompt` is what to do.

-- Extreme Vocals
UPDATE skills SET config = config || '{"mic_check": {"kind": "breath", "seconds": 10, "prompt": "Take a low breath, then one slow, even SSS hiss for as long as it stays steady."}}'::jsonb
WHERE id = 'vocals.breath_support';
UPDATE skills SET config = config || '{"mic_check": {"kind": "hold", "seconds": 5, "prompt": "Hum one comfortable note and hold it gently for 5 seconds."}}'::jsonb
WHERE id = 'vocals.warmups';
UPDATE skills SET config = config || '{"mic_check": {"kind": "fry", "prompt": "Make a quiet, steady fry on AH and hold it for a few seconds, softer than your speaking voice."}}'::jsonb
WHERE id = 'vocals.fry_control';
UPDATE skills SET config = config || '{"mic_check": {"kind": "scream", "max_burst": 3, "prompt": "Do three or four short fry screams on EE, resting after each one."}}'::jsonb
WHERE id = 'vocals.fry_screams';
UPDATE skills SET config = config || '{"mic_check": {"kind": "scream", "max_burst": 4, "prompt": "Do three or four short false cord bursts on AH, resting after each one."}}'::jsonb
WHERE id = 'vocals.false_cord';
UPDATE skills SET config = config || '{"mic_check": {"kind": "scream", "max_burst": 4, "prompt": "Do three or four short lows on OO, resting after each one."}}'::jsonb
WHERE id = 'vocals.lows';
UPDATE skills SET config = config || '{"mic_check": {"kind": "scream", "max_burst": 3, "prompt": "Growl three or four short syllables like BLEGH, resting after each one."}}'::jsonb
WHERE id = 'vocals.death_growls';
UPDATE skills SET config = config || '{"mic_check": {"kind": "scream", "max_burst": 3, "prompt": "Do three or four airy shrieks on EE, resting after each one."}}'::jsonb
WHERE id = 'vocals.black_shrieks';
UPDATE skills SET config = config || '{"mic_check": {"kind": "scream", "max_burst": 2, "prompt": "Bark four short shouts like HEY, resting after each one."}}'::jsonb
WHERE id = 'vocals.thrash_shouts';
UPDATE skills SET config = config || '{"mic_check": {"kind": "scream", "max_burst": 4, "pitched": true, "prompt": "Sing a comfortable note with a little grit on top, three or four times, resting between them."}}'::jsonb
WHERE id = 'vocals.pitched_grit';
UPDATE skills SET config = config || '{"mic_check": {"kind": "scream", "max_burst": 2, "prompt": "Scream four short phrases in rhythm, resting between them."}}'::jsonb
WHERE id = 'vocals.rhythmic_phrasing';

-- Clean Vocals
UPDATE skills SET config = config || '{"mic_check": {"kind": "breath", "seconds": 15, "prompt": "Take a low breath, then one slow, even SSS hiss for as long as it stays steady."}}'::jsonb
WHERE id = 'clean_vocals.breathing';
UPDATE skills SET config = config || '{"mic_check": {"kind": "hold", "seconds": 5, "prompt": "Hum one comfortable note and hold it gently for 5 seconds."}}'::jsonb
WHERE id = 'clean_vocals.warmups';
UPDATE skills SET config = config || '{"mic_check": {"kind": "hold", "seconds": 3, "target_from_pool": true, "prompt": "Hear the target note, then sing it on AH and hold it for 3 seconds."}}'::jsonb
WHERE id = 'clean_vocals.pitch_matching';
UPDATE skills SET config = config || '{"mic_check": {"kind": "notes", "prompt": "Sing 1 2 3 4 5 4 3 2 1 on AH, holding each note for a moment."}}'::jsonb
WHERE id = 'clean_vocals.scales';
UPDATE skills SET config = config || '{"mic_check": {"kind": "notes", "prompt": "Sing a slow 5-note scale on a light NAY up through your break and back down."}}'::jsonb
WHERE id = 'clean_vocals.registers';
UPDATE skills SET config = config || '{"mic_check": {"kind": "belt", "prompt": "Belt HEY on a comfortable note two or three times, resting between them."}}'::jsonb
WHERE id = 'clean_vocals.belting';
UPDATE skills SET config = config || '{"mic_check": {"kind": "vibrato", "prompt": "Hold a comfortable note on AH. Start straight, then let the vibrato in."}}'::jsonb
WHERE id = 'clean_vocals.vibrato';
UPDATE skills SET config = config || '{"mic_check": {"kind": "belt", "prompt": "Belt YEAH on a comfortable high note two or three times, resting between them."}}'::jsonb
WHERE id = 'clean_vocals.rock';
UPDATE skills SET config = config || '{"mic_check": {"kind": "notes", "prompt": "Sing a short line of a song you know, holding the last note."}}'::jsonb
WHERE id = 'clean_vocals.pop';
UPDATE skills SET config = config || '{"mic_check": {"kind": "notes", "prompt": "Sing a slow 5-note run on OH and land on a held note."}}'::jsonb
WHERE id = 'clean_vocals.rnb_soul';
UPDATE skills SET config = config || '{"mic_check": {"kind": "notes", "prompt": "Sing a short line of a song you know, plainly, holding the last note."}}'::jsonb
WHERE id = 'clean_vocals.folk_country';
UPDATE skills SET config = config || '{"mic_check": {"kind": "belt", "prompt": "Sustain a high, clean note on AH two or three times, resting between them."}}'::jsonb
WHERE id = 'clean_vocals.metal_cleans';
UPDATE skills SET config = config || '{"mic_check": {"kind": "notes", "prompt": "Sing a lyric line you know in time, holding the last note."}}'::jsonb
WHERE id = 'clean_vocals.phrasing';
