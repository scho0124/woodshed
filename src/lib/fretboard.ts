/**
 * Notes on a fretted neck for the lead and bass drills: standard scale
 * positions, fitting a line into one hand position, and writing it out as tab.
 * Strings count from 0 = the lowest, as in tabParser.
 */
import { findTuning } from "./tunings";

export type NeckInstrument = "guitar" | "bass";

export const OPEN_STRINGS: Record<NeckInstrument, number[]> = {
  guitar: findTuning("Standard")!.strings,
  bass: findTuning("Standard (bass)")!.strings,
};

const STRING_NAMES: Record<NeckInstrument, string[]> = {
  guitar: ["E", "A", "D", "G", "B", "e"],
  bass: ["E", "A", "D", "G"],
};

export interface FretNote {
  string: number;
  fret: number;
}

/** A note as written in a tab: a fret number, or marks like "x" or "7b9". */
export interface TabNote {
  string: number;
  text: string;
}

/** A tab column: notes struck together, a rest, or a bar line. */
export type TabStep = TabNote[] | "rest" | "bar";

/** Tab lines, highest string first, like `e|--5-8-|-7-|`. */
export function writeTab(instrument: NeckInstrument, steps: TabStep[]): string[] {
  const names = STRING_NAMES[instrument];
  const rows = names.map((name) => `${name}|-`);
  for (const step of steps) {
    if (step === "bar") {
      rows.forEach((_, s) => (rows[s] += "-|"));
      continue;
    }
    const notes = step === "rest" ? [] : step;
    const width = Math.max(1, ...notes.map((n) => n.text.length));
    rows.forEach((_, s) => {
      const note = notes.find((n) => n.string === s);
      rows[s] += "-" + (note ? note.text : "").padEnd(width, "-");
    });
  }
  return rows.map((row) => (row.endsWith("|") ? row : `${row}-|`)).reverse();
}

/**
 * Frets for a run of pitches in one hand position: the lowest position where
 * every note sits within four frets, or, failing that, five (a one-fret
 * stretch, which chromatic lines need). Open strings count as in reach at the
 * bottom of the neck unless `allowOpen` is false. Null if nothing fits.
 */
export function placeInPosition(
  instrument: NeckInstrument,
  pitches: number[],
  allowOpen = true,
): FretNote[] | null {
  const open = OPEN_STRINGS[instrument];
  for (const span of [4, 5]) {
    for (let position = 1; position <= 17; position++) {
      const placed: FretNote[] = [];
      for (const pitch of pitches) {
        const spots = open.map((o, string) => ({ string, fret: pitch - o }));
        const spot =
          spots.find((s) => s.fret >= position && s.fret < position + span) ??
          (allowOpen && position <= 2 ? spots.find((s) => s.fret === 0) : undefined);
        if (!spot) break;
        placed.push(spot);
      }
      if (placed.length === pitches.length) return placed;
    }
  }
  return null;
}

/**
 * A line given as semitones from a root (negative for below it), placed in
 * the lowest octave and hand position that fit the neck.
 */
export function placeLine(
  instrument: NeckInstrument,
  rootPc: number,
  offsets: number[],
  allowOpen = true,
): FretNote[] | null {
  const lowest = OPEN_STRINGS[instrument][0];
  const firstRoot = lowest + ((((rootPc - lowest) % 12) + 12) % 12);
  for (let octave = 0; octave < 3; octave++) {
    const pitches = offsets.map((o) => firstRoot + 12 * octave + o);
    if (Math.min(...pitches) < lowest) continue;
    const placed = placeInPosition(instrument, pitches, allowOpen);
    if (placed) return placed;
  }
  return null;
}

/**
 * One standard position of a scale, lowest note first. Position 1 starts on
 * the root on the lowest string and each next position on the next scale
 * note up, with `perString` notes on every string (2 for pentatonic).
 */
export function scalePosition(
  instrument: NeckInstrument,
  rootPc: number,
  steps: number[],
  position: number,
  perString: number,
): FretNote[] {
  const open = OPEN_STRINGS[instrument];
  const scale = steps.map((s) => (rootPc + s) % 12);
  const count = position - 1 + perString * open.length;
  const pitches: number[] = [];
  for (let p = open[0] + ((((rootPc - open[0]) % 12) + 12) % 12); pitches.length < count; p++) {
    if (scale.includes(p % 12)) pitches.push(p);
  }
  return pitches.slice(position - 1).map((pitch, i) => {
    const string = Math.floor(i / perString);
    return { string, fret: pitch - open[string] };
  });
}
