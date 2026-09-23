import type { Generator } from "./types";
import { pickFromPool } from "./pickFromPool";

/**
 * A short cue (a vowel, strum pattern, note name...) with an instruction under it.
 * The detail line is the item's own instruction from `config.cues` if it has one,
 * otherwise a random pick from `config.patterns` so the same item gets drilled a
 * few different ways.
 */
export const cuePicker: Generator = (input, previousLabel) => {
  const label = pickFromPool(input, previousLabel);
  if (!label) return { label: "?" };

  const cues = input.config.cues as Record<string, string> | undefined;
  const patterns = input.config.patterns as string[] | undefined;
  const detail =
    cues?.[label] ??
    (patterns?.length ? patterns[Math.floor(Math.random() * patterns.length)] : undefined);
  return { label, detail };
};
