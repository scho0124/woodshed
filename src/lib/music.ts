const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** 40 -> "E2". */
export function midiName(midi: number, withOctave = true): string {
  const m = Math.round(midi);
  const name = NOTE_NAMES[((m % 12) + 12) % 12];
  return withOctave ? `${name}${Math.floor(m / 12) - 1}` : name;
}

/** Fractional MIDI note for a frequency; A4 = 69. */
export function hzToMidi(hz: number, a4 = 440): number {
  return 69 + 12 * Math.log2(hz / a4);
}

export function midiToHz(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** How far `played` is from `target` in cents, optionally ignoring which octave. */
export function centsOff(played: number, target: number, anyOctave = false): number {
  const cents = (played - target) * 100;
  if (!anyOctave) return cents;
  return ((((cents + 600) % 1200) + 1200) % 1200) - 600;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
