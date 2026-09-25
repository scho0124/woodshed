import { describe, expect, it } from "vitest";
import { scoreCheck, vibrato, type CheckResult, type VoiceFrame } from "./voiceCheck";

const STEP = 1 / 47;

/** Frames from `from` to `to` seconds with a pitch (Hz, or null for noise) and level. */
function span(from: number, to: number, hz: ((t: number) => number) | null, level = -25): VoiceFrame[] {
  const frames: VoiceFrame[] = [];
  for (let t = from; t < to; t += STEP) frames.push({ t, hz: hz ? hz(t) : null, level_db: level, clipping: false });
  return frames;
}
const silence = (from: number, to: number) => span(from, to, null, -70);
const steady = (hz: number) => () => hz;
const verdict = (r: CheckResult, label: string) => r.readings.find((x) => x.label === label)?.verdict;

const ctx = { threshold: -50, speaking: -25 };

describe("hold", () => {
  const check = { kind: "hold" as const, prompt: "", seconds: 4 };

  it("rates a steady, in-tune note held long enough as good", () => {
    const r = scoreCheck(check, [...silence(0, 0.5), ...span(0.5, 5, steady(220))], { ...ctx, targetMidi: 57 });
    expect(verdict(r, "Held for")).toBe("good");
    expect(verdict(r, "On the note")).toBe("good");
    expect(verdict(r, "Steadiness")).toBe("good");
    expect(r.warnings).toEqual([]);
  });

  it("flags a note a half step off the target and a short hold", () => {
    const r = scoreCheck(check, span(0, 1.5, steady(233.1)), { ...ctx, targetMidi: 57 });
    expect(verdict(r, "On the note")).toBe("bad");
    expect(verdict(r, "Held for")).toBe("bad");
  });

  it("catches a note that sags flat as the breath runs out", () => {
    const sag = (t: number) => 220 * 2 ** (-(t / 4) * (40 / 1200));
    const r = scoreCheck(check, span(0, 4, sag), { ...ctx, targetMidi: 57 });
    expect(verdict(r, "Drift")).not.toBe("good");
  });

  it("reports nothing heard when the mic only picks up the room", () => {
    expect(scoreCheck(check, silence(0, 5), ctx).heard).toBe(false);
  });
});

describe("vibrato", () => {
  it("measures speed and width", () => {
    const wobble = (t: number) => 220 * 2 ** ((50 * Math.sin(2 * Math.PI * 5.5 * t)) / 1200);
    const v = vibrato(span(0, 4, wobble))!;
    expect(v.rate).toBeGreaterThan(5);
    expect(v.rate).toBeLessThan(6);
    expect(v.width).toBeGreaterThan(35);
    expect(v.width).toBeLessThan(65);
  });

  it("hears no vibrato in a straight tone", () => {
    const r = scoreCheck({ kind: "vibrato", prompt: "" }, span(0, 5, steady(220)), ctx);
    expect(r.readings.find((x) => x.label === "Vibrato")?.value).toBe("not heard yet");
  });
});

describe("notes", () => {
  const scale = [60, 62, 64, 65, 67].map((m) => 440 * 2 ** ((m - 69) / 12));

  it("counts the held notes that are in tune", () => {
    const frames = scale.flatMap((hz, i) => span(i * 0.6, i * 0.6 + 0.5, steady(hz)));
    const r = scoreCheck({ kind: "notes", prompt: "" }, frames, ctx);
    expect(r.readings[0].value).toBe("5 of 5 notes within 25 cents");
    expect(r.readings[0].verdict).toBe("good");
  });

  it("notices a sharp note and a crack", () => {
    const frames = [
      ...span(0, 0.5, steady(scale[0])),
      ...span(0.6, 1.1, steady(scale[1] * 2 ** (40 / 1200))),
      ...span(1.2, 1.5, steady(scale[2])),
      ...span(1.5, 1.8, steady(scale[2] * 2)),
    ];
    const r = scoreCheck({ kind: "notes", prompt: "" }, frames, ctx);
    expect(r.readings[0].value).toMatch(/^3 of 4/);
    expect(verdict(r, "Breaks")).toBe("ok");
  });
});

describe("scream", () => {
  const check = { kind: "scream" as const, prompt: "", max_burst: 3 };
  const bursts = (count: number, length: number, rest: number, level: number) =>
    Array.from({ length: count }, (_, i) => {
      const start = i * (length + rest);
      return [...span(start, start + length, null, level), ...silence(start + length, start + length + rest)];
    }).flat();

  it("passes short, distorted bursts with rests at a sensible volume", () => {
    const r = scoreCheck(check, bursts(4, 1.5, 2, -20), ctx);
    expect(r.readings.every((x) => x.verdict === "good")).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("warns about pushing volume, long bursts and too little rest", () => {
    const r = scoreCheck(check, bursts(2, 6, 0.5, -5), ctx);
    expect(verdict(r, "Volume")).toBe("bad");
    expect(verdict(r, "Longest burst")).toBe("bad");
    expect(verdict(r, "Rest between")).toBe("bad");
    expect(r.warnings).toHaveLength(3);
    expect(r.warnings[0]).toMatch(/speaking volume/);
  });

  it("skips the volume reading without a speaking level", () => {
    const r = scoreCheck(check, bursts(3, 1, 2, -5), { threshold: -50 });
    expect(verdict(r, "Volume")).toBeUndefined();
  });

  it("wants a note under the grit for pitched grit", () => {
    const gritty = span(0, 2, (t) => (Math.floor(t * 20) % 2 ? 220 : NaN)).map((f) => ({
      ...f,
      hz: Number.isNaN(f.hz) ? null : f.hz,
    }));
    const r = scoreCheck({ ...check, pitched: true }, gritty, ctx);
    expect(verdict(r, "Pitch under the grit")).toBe("good");
  });
});

describe("fry and breath", () => {
  it("likes quiet, steady fry and warns when it's pushed", () => {
    const quiet = scoreCheck({ kind: "fry", prompt: "" }, span(0, 4, null, -35), ctx);
    expect(quiet.warnings).toEqual([]);
    expect(verdict(quiet, "Volume")).toBe("good");
    const pushed = scoreCheck({ kind: "fry", prompt: "" }, span(0, 4, null, -12), ctx);
    expect(pushed.warnings).toHaveLength(1);
  });

  it("times one breath of hiss", () => {
    const r = scoreCheck({ kind: "breath", prompt: "", seconds: 10 }, span(0, 12, null, -40), ctx);
    expect(verdict(r, "Longest breath")).toBe("good");
    expect(verdict(r, "Evenness")).toBe("good");
  });
});
