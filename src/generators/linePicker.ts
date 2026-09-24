import type { Generator } from "./types";
import { pickFromPool } from "./pickFromPool";
import { placeLine, writeTab, type NeckInstrument, type TabStep } from "@/lib/fretboard";
import { chordKeys, pitchClass } from "@/lib/pianoTheory";

/** One way to play over the root: the instruction, then the notes. */
export interface Line {
  text: string;
  /**
   * Semitones from the root (negative for below it); chord tones "R", "3",
   * "5", "7", "9", optionally shifted like "3-1" (a half step below the 3rd);
   * "-" for a rest, "x" for a muted ghost note and "|" for a bar line.
   */
  steps: (number | string)[];
}

const DEGREE = /^(R|3|5|7|9)([+-]\d+)?$/;

/**
 * The tab for a line over a root note or chord symbol (like "E" or "Dm7"),
 * in the lowest hand position it fits. Null if it can't be placed.
 */
export function lineTab(
  instrument: NeckInstrument,
  label: string,
  line: Line,
  allowOpen = true,
): string[] | null {
  const m = /^([A-G][#b]?)(.*)$/.exec(label);
  const rootPc = m ? pitchClass(m[1]) : null;
  if (rootPc === null) return null;
  const chord = chordKeys(label)?.keys.map((k, _, keys) => k - keys[0]);

  const offsets: number[] = [];
  for (const step of line.steps) {
    if (typeof step === "number") {
      offsets.push(step);
      continue;
    }
    const d = DEGREE.exec(step);
    if (!d) continue;
    const tone = d[1] === "R" ? 0 : d[1] === "9" ? 14 : chord?.[{ 3: 1, 5: 2, 7: 3 }[d[1]]!];
    if (tone === undefined) return null;
    offsets.push(tone + Number(d[2] ?? 0));
  }

  const placed = placeLine(instrument, rootPc, offsets, allowOpen);
  if (!placed) return null;

  let next = 0;
  let lastString = placed[0]?.string ?? 0;
  const steps: TabStep[] = line.steps.map((step) => {
    if (step === "|") return "bar";
    if (step === "-") return "rest";
    if (step === "x") return [{ string: lastString, text: "x" }];
    const note = placed[next++];
    lastString = note.string;
    return [{ string: note.string, text: String(note.fret) }];
  });
  return writeTab(instrument, steps);
}

/**
 * A root or chord from the pool and a random line from `config.lines`,
 * written out as tab. `config.instrument` is "bass" (the default) or
 * "guitar"; `config.open_strings: false` keeps lines to movable shapes.
 */
export const linePicker: Generator = (input, previousLabel) => {
  const label = pickFromPool(input, previousLabel);
  const lines = (input.config.lines as Line[] | undefined) ?? [];
  if (!label || lines.length === 0) return { label: label ?? "?" };

  const instrument = input.config.instrument === "guitar" ? "guitar" : "bass";
  const allowOpen = input.config.open_strings !== false;
  const line = lines[Math.floor(Math.random() * lines.length)];
  return {
    label,
    detail: line.text,
    tab: lineTab(instrument, label, line, allowOpen) ?? undefined,
    tabRoot: pitchClass(/^[A-G][#b]?/.exec(label)?.[0] ?? "") ?? undefined,
  };
};
