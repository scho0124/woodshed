/**
 * Scores a short vocal mic check from the analysis frames (about 47 a
 * second): how long a sound was held, how in tune and steady it was, vibrato,
 * and safety signs for screams, fry and belting, like pushing past your
 * speaking volume, bursts that run long, or too little rest. A mic hears the
 * sound, not what the throat is doing, so these are signs to act on, not a
 * diagnosis.
 */
import { centsOff, hzToMidi, median, midiName } from "./music";

export interface VoiceFrame {
  t: number;
  hz: number | null;
  level_db: number;
  clipping: boolean;
}

export type MicCheckKind = "breath" | "hold" | "vibrato" | "notes" | "belt" | "fry" | "scream";

/** A skill's `config.mic_check`. */
export interface MicCheckConfig {
  kind: MicCheckKind;
  /** What to do, shown before starting. */
  prompt: string;
  /** breath and hold: how long to aim for. */
  seconds?: number;
  /** hold: aim for the note picked from the skill's pool, in any octave. */
  target_from_pool?: boolean;
  /** scream: the longest burst before it's flagged. */
  max_burst?: number;
  /** scream: a sung pitch should come through the grit. */
  pitched?: boolean;
}

export type Verdict = "good" | "ok" | "bad";

export interface Reading {
  label: string;
  value: string;
  verdict: Verdict;
  hint?: string;
}

export interface CheckResult {
  heard: boolean;
  readings: Reading[];
  /** Safety signs, most important first. */
  warnings: string[];
}

export interface CheckContext {
  /** Level (dBFS) that counts as sound rather than the room. */
  threshold: number;
  /** Median level while speaking normally, for the loudness checks. */
  speaking?: number | null;
  /** MIDI note to aim for, in any octave. */
  targetMidi?: number | null;
  a4?: number;
}

/** How long each check listens for, after the quiet and speaking steps. */
export function listenSeconds(check: MicCheckConfig): number {
  switch (check.kind) {
    case "breath":
      return (check.seconds ?? 10) + 6;
    case "hold":
      return (check.seconds ?? 4) + 4;
    case "vibrato":
      return 8;
    case "notes":
      return 12;
    case "scream":
      return 15;
    default:
      return 10;
  }
}

/** Screams, fry and belting compare loudness against the speaking voice. */
export function needsSpeakingLevel(check: MicCheckConfig): boolean {
  return check.kind === "scream" || check.kind === "fry" || check.kind === "belt";
}

const FRAME_SECS = 1 / 47;
/** Silence shorter than this doesn't end a sound (a breath catch, a consonant). */
const MAX_GAP_SECS = 0.15;
/** Pitch settles a moment after a note starts. */
const ATTACK_SECS = 0.25;
/** A jump this big between neighboring readings is a crack or flip. */
const CRACK_CENTS = 300;

interface Run {
  start: number;
  end: number;
  frames: VoiceFrame[];
}

const duration = (run: Run) => run.end - run.start + FRAME_SECS;
const mad = (values: number[]) => {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
};
const fmt = (n: number, digits = 1) => n.toFixed(digits).replace(/\.0$/, "");
const signed = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}`;

/** Stretches of sound, bridging short gaps. */
export function soundRuns(frames: VoiceFrame[], threshold: number): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;
  for (const f of frames) {
    if (f.level_db < threshold) continue;
    if (current && f.t - current.end <= MAX_GAP_SECS) {
      current.end = f.t;
      current.frames.push(f);
    } else {
      current = { start: f.t, end: f.t, frames: [f] };
      runs.push(current);
    }
  }
  return runs.filter((r) => duration(r) >= 0.2);
}

function cracks(frames: VoiceFrame[], a4: number): number {
  let count = 0;
  const pitched = frames.filter((f) => f.hz);
  for (let i = 1; i < pitched.length; i++) {
    const gap = pitched[i].t - pitched[i - 1].t;
    const jump = Math.abs(hzToMidi(pitched[i].hz!, a4) - hzToMidi(pitched[i - 1].hz!, a4)) * 100;
    if (gap < 0.06 && jump > CRACK_CENTS) count++;
  }
  return count;
}

/** Held notes: stretches where the pitch stays within about half a semitone. */
export function heldNotes(frames: VoiceFrame[], a4 = 440): { midi: number; secs: number }[] {
  const notes: { midi: number; secs: number }[] = [];
  let seg: { t: number; midi: number }[] = [];
  const close = () => {
    const secs = seg.length ? seg[seg.length - 1].t - seg[0].t + FRAME_SECS : 0;
    if (secs >= 0.25) notes.push({ midi: median(seg.map((s) => s.midi)), secs });
    seg = [];
  };
  for (const f of frames) {
    if (!f.hz) continue;
    const midi = hzToMidi(f.hz, a4);
    const last = seg[seg.length - 1];
    if (last && (f.t - last.t > 0.08 || Math.abs(midi - median(seg.map((s) => s.midi))) > 0.6)) close();
    seg.push({ t: f.t, midi });
  }
  close();
  return notes;
}

/** Vibrato rate (Hz) and width (± cents) over a held note. */
export function vibrato(frames: VoiceFrame[], a4 = 440): { rate: number; width: number } | null {
  const pts = frames.filter((f) => f.hz).map((f) => ({ t: f.t, c: hzToMidi(f.hz!, a4) * 100 }));
  if (pts.length < 40) return null;
  // Take out slow drift with a moving average about 0.4 s wide.
  const half = 9;
  const resid = pts.map((p, i) => {
    const win = pts.slice(Math.max(0, i - half), i + half + 1);
    return p.c - win.reduce((s, w) => s + w.c, 0) / win.length;
  });
  const inner = resid.slice(half, resid.length - half);
  if (inner.length < 20) return null;
  let crossings = 0;
  let sign = 0;
  for (const r of inner) {
    if (Math.abs(r) < 4) continue;
    const s = Math.sign(r);
    if (sign !== 0 && s !== sign) crossings++;
    sign = s;
  }
  const secs = pts[pts.length - half - 1].t - pts[half].t;
  const rms = Math.sqrt(inner.reduce((s, r) => s + r * r, 0) / inner.length);
  return { rate: crossings / 2 / secs, width: rms * Math.SQRT2 };
}

function grade(value: number, good: [number, number], ok: [number, number]): Verdict {
  if (value >= good[0] && value <= good[1]) return "good";
  if (value >= ok[0] && value <= ok[1]) return "ok";
  return "bad";
}

function pitchReadings(frames: VoiceFrame[], ctx: CheckContext): Reading[] {
  const a4 = ctx.a4 ?? 440;
  const start = frames[0]?.t ?? 0;
  const settled = frames.filter((f) => f.hz && f.t - start >= ATTACK_SECS);
  if (settled.length < 10) {
    return [{ label: "Pitch", value: "No steady pitch", verdict: "bad", hint: "Sing a clear, comfortable note." }];
  }
  const midis = settled.map((f) => hzToMidi(f.hz!, a4));
  const note = median(midis);
  const readings: Reading[] = [];

  if (ctx.targetMidi != null) {
    const off = centsOff(note, ctx.targetMidi, true);
    readings.push({
      label: "On the note",
      value: `${midiName(Math.round(note))}, ${Math.abs(off) < 3 ? "right on" : `${Math.round(Math.abs(off))} cents ${off > 0 ? "sharp" : "flat"}`}`,
      verdict: grade(Math.abs(off), [0, 20], [0, 45]),
      hint: `Aiming for ${midiName(ctx.targetMidi, false)} in any octave.`,
    });
  } else {
    const off = (note - Math.round(note)) * 100;
    readings.push({
      label: "Note",
      value: `${midiName(Math.round(note))}, ${Math.abs(off) < 3 ? "centered" : `${Math.round(Math.abs(off))} cents ${off > 0 ? "sharp" : "flat"}`}`,
      verdict: grade(Math.abs(off), [0, 25], [0, 40]),
    });
  }

  const wobble = mad(midis.map((m) => m * 100));
  readings.push({
    label: "Steadiness",
    value: `within about ${Math.round(wobble)} cents`,
    verdict: grade(wobble, [0, 10], [0, 20]),
    hint: wobble > 20 ? "Keep the air steady; the pitch is wandering." : undefined,
  });

  const early = settled.filter((f) => f.t - settled[0].t < 0.5).map((f) => hzToMidi(f.hz!, a4));
  const late = settled.filter((f) => settled[settled.length - 1].t - f.t < 0.5).map((f) => hzToMidi(f.hz!, a4));
  const drift = (median(late) - median(early)) * 100;
  if (settled[settled.length - 1].t - settled[0].t >= 1.5) {
    readings.push({
      label: "Drift",
      value: Math.abs(drift) < 5 ? "none" : `${Math.round(Math.abs(drift))} cents ${drift > 0 ? "up" : "down"} by the end`,
      verdict: grade(Math.abs(drift), [0, 15], [0, 30]),
      hint: drift < -15 ? "Going flat at the end usually means the air support is running out." : undefined,
    });
  }
  return readings;
}

function loudness(runs: Run[], ctx: CheckContext): number | null {
  if (ctx.speaking == null) return null;
  const levels = runs.flatMap((r) => r.frames.map((f) => f.level_db));
  return levels.length ? median(levels) - ctx.speaking : null;
}

function clippingWarning(runs: Run[]): string[] {
  const frames = runs.flatMap((r) => r.frames);
  const clipped = frames.filter((f) => f.clipping).length;
  return frames.length && clipped / frames.length > 0.05
    ? ["The input is clipping. Turn the mic gain down or back off a little; loudness readings aren't reliable while it clips."]
    : [];
}

export function scoreCheck(check: MicCheckConfig, frames: VoiceFrame[], ctx: CheckContext): CheckResult {
  const a4 = ctx.a4 ?? 440;
  const runs = soundRuns(frames, ctx.threshold);
  if (runs.length === 0) return { heard: false, readings: [], warnings: [] };

  const longest = runs.reduce((a, b) => (duration(b) > duration(a) ? b : a));
  const voiced = runs.flatMap((r) => r.frames);
  const pitchedShare = voiced.filter((f) => f.hz).length / voiced.length;
  const readings: Reading[] = [];
  const warnings = clippingWarning(runs);
  const louder = loudness(runs, ctx);

  switch (check.kind) {
    case "breath": {
      const goal = check.seconds ?? 10;
      const levelSpread = mad(longest.frames.map((f) => f.level_db));
      readings.push(
        {
          label: "Longest breath",
          value: `${fmt(duration(longest))} s`,
          verdict: duration(longest) >= goal ? "good" : duration(longest) >= goal * 0.6 ? "ok" : "bad",
          hint: `Aim for ${goal} seconds on one breath.`,
        },
        {
          label: "Evenness",
          value: `level within about ${fmt(levelSpread)} dB`,
          verdict: grade(levelSpread, [0, 2], [0, 4]),
          hint: levelSpread > 4 ? "The air is coming in pushes. Let the belly release it slowly and evenly." : undefined,
        },
      );
      break;
    }

    case "hold": {
      const goal = check.seconds ?? 4;
      readings.push({
        label: "Held for",
        value: `${fmt(duration(longest))} s`,
        verdict: duration(longest) >= goal ? "good" : duration(longest) >= goal * 0.6 ? "ok" : "bad",
        hint: `Aim for ${goal} seconds.`,
      });
      readings.push(...pitchReadings(longest.frames, ctx));
      const breaks = cracks(longest.frames, a4);
      if (breaks > 0) {
        readings.push({ label: "Breaks", value: `${breaks} crack${breaks === 1 ? "" : "s"} or flips`, verdict: "ok" });
      }
      break;
    }

    case "vibrato": {
      readings.push({
        label: "Held for",
        value: `${fmt(duration(longest))} s`,
        verdict: duration(longest) >= 3 ? "good" : "ok",
      });
      const v = vibrato(longest.frames.filter((f) => f.t - longest.start >= 0.5), a4);
      if (!v || v.width < 8) {
        readings.push({
          label: "Vibrato",
          value: "not heard yet",
          verdict: "ok",
          hint: "Start straight, then relax and let the pitch wobble gently.",
        });
      } else {
        readings.push(
          {
            label: "Vibrato speed",
            value: `${fmt(v.rate)} per second`,
            verdict: grade(v.rate, [4.5, 7], [3.5, 8]),
            hint: v.rate > 7 ? "Fast and tight often means tension. Relax the jaw and tongue." : v.rate < 4.5 ? "Slow and wide can mean it's driven from the jaw or belly. Let it come from the note itself." : undefined,
          },
          {
            label: "Vibrato width",
            value: `±${Math.round(v.width)} cents`,
            verdict: grade(v.width, [15, 80], [8, 120]),
          },
        );
      }
      break;
    }

    case "notes":
    case "belt": {
      const notes = heldNotes(voiced, a4);
      if (notes.length === 0) {
        readings.push({ label: "Notes", value: "No held notes heard", verdict: "bad", hint: "Hold each note a little longer." });
      } else {
        const offs = notes.map((n) => Math.abs((n.midi - Math.round(n.midi)) * 100));
        const centered = offs.filter((o) => o <= 25).length;
        readings.push({
          label: "In tune",
          value: `${centered} of ${notes.length} notes within 25 cents`,
          verdict: centered / notes.length >= 0.8 ? "good" : centered / notes.length >= 0.6 ? "ok" : "bad",
          hint: notes.map((n) => midiName(Math.round(n.midi))).join(" "),
        });
      }
      const breaks = cracks(voiced, a4);
      readings.push({
        label: "Breaks",
        value: breaks === 0 ? "none" : `${breaks} crack${breaks === 1 ? "" : "s"} or flips`,
        verdict: breaks === 0 ? "good" : breaks <= 2 ? "ok" : "bad",
      });
      if (check.kind === "belt" && louder !== null) {
        readings.push({
          label: "Volume",
          value: `${signed(louder)} dB vs speaking`,
          verdict: grade(louder, [2, 12], [-3, 15]),
        });
        if (louder > 15) {
          warnings.push(
            "That's far louder than your speaking voice. A healthy belt feels loud but easy; back off until it stops feeling pushed.",
          );
        }
      }
      break;
    }

    case "fry": {
      const levelSpread = mad(longest.frames.map((f) => f.level_db));
      readings.push(
        {
          label: "Held for",
          value: `${fmt(duration(longest))} s`,
          verdict: duration(longest) >= 3 ? "good" : "ok",
        },
        {
          label: "Steadiness",
          value: `level within about ${fmt(levelSpread)} dB`,
          verdict: grade(levelSpread, [0, 2.5], [0, 4.5]),
        },
      );
      if (pitchedShare > 0.5) {
        readings.push({
          label: "Fry",
          value: "mostly a sung note",
          verdict: "ok",
          hint: "Let the voice drop to the crackle below your lowest note.",
        });
      }
      if (louder !== null) {
        readings.push({ label: "Volume", value: `${signed(louder)} dB vs speaking`, verdict: grade(louder, [-40, 0], [-40, 6]) });
        if (louder > 6) warnings.push("Fry should be quieter than speaking. Pushing it louder strains the cords; keep it effortless.");
      }
      break;
    }

    case "scream": {
      const maxBurst = check.max_burst ?? 3;
      const bursts = runs;
      const longestBurst = Math.max(...bursts.map(duration));
      const grit = 1 - pitchedShare;

      if (check.pitched) {
        readings.push({
          label: "Pitch under the grit",
          value: `${Math.round(pitchedShare * 100)}% of the sound has a clear note`,
          verdict: grade(pitchedShare, [0.2, 0.85], [0.1, 1]),
          hint: pitchedShare < 0.2 ? "The note is getting lost. Start from a clean note and add less grit." : pitchedShare > 0.85 ? "That's mostly clean. Add a little grit on top." : undefined,
        });
      } else {
        readings.push({
          label: "Distortion",
          value: `${Math.round(grit * 100)}% of the sound`,
          verdict: grit >= 0.6 ? "good" : "ok",
          hint: grit < 0.6 ? "It's mostly clean tone so far. That's safe; build the distortion slowly." : undefined,
        });
      }

      readings.push({
        label: "Longest burst",
        value: `${fmt(longestBurst)} s`,
        verdict: longestBurst <= maxBurst ? "good" : longestBurst <= maxBurst * 1.5 ? "ok" : "bad",
        hint: `Keep bursts to ${maxBurst} seconds or less while learning.`,
      });
      if (longestBurst > maxBurst * 1.5) {
        warnings.push(`Bursts are running past ${maxBurst} seconds. Keep them short while you build the technique.`);
      }

      if (bursts.length >= 2) {
        // Average rest between bursts against the average burst.
        const burstMean = bursts.reduce((s, b) => s + duration(b), 0) / bursts.length;
        const gaps = bursts.slice(1).map((b, i) => b.start - (bursts[i].end + FRAME_SECS));
        const ratio = gaps.reduce((s, g) => s + g, 0) / gaps.length / burstMean;
        readings.push({
          label: "Rest between",
          value: `${fmt(ratio)}× as long as the bursts`,
          verdict: ratio >= 1 ? "good" : ratio >= 0.5 ? "ok" : "bad",
          hint: "Rest at least as long as each burst.",
        });
        if (ratio < 0.5) warnings.push("You're barely resting between bursts. Rest at least as long as each scream.");
      } else {
        readings.push({ label: "Rest between", value: "one long burst", verdict: "ok", hint: "Do a few short bursts with rests." });
      }

      if (louder !== null) {
        readings.push({
          label: "Volume",
          value: `${signed(louder)} dB vs speaking`,
          verdict: grade(louder, [-40, 8], [-40, 12]),
          hint: "Distortion comes from air and placement, not volume.",
        });
        if (louder > 12) {
          warnings.unshift(
            "You're pushing well past your speaking volume. Loudness isn't what makes a scream; back off and let the mic do the work.",
          );
        }
      }
      break;
    }
  }

  return { heard: true, readings, warnings };
}
