import type { Generator } from "./types";
import { pickDetail, pickFromPool } from "./pickFromPool";
import { pitchClass } from "@/lib/pianoTheory";

/**
 * A short cue (a vowel, strum pattern, note name...) with an instruction under it.
 * The detail line is the item's own instruction from `config.cues` if it has one,
 * otherwise a random pick from `config.patterns` so the same item gets drilled a
 * few different ways. An item with a tab in `config.tabs` shows it, with the
 * notes of `config.tab_key` marked as the root.
 */
export const cuePicker: Generator = (input, previousLabel) => {
  const label = pickFromPool(input, previousLabel);
  if (!label) return { label: "?" };

  const tabs = input.config.tabs as Record<string, string[]> | undefined;
  const key = input.config.tab_key as string | undefined;
  return {
    label,
    detail: pickDetail(input.config, label),
    tab: tabs?.[label],
    tabRoot: key ? (pitchClass(key) ?? undefined) : undefined,
  };
};
