/**
 * Wait-mode play-along: the cursor waits on each step until it's played.
 * A pure reducer over audio events and user actions, so it can be tested
 * without audio.
 *
 * - Single notes are judged by pitch. Legato notes (no pick attack) can hit
 *   but never count as wrong on a picked step; they're usually a previous note
 *   changing pitch as it rings or decays.
 * - Chords advance on any strum and aren't scored yet.
 * - Steps with nothing to score (ghost or dead notes only) are passed automatically.
 */
import type { AudioEvent } from "./types";
import type { Step, StepNote, TabSection } from "./tabParser";
import { centsOff, hzToMidi, midiName } from "./music";

export type StepStatus = "pending" | "hit" | "retried" | "skipped" | "strummed" | "passed";

export interface StepStats {
  passes: number;
  firstTry: number;
  retried: number;
  skipped: number;
  wrong: number;
  /** Time from the previous note to hitting this one, summed over timed passes. */
  timedMs: number;
  timedPasses: number;
}

export interface MatchOptions {
  toleranceCents: number;
  /** Accept the right note in any octave (guards against pitch-detection octave slips). */
  anyOctave: boolean;
  a4: number;
}

export interface Feedback {
  kind: "hit" | "wrong";
  step: number;
  expectedMidi: number;
  playedMidi: number;
  cents: number;
  /** Increases with every feedback so the UI can tell repeats apart. */
  seq: number;
}

export interface Loop {
  start: number;
  end: number;
}

export interface MatchState {
  index: number;
  finished: boolean;
  status: StepStatus[];
  stats: StepStats[];
  /** Wrong notes on the current step during this pass. */
  attempts: number;
  loop: Loop | null;
  loopPasses: number;
  /** Audio events at or before this time belong to a step already done. */
  consumedT: number;
  stepStartedT: number | null;
  bendHeldSince: number | null;
  feedback: Feedback | null;
}

export type MatchAction =
  | AudioEvent
  | { type: "skip" }
  | { type: "back" }
  | { type: "jump"; index: number }
  | { type: "loop"; loop: Loop | null }
  | { type: "restart" };

/** A bend counts once it holds at the target this long. */
const BEND_HOLD_SECS = 0.06;

const emptyStats = (): StepStats => ({
  passes: 0,
  firstTry: 0,
  retried: 0,
  skipped: 0,
  wrong: 0,
  timedMs: 0,
  timedPasses: 0,
});

export function scoredNote(step: Step): StepNote | undefined {
  return step.kind === "note" ? step.notes.find((n) => n.scored) : undefined;
}

/** The pitch that completes a note step: the bend target for bends. */
export function targetMidi(step: Step): number | null {
  const n = scoredNote(step);
  return n ? (n.bendTo ?? n.midi) : null;
}

export function initialMatch(steps: Step[], loop: Loop | null = null): MatchState {
  return passUnscored(
    {
      index: loop?.start ?? 0,
      finished: steps.length === 0,
      status: steps.map(() => "pending"),
      stats: steps.map(emptyStats),
      attempts: 0,
      loop,
      loopPasses: 0,
      consumedT: -Infinity,
      stepStartedT: null,
      bendHeldSince: null,
      feedback: null,
    },
    steps,
  );
}

/** Moves past steps with nothing to score, wrapping at the loop end or finishing. */
function passUnscored(state: MatchState, steps: Step[]): MatchState {
  let s = state;
  let guard = steps.length + 1;
  while (!s.finished && steps[s.index]?.kind === "unscored" && guard-- > 0) {
    s = moveOn(s, steps, "passed", s.stepStartedT);
  }
  return s;
}

function moveOn(state: MatchState, steps: Step[], result: StepStatus, t: number | null): MatchState {
  const i = state.index;
  const status = [...state.status];
  const stats = [...state.stats];
  status[i] = result;
  const st = { ...stats[i] };
  if (result !== "passed") st.passes++;
  if (result === "hit") st.firstTry++;
  if (result === "retried") st.retried++;
  if (result === "skipped") st.skipped++;
  if ((result === "hit" || result === "retried") && t !== null && state.stepStartedT !== null) {
    st.timedMs += Math.max(0, t - state.stepStartedT) * 1000;
    st.timedPasses++;
  }
  stats[i] = st;

  let next = i + 1;
  let finished = false;
  let loopPasses = state.loopPasses;
  if (state.loop && i >= state.loop.end) {
    next = state.loop.start;
    loopPasses++;
    for (let k = state.loop.start; k <= state.loop.end; k++) status[k] = "pending";
  } else if (next >= steps.length) {
    next = i;
    finished = true;
  }

  return {
    ...state,
    index: next,
    finished,
    status,
    stats,
    loopPasses,
    attempts: 0,
    bendHeldSince: null,
    stepStartedT: t,
    consumedT: t !== null ? Math.max(state.consumedT, t) : state.consumedT,
  };
}

function hit(state: MatchState, steps: Step[], t: number, played: number, cents: number): MatchState {
  const i = state.index;
  const moved = moveOn(state, steps, state.attempts === 0 ? "hit" : "retried", t);
  return passUnscored(
    {
      ...moved,
      feedback: { kind: "hit", step: i, expectedMidi: targetMidi(steps[i])!, playedMidi: played, cents, seq: (state.feedback?.seq ?? 0) + 1 },
    },
    steps,
  );
}

function goTo(state: MatchState, steps: Step[], index: number, direction: 1 | -1): MatchState {
  const lo = state.loop?.start ?? 0;
  const hi = state.loop?.end ?? steps.length - 1;
  let i = Math.min(Math.max(index, lo), hi);
  while (steps[i]?.kind === "unscored" && i + direction >= lo && i + direction <= hi) i += direction;
  const status = [...state.status];
  status[i] = "pending";
  return { ...state, index: i, finished: false, status, attempts: 0, stepStartedT: null, bendHeldSince: null };
}

export function matchReducer(
  state: MatchState,
  action: MatchAction,
  steps: Step[],
  options: MatchOptions,
): MatchState {
  switch (action.type) {
    case "restart":
      return initialMatch(steps, state.loop);

    case "skip":
      if (state.finished) return state;
      return passUnscored(moveOn(state, steps, "skipped", null), steps);

    case "back":
      return goTo(state, steps, state.index - 1, -1);

    case "jump":
      return goTo(state, steps, action.index, 1);

    case "loop": {
      if (!action.loop) return { ...state, loop: null };
      const loop = {
        start: Math.min(action.loop.start, action.loop.end),
        end: Math.max(action.loop.start, action.loop.end),
      };
      return goTo({ ...state, loop }, steps, loop.start, 1);
    }

    case "error":
      return state;

    case "onset": {
      if (state.finished || action.t <= state.consumedT) return state;
      if (steps[state.index]?.kind !== "chord") return state;
      return passUnscored(moveOn(state, steps, "strummed", action.t), steps);
    }

    case "frame": {
      const step = steps[state.index];
      const note = step && scoredNote(step);
      if (state.finished || !note || note.bendTo === undefined || action.t <= state.consumedT) return state;
      const atTarget =
        action.hz !== null &&
        Math.abs(centsOff(hzToMidi(action.hz, options.a4), note.bendTo, options.anyOctave)) <= options.toleranceCents;
      if (!atTarget) return state.bendHeldSince === null ? state : { ...state, bendHeldSince: null };
      if (state.bendHeldSince === null) return { ...state, bendHeldSince: action.t };
      if (action.t - state.bendHeldSince < BEND_HOLD_SECS) return state;
      const played = hzToMidi(action.hz!, options.a4);
      return hit(state, steps, action.t, played, centsOff(played, note.bendTo, options.anyOctave));
    }

    case "note": {
      if (state.finished || action.t <= state.consumedT) return state;
      const step = steps[state.index];
      const note = step && scoredNote(step);
      if (!note || note.midi === null) return state;

      const played = hzToMidi(action.hz, options.a4);
      const target = note.bendTo ?? note.midi;
      const off = centsOff(played, target, options.anyOctave);
      const tolerance = options.toleranceCents / 100;
      if (Math.abs(off) <= options.toleranceCents) return hit(state, steps, action.t, played, off);

      // Mid-bend: anything from the fretted note up to the target is on the way there.
      if (note.bendTo !== undefined && played >= note.midi - tolerance && played <= note.bendTo + tolerance) {
        return state;
      }
      if (action.legato && !step.legato) return state;
      if (action.legato && step.legato) {
        // Sliding past the frets between the previous note and this one isn't a mistake.
        const prev = state.index > 0 ? targetMidi(steps[state.index - 1]) : null;
        if (prev !== null && played >= Math.min(prev, target) - tolerance && played <= Math.max(prev, target) + tolerance) {
          return state;
        }
      }

      const stats = [...state.stats];
      stats[state.index] = { ...stats[state.index], wrong: stats[state.index].wrong + 1 };
      return {
        ...state,
        stats,
        attempts: state.attempts + 1,
        feedback: { kind: "wrong", step: state.index, expectedMidi: target, playedMidi: played, cents: off, seq: (state.feedback?.seq ?? 0) + 1 },
      };
    }
  }
}

export interface RunSummary {
  notesPlayed: number;
  firstTry: number;
  retried: number;
  skipped: number;
  wrong: number;
  /** First-try hits out of notes played; null when nothing was played. */
  accuracy: number | null;
  mostMissed: { label: string; misses: number }[];
  slowest: { step: number; bar: number; label: string; avgMs: number }[];
  sections: { name: string; accuracy: number | null; notes: number }[];
  weakestBars: { bar: number; accuracy: number; notes: number }[];
}

function noteLabel(step: Step): string {
  const n = scoredNote(step)!;
  return `String ${step.stringCount - n.string}, fret ${n.fret} (${midiName(n.midi!)})`;
}

export function summarize(state: MatchState, steps: Step[], sections: TabSection[]): RunSummary {
  let firstTry = 0;
  let retried = 0;
  let skipped = 0;
  let wrong = 0;
  const missed = new Map<string, number>();
  const bars = new Map<number, { hits: number; notes: number }>();
  const bySection = new Map<number, { hits: number; notes: number }>();
  const slowest: RunSummary["slowest"] = [];

  steps.forEach((step, i) => {
    if (step.kind !== "note") return;
    const st = state.stats[i];
    const played = st.firstTry + st.retried + st.skipped;
    firstTry += st.firstTry;
    retried += st.retried;
    skipped += st.skipped;
    wrong += st.wrong;
    if (played === 0) return;

    const misses = st.wrong + st.skipped;
    if (misses > 0) {
      const label = noteLabel(step);
      missed.set(label, (missed.get(label) ?? 0) + misses);
    }
    const bar = bars.get(step.bar) ?? { hits: 0, notes: 0 };
    bars.set(step.bar, { hits: bar.hits + st.firstTry, notes: bar.notes + played });
    if (step.section !== null) {
      const sec = bySection.get(step.section) ?? { hits: 0, notes: 0 };
      bySection.set(step.section, { hits: sec.hits + st.firstTry, notes: sec.notes + played });
    }
    if (st.timedPasses > 0) {
      slowest.push({ step: i, bar: step.bar, label: noteLabel(step), avgMs: st.timedMs / st.timedPasses });
    }
  });

  const notesPlayed = firstTry + retried + skipped;
  return {
    notesPlayed,
    firstTry,
    retried,
    skipped,
    wrong,
    accuracy: notesPlayed > 0 ? firstTry / notesPlayed : null,
    mostMissed: [...missed]
      .map(([label, misses]) => ({ label, misses }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, 5),
    slowest: slowest
      .filter((s) => s.avgMs >= 1000)
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 3),
    sections: sections
      .map((sec, i) => {
        const r = bySection.get(i);
        return { name: sec.name, accuracy: r && r.notes > 0 ? r.hits / r.notes : null, notes: r?.notes ?? 0 };
      })
      .filter((s) => s.notes > 0),
    weakestBars: [...bars]
      .filter(([, r]) => r.notes >= 2 && r.hits < r.notes)
      .map(([bar, r]) => ({ bar, accuracy: r.hits / r.notes, notes: r.notes }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3),
  };
}

/** Per-step results saved with a run, for tracking trouble spots across runs. */
export function stepDetails(state: MatchState) {
  return state.stats
    .map((st, i) => ({ i, ...st }))
    .filter((st) => st.passes > 0)
    .map(({ i, passes, firstTry, retried, skipped, wrong }) => ({ i, passes, firstTry, retried, skipped, wrong }));
}
