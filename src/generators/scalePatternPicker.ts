import type { Generator } from "./types";

const STRING_NAMES = ["Low E", "A", "D", "G", "B", "High e"];

/**
 * A minor pentatonic, box 1 (5th-fret position) — a verified, standard box
 * shape. Positions 2-5 are approximated by sliding this same shape up the
 * neck in 3-fret steps rather than using each position's authentic CAGED
 * shape. Swap in real per-position note tables here once that precision
 * matters more than having all five positions playable today.
 */
const BOX_1 = [
  { string: 6, fret: 5 },
  { string: 6, fret: 8 },
  { string: 5, fret: 5 },
  { string: 5, fret: 7 },
  { string: 4, fret: 5 },
  { string: 4, fret: 7 },
  { string: 3, fret: 5 },
  { string: 3, fret: 7 },
  { string: 2, fret: 5 },
  { string: 2, fret: 8 },
  { string: 1, fret: 5 },
  { string: 1, fret: 8 },
];

export const scalePatternPicker: Generator = (input) => {
  const positions = (input.config.positions as number[] | undefined) ?? [1];
  const position = positions[Math.floor(Math.random() * positions.length)];
  const shift = (position - 1) * 3;
  const note = BOX_1[Math.floor(Math.random() * BOX_1.length)];

  return {
    label: `Fret ${note.fret + shift}`,
    detail: `${STRING_NAMES[note.string - 1]} string · Position ${position}`,
  };
};
