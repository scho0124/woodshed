/**
 * Fretboard shapes for the diagram on the practice screen.
 * frets: one entry per string, in the order the diagram draws them left to right
 * (guitar: low E to high E; ukulele: G C E A). -1 = muted, 0 = open, N = fret.
 * baseFret: the fret the diagram starts drawing from (1 unless noted).
 * Chords without an entry here still work in a session — the practice
 * screen just falls back to showing the name without a diagram.
 */
export interface ChordShape {
  frets: number[];
  baseFret: number;
}

export const CHORD_SHAPES: Record<string, ChordShape> = {
  E: { frets: [0, 2, 2, 1, 0, 0], baseFret: 1 },
  A: { frets: [-1, 0, 2, 2, 2, 0], baseFret: 1 },
  D: { frets: [-1, -1, 0, 2, 3, 2], baseFret: 1 },
  G: { frets: [3, 2, 0, 0, 0, 3], baseFret: 1 },
  C: { frets: [-1, 3, 2, 0, 1, 0], baseFret: 1 },
  Am: { frets: [-1, 0, 2, 2, 1, 0], baseFret: 1 },
  Em: { frets: [0, 2, 2, 0, 0, 0], baseFret: 1 },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], baseFret: 1 },
  F: { frets: [1, 3, 3, 2, 1, 1], baseFret: 1 },

  Bm: { frets: [-1, 2, 4, 4, 3, 2], baseFret: 2 },
  B: { frets: [-1, 2, 4, 4, 4, 2], baseFret: 2 },
  "F#m": { frets: [2, 4, 4, 2, 2, 2], baseFret: 2 },
  "C#m": { frets: [-1, 4, 6, 6, 5, 4], baseFret: 4 },
  Gm: { frets: [3, 5, 5, 3, 3, 3], baseFret: 3 },

  E5: { frets: [0, 2, 2, -1, -1, -1], baseFret: 1 },
  A5: { frets: [-1, 0, 2, 2, -1, -1], baseFret: 1 },
  D5: { frets: [-1, -1, 0, 2, 3, -1], baseFret: 1 },
  G5: { frets: [3, 5, 5, -1, -1, -1], baseFret: 1 },
  C5: { frets: [-1, 3, 5, 5, -1, -1], baseFret: 1 },
  B5: { frets: [-1, 2, 4, 4, -1, -1], baseFret: 1 },

  E7: { frets: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  A7: { frets: [-1, 0, 2, 0, 2, 0], baseFret: 1 },
  D7: { frets: [-1, -1, 0, 2, 1, 2], baseFret: 1 },
  G7: { frets: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  Cmaj7: { frets: [-1, 3, 2, 0, 0, 0], baseFret: 1 },
  Am7: { frets: [-1, 0, 2, 0, 1, 0], baseFret: 1 },
  Dm7: { frets: [-1, -1, 0, 2, 1, 1], baseFret: 1 },

  Dsus2: { frets: [-1, -1, 0, 2, 3, 0], baseFret: 1 },
  Dsus4: { frets: [-1, -1, 0, 2, 3, 3], baseFret: 1 },
  Asus2: { frets: [-1, 0, 2, 2, 0, 0], baseFret: 1 },
  Asus4: { frets: [-1, 0, 2, 2, 3, 0], baseFret: 1 },
  Cadd9: { frets: [-1, 3, 2, 0, 3, 0], baseFret: 1 },
  Gadd9: { frets: [3, 2, 0, 2, 0, 3], baseFret: 1 },
};

/** Standard GCEA ukulele shapes. The same chord names as guitar, different fingerings. */
export const UKULELE_CHORD_SHAPES: Record<string, ChordShape> = {
  C: { frets: [0, 0, 0, 3], baseFret: 1 },
  Am: { frets: [2, 0, 0, 0], baseFret: 1 },
  F: { frets: [2, 0, 1, 0], baseFret: 1 },
  G: { frets: [0, 2, 3, 2], baseFret: 1 },
  Dm: { frets: [2, 2, 1, 0], baseFret: 1 },
  Em: { frets: [0, 4, 3, 2], baseFret: 1 },
  A: { frets: [2, 1, 0, 0], baseFret: 1 },
  D: { frets: [2, 2, 2, 0], baseFret: 1 },

  Bb: { frets: [3, 2, 1, 1], baseFret: 1 },
  Gm: { frets: [0, 2, 3, 1], baseFret: 1 },
  Bm: { frets: [4, 2, 2, 2], baseFret: 2 },
  "F#m": { frets: [2, 1, 2, 0], baseFret: 1 },
  Cm: { frets: [0, 3, 3, 3], baseFret: 1 },

  C7: { frets: [0, 0, 0, 1], baseFret: 1 },
  G7: { frets: [0, 2, 1, 2], baseFret: 1 },
  A7: { frets: [0, 1, 0, 0], baseFret: 1 },
  D7: { frets: [2, 2, 2, 3], baseFret: 1 },
  E7: { frets: [1, 2, 0, 2], baseFret: 1 },
  Am7: { frets: [0, 0, 0, 0], baseFret: 1 },
  Cmaj7: { frets: [0, 0, 0, 2], baseFret: 1 },
};

export type ChordInstrument = "guitar" | "ukulele";

export function chordShape(name: string, instrument: ChordInstrument = "guitar"): ChordShape | undefined {
  return (instrument === "ukulele" ? UKULELE_CHORD_SHAPES : CHORD_SHAPES)[name];
}
