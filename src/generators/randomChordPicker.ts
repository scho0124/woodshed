import type { Generator } from "./types";
import { pickDetail } from "./pickFromPool";

/**
 * Random selection from a pool of chord names, avoiding immediate repeats.
 * `config.instrument: "ukulele"` draws ukulele shapes instead of guitar ones.
 * `config.patterns` (or per-chord `config.cues`) adds an instruction under the
 * chord, e.g. how the genre skills want it strummed.
 */
export const randomChordPicker: Generator = (input, previousLabel) => {
  const pool =
    input.selectedPool && input.selectedPool.length > 0
      ? input.selectedPool
      : ((input.config.pool as string[] | undefined) ?? []);

  if (pool.length === 0) {
    return { label: "?" };
  }

  let choice = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && choice === previousLabel) {
    choice = pool[(pool.indexOf(choice) + 1) % pool.length];
  }

  const instrument = input.config.instrument === "ukulele" ? "ukulele" : "guitar";
  return {
    label: choice,
    detail: pickDetail(input.config, choice),
    chordShapeName: choice,
    chordInstrument: instrument,
  };
};
