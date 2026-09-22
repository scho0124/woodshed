import type { Generator } from "./types";
import { pickFromPool } from "./pickFromPool";
import { SCALE_NAMES, scaleKeys } from "@/lib/pianoTheory";

/** Random key from the pool for the skill's scale (`config.scale`), drawn on the keyboard. */
export const pianoScalePicker: Generator = (input, previousLabel) => {
  const scale = (input.config.scale as string | undefined) ?? "major";
  const root = pickFromPool(input, previousLabel?.split(" ")[0]);
  if (!root) return { label: "?" };

  const notes = scaleKeys(root, scale);
  return {
    label: `${root} ${SCALE_NAMES[scale] ?? scale}`,
    detail: "One octave up and down · hands separately, then together",
    keys: notes?.keys,
    rootKeys: notes?.roots,
  };
};
