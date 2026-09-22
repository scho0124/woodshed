/**
 * Just enough music theory for the piano drills: note names to pitch classes,
 * and chord/scale spellings as key numbers on a two-octave keyboard
 * (0 = the lowest C, 23 = the highest B).
 */

export const KEYBOARD_KEYS = 24;

const NATURALS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#" -> 6, "Bb" -> 10. Returns null for anything that isn't a note name. */
export function pitchClass(note: string): number | null {
  const m = /^([A-Ga-g])(#|b)?$/.exec(note.trim());
  if (!m) return null;
  const base = NATURALS[m[1].toUpperCase()];
  const shift = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return (base + shift + 12) % 12;
}

const CHORD_INTERVALS: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
};

export const INVERSION_NAMES = ["Root position", "1st inversion", "2nd inversion", "3rd inversion"];

/** Number of notes in a chord symbol like "Cmaj7", or 0 if it isn't recognized. */
export function chordSize(name: string): number {
  const m = /^([A-G][#b]?)(.*)$/.exec(name);
  return (m && CHORD_INTERVALS[m[2]]?.length) || 0;
}

/**
 * Keys for a chord symbol in the given inversion (0 = root position), placed
 * as low on the keyboard as it fits. Returns null for unrecognized symbols.
 */
export function chordKeys(name: string, inversion = 0): { keys: number[]; root: number } | null {
  const m = /^([A-G][#b]?)(.*)$/.exec(name);
  const root = m ? pitchClass(m[1]) : null;
  const intervals = m ? CHORD_INTERVALS[m[2]] : undefined;
  if (root === null || !intervals) return null;

  const keys = intervals.map((i) => root + i);
  for (let i = 0; i < inversion % keys.length; i++) keys.push(keys.shift()! + 12);
  while (Math.max(...keys) >= KEYBOARD_KEYS && Math.min(...keys) >= 12) {
    keys.forEach((_, i) => (keys[i] -= 12));
  }
  const rootKey = keys.find((k) => k % 12 === root)!;
  return { keys, root: rootKey };
}

const SCALE_STEPS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
};

export const SCALE_NAMES: Record<string, string> = {
  major: "major",
  natural_minor: "minor",
};

/** One octave of a scale from its root up to the root an octave higher. */
export function scaleKeys(root: string, scale: string): { keys: number[]; roots: number[] } | null {
  const r = pitchClass(root);
  const steps = SCALE_STEPS[scale];
  if (r === null || !steps) return null;
  return { keys: [...steps.map((s) => r + s), r + 12], roots: [r, r + 12] };
}
