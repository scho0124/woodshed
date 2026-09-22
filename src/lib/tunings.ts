import { pitchClass } from "./pianoTheory";

export type Instrument = "guitar" | "bass";

export interface Tuning {
  name: string;
  instrument: Instrument;
  /** Open-string MIDI notes, lowest string first. */
  strings: number[];
}

/**
 * The one list of tunings, used by the tuner, play-along, and tab upload
 * detection. Names are what gets saved on a tab, so keep them stable.
 */
export const TUNINGS: Tuning[] = [
  { name: "Standard", instrument: "guitar", strings: [40, 45, 50, 55, 59, 64] },
  { name: "Drop D", instrument: "guitar", strings: [38, 45, 50, 55, 59, 64] },
  { name: "Half step down", instrument: "guitar", strings: [39, 44, 49, 54, 58, 63] },
  { name: "Whole step down", instrument: "guitar", strings: [38, 43, 48, 53, 57, 62] },
  { name: "Drop C#", instrument: "guitar", strings: [37, 44, 49, 54, 58, 63] },
  { name: "Drop C", instrument: "guitar", strings: [36, 43, 48, 53, 57, 62] },
  { name: "Drop B", instrument: "guitar", strings: [35, 42, 47, 52, 56, 61] },
  { name: "DADGAD", instrument: "guitar", strings: [38, 45, 50, 55, 57, 62] },
  { name: "Open G", instrument: "guitar", strings: [38, 43, 50, 55, 59, 62] },
  { name: "Open D", instrument: "guitar", strings: [38, 45, 50, 54, 57, 62] },
  { name: "Open E", instrument: "guitar", strings: [40, 47, 52, 56, 59, 64] },
  { name: "Standard (7-string)", instrument: "guitar", strings: [35, 40, 45, 50, 55, 59, 64] },
  { name: "Standard (bass)", instrument: "bass", strings: [28, 33, 38, 43] },
  { name: "Drop D (bass)", instrument: "bass", strings: [26, 33, 38, 43] },
  { name: "Standard (5-string bass)", instrument: "bass", strings: [23, 28, 33, 38, 43] },
];

export function findTuning(name: string | null | undefined): Tuning | undefined {
  const key = name?.trim().toLowerCase();
  return key ? TUNINGS.find((t) => t.name.toLowerCase() === key) : undefined;
}

/** The usual tuning for a staff with this many strings. */
export function standardFor(stringCount: number): Tuning | undefined {
  const name =
    { 4: "Standard (bass)", 5: "Standard (5-string bass)", 6: "Standard", 7: "Standard (7-string)" }[
      stringCount
    ];
  return findTuning(name);
}

/**
 * Open-string notes from note names (lowest string first), putting each string
 * in the octave nearest the standard tuning for that many strings. Returns
 * null if any name isn't a note.
 */
export function tuningFromNoteNames(names: string[]): number[] | null {
  const reference = standardFor(names.length)?.strings;
  if (!reference) return null;
  const result: number[] = [];
  for (let i = 0; i < names.length; i++) {
    const pc = pitchClass(names[i].charAt(0).toUpperCase() + names[i].slice(1));
    if (pc === null) return null;
    const ref = reference[i];
    // Nearest MIDI note with this pitch class to the standard string.
    const below = ref - ((((ref - pc) % 12) + 12) % 12);
    result.push(ref - below <= 6 ? below : below + 12);
  }
  return result;
}

/** A saved tuning name, or note names like "D A D G B E", as open-string MIDI notes. */
export function resolveTuning(value: string | null | undefined): number[] | null {
  const known = findTuning(value);
  if (known) return known.strings;
  const names = value?.trim().split(/[\s,]+/).filter(Boolean) ?? [];
  return names.length >= 4 && names.length <= 7 ? tuningFromNoteNames(names) : null;
}

export function instrumentFor(strings: number[]): Instrument {
  return strings.length <= 5 && strings[0] < 35 ? "bass" : "guitar";
}

const TUNING_PHRASES: [RegExp, string][] = [
  [/\b(half[\s-]*step[\s-]*down|e\s*flat|eb\s*(standard|tuning)?|d#\s*standard)\b/i, "Half step down"],
  [/\b(whole[\s-]*step[\s-]*down|full[\s-]*step[\s-]*down|d\s*standard)\b/i, "Whole step down"],
  [/\bdrop\s*c#|drop\s*db\b/i, "Drop C#"],
  [/\bdrop\s*c\b/i, "Drop C"],
  [/\bdrop\s*b\b/i, "Drop B"],
  [/\bdrop\s*d\b/i, "Drop D"],
  [/\bdadgad\b/i, "DADGAD"],
  [/\bopen\s*g\b/i, "Open G"],
  [/\bopen\s*d\b/i, "Open D"],
  [/\bopen\s*e\b/i, "Open E"],
  [/\b(e\s*)?standard\b|\beadgbe\b/i, "Standard"],
];

/**
 * Canonical name for tuning text found in a tab or typed by the user:
 * "Eb standard" -> "Half step down", "D A D G B E" -> "Drop D". Returns the
 * text unchanged (trimmed) when it can't be matched.
 */
export function normalizeTuningName(value: string): string {
  const text = value.trim();
  const known = findTuning(text);
  if (known) return known.name;
  const notes = resolveTuning(text);
  if (notes) {
    const match = TUNINGS.find(
      (t) => t.strings.length === notes.length && t.strings.every((m, i) => m % 12 === notes[i] % 12),
    );
    return match?.name ?? text;
  }
  return TUNING_PHRASES.find(([re]) => re.test(text))?.[1] ?? text;
}
