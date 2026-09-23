import type { Generator } from "./types";
import { randomChordPicker } from "./randomChordPicker";
import { scalePatternPicker } from "./scalePatternPicker";
import { grooveRootPicker } from "./grooveRootPicker";
import { pianoChordPicker } from "./pianoChordPicker";
import { pianoScalePicker } from "./pianoScalePicker";
import { pianoNoteFinder } from "./pianoNoteFinder";
import { cuePicker } from "./cuePicker";

/**
 * The extensibility point for the whole app: a skill row names one of these
 * by `generator_type`. Reusing a generator for a new skill is a pure data
 * change (a new row in migrations/000X_*.sql). A new drill mechanic means
 * writing a generator here and registering it in this map.
 */
export const GENERATORS: Record<string, Generator> = {
  random_chord_picker: randomChordPicker,
  scale_pattern_picker: scalePatternPicker,
  groove_root_picker: grooveRootPicker,
  piano_chord_picker: pianoChordPicker,
  piano_scale_picker: pianoScalePicker,
  piano_note_finder: pianoNoteFinder,
  cue_picker: cuePicker,
  // Original name of cue_picker; the vocals skills in 0007 still use it.
  vocal_drill_picker: cuePicker,
};

export type { Generator, Prompt, GeneratorInput } from "./types";
