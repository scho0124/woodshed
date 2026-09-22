import type { ChordInstrument } from "@/lib/chordShapes";

export interface Prompt {
  /** Big label shown center-stage (a chord name, a fret number, a root note). */
  label: string;
  /** Secondary line under the label. */
  detail?: string;
  /** If set and a shape exists in chordShapes.ts, the fretboard diagram renders. */
  chordShapeName?: string;
  /** Which shape table `chordShapeName` is looked up in; guitar if unset. */
  chordInstrument?: ChordInstrument;
  /** If set, a two-octave keyboard renders with these keys pressed (0 = the first C). */
  keys?: number[];
  /** Keys in `keys` to mark as the root. */
  rootKeys?: number[];
}

export interface GeneratorInput {
  /** The skill's config JSONB from the database. */
  config: Record<string, unknown>;
  /** The user's chosen subset of the pool from Session Setup, if applicable. */
  selectedPool?: string[];
}

/**
 * A generator turns a skill's config into the next prompt. Adding a skill
 * that reuses one of these needs no code change — just a new `skills` row.
 * Adding a genuinely new drill mechanic means writing one generator here,
 * registering it in index.ts, and (if it needs one) a config UI section
 * in SessionSetup.
 */
export type Generator = (input: GeneratorInput, previousLabel?: string) => Prompt;
