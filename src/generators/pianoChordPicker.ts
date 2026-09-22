import type { Generator } from "./types";
import { pickFromPool } from "./pickFromPool";
import { INVERSION_NAMES, chordKeys, chordSize } from "@/lib/pianoTheory";

/**
 * Random chord from the pool, drawn on the keyboard. With `inversions: true`
 * in the skill config, each cue also picks a random inversion.
 */
export const pianoChordPicker: Generator = (input, previousLabel) => {
  const chord = pickFromPool(input, previousLabel);
  if (!chord) return { label: "?" };

  const inversion = input.config.inversions ? Math.floor(Math.random() * chordSize(chord)) : 0;
  const voicing = chordKeys(chord, inversion);
  return {
    label: chord,
    detail: input.config.inversions ? INVERSION_NAMES[inversion] : undefined,
    keys: voicing?.keys,
    rootKeys: voicing ? [voicing.root] : undefined,
  };
};
