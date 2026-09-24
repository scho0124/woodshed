import type { Generator } from "./types";
import { pickDetail, pickFromPool } from "./pickFromPool";

/**
 * A short cue (a vowel, strum pattern, note name...) with an instruction under it.
 * The detail line is the item's own instruction from `config.cues` if it has one,
 * otherwise a random pick from `config.patterns` so the same item gets drilled a
 * few different ways.
 */
export const cuePicker: Generator = (input, previousLabel) => {
  const label = pickFromPool(input, previousLabel);
  if (!label) return { label: "?" };
  return { label, detail: pickDetail(input.config, label) };
};
