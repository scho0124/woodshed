import type { Generator } from "./types";
import { pickFromPool } from "./pickFromPool";
import { scalePosition, writeTab, type FretNote, type TabStep } from "@/lib/fretboard";
import { pitchClass } from "@/lib/pianoTheory";

const SCALES: Record<string, { name: string; steps: number[] }> = {
  minor_pentatonic: { name: "minor pentatonic", steps: [0, 3, 5, 7, 10] },
};

/** Orders to play a position's notes in, lowest note = 0. */
export const SEQUENCES: Record<string, { text: string; order: (count: number) => number[] }> = {
  UP: { text: "Up the shape, eighth notes against the click", order: (n) => [...Array(n).keys()] },
  DOWN: { text: "Down the shape from the top note", order: (n) => [...Array(n).keys()].reverse() },
  THREES: {
    text: "Up in groups of three: 1 2 3, 2 3 4, 3 4 5...",
    order: (n) => [...Array(n - 2).keys()].flatMap((i) => [i, i + 1, i + 2]),
  },
  SKIPS: {
    text: "Up in skips: 1 3, 2 4, 3 5...",
    order: (n) => [...Array(n - 2).keys()].flatMap((i) => [i, i + 2]),
  },
};

/**
 * Tab and shape for a scale position played in a sequence from the pool, or,
 * with `config.scale: "chromatic_run"`, a four-fret chromatic exercise in the
 * finger order from the pool (like "1-3-2-4") on every string.
 */
export const scalePatternPicker: Generator = (input, previousLabel) => {
  const label = pickFromPool(input, previousLabel) ?? "?";
  const config = input.config;

  if (config.scale === "chromatic_run") {
    const start = (config.start_fret as number | undefined) ?? 5;
    const fingers = label.split("-").map(Number);
    const steps: TabStep[] = [0, 1, 2, 3, 4, 5].flatMap((string) =>
      fingers.map((f) => [{ string, text: String(start + f - 1) }]),
    );
    return {
      label,
      detail: `Fingers ${label.replace(/-/g, " ")} on every string, frets ${start} to ${start + 3}. Strict alternate picking`,
      tab: writeTab("guitar", steps),
    };
  }

  const scale = SCALES[config.scale as string] ?? SCALES.minor_pentatonic;
  const key = (config.key as string | undefined) ?? "A";
  const positions = (config.positions as number[] | undefined) ?? [1];
  const position = positions[Math.floor(Math.random() * positions.length)];
  const sequence = SEQUENCES[label] ?? SEQUENCES.UP;
  const notes: FretNote[] = scalePosition("guitar", pitchClass(key)!, scale.steps, position, 2);
  return {
    label,
    detail: `${key} ${scale.name}, position ${position}. ${sequence.text}`,
    tab: writeTab(
      "guitar",
      sequence.order(notes.length).map((i) => [{ string: notes[i].string, text: String(notes[i].fret) }]),
    ),
    tabRoot: pitchClass(key)!,
  };
};
