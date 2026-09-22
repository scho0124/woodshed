import type { Generator } from "./types";
import { pickFromPool } from "./pickFromPool";

/**
 * Note-name cue for key-recognition drills. Deliberately no keyboard diagram:
 * showing the keys would give the answer away.
 */
export const pianoNoteFinder: Generator = (input, previousLabel) => {
  const note = pickFromPool(input, previousLabel);
  if (!note) return { label: "?" };
  return { label: note, detail: `Play every ${note} on the keyboard, low to high` };
};
