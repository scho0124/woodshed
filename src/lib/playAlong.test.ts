import { describe, expect, it } from "vitest";
import { parseTab } from "./tabParser";
import { initialMatch, matchReducer, summarize } from "./playAlong";
import type { MatchAction, MatchOptions, MatchState } from "./playAlong";
import { midiToHz } from "./music";

const OPTIONS: MatchOptions = { toleranceCents: 50, anyOctave: false, a4: 440 };

function staff(lines: string[]) {
  return parseTab(lines.join("\n"));
}

// Low E riff: E2 (40), G2 (43), A2 (45)
const riff = staff([
  "e|------------|",
  "B|------------|",
  "G|------------|",
  "D|------------|",
  "A|---------0--|",
  "E|--0---3-----|",
]);

function play(tab: ReturnType<typeof parseTab>, actions: MatchAction[], options = OPTIONS): MatchState {
  return actions.reduce((s, a) => matchReducer(s, a, tab.steps, options), initialMatch(tab.steps));
}

const note = (t: number, midi: number, legato = false, cents = 0): MatchAction => ({
  type: "note",
  t,
  hz: midiToHz(midi + cents / 100),
  legato,
});
const onset = (t: number): MatchAction => ({ type: "onset", t });
const frame = (t: number, midi: number): MatchAction => ({
  type: "frame",
  t,
  hz: midiToHz(midi),
  clarity: 0.95,
  level_db: -20,
  clipping: false,
});

describe("matchReducer", () => {
  it("advances through correct notes and finishes", () => {
    const s = play(riff, [note(1, 40), note(2, 43, false, 30), note(3, 45)]);
    expect(s.finished).toBe(true);
    expect(s.status).toEqual(["hit", "hit", "hit"]);
    expect(summarize(s, riff.steps, riff.sections).accuracy).toBe(1);
  });

  it("waits on a wrong note, then counts the step as retried", () => {
    const s = play(riff, [note(1, 41), note(2, 40)]);
    expect(s.index).toBe(1);
    expect(s.status[0]).toBe("retried");
    expect(s.stats[0].wrong).toBe(1);
    const sum = summarize(s, riff.steps, riff.sections);
    expect(sum.accuracy).toBe(0);
    expect(sum.mostMissed).toEqual([{ label: "String 6, fret 0 (E2)", misses: 1 }]);
  });

  it("shows what was played when it's wrong", () => {
    const s = play(riff, [note(1, 42)]);
    expect(s.feedback).toMatchObject({ kind: "wrong", step: 0, expectedMidi: 40 });
    expect(Math.round(s.feedback!.playedMidi)).toBe(42);
  });

  it("accepts the wrong octave only when asked to", () => {
    expect(play(riff, [note(1, 52)]).index).toBe(0);
    expect(play(riff, [note(1, 52)], { ...OPTIONS, anyOctave: true }).index).toBe(1);
  });

  it("ignores a second report from the same pick", () => {
    const s = play(riff, [note(1, 40), note(1, 99)]);
    expect(s.index).toBe(1);
    expect(s.stats[1].wrong).toBe(0);
  });

  it("advances chords on a strum, and the strum's own pitch doesn't count against the next step", () => {
    const tab = staff([
      "e|-----------|",
      "B|-----------|",
      "G|-----------|",
      "D|--2--------|",
      "A|--2--------|",
      "E|--0----3---|",
    ]);
    const s = play(tab, [onset(1), note(1, 40), onset(2), note(2, 43)]);
    expect(s.status).toEqual(["strummed", "hit"]);
    expect(s.stats[1].wrong).toBe(0);
    expect(summarize(s, tab.steps, tab.sections).notesPlayed).toBe(1);
  });

  it("doesn't count unpicked pitch changes as wrong on picked notes, but lets them hit", () => {
    const s1 = play(riff, [note(1, 47, true)]);
    expect(s1.index).toBe(0);
    expect(s1.stats[0].wrong).toBe(0);
    expect(play(riff, [note(1, 40, true)]).index).toBe(1);
  });

  it("scores hammer-ons and ignores the frets passed on a slide", () => {
    // G string: 5 (60), hammer to 7 (62), slide up to 10 (65)
    const tab = staff([
      "e|--------------|",
      "B|--------------|",
      "G|--5h7/10------|",
      "D|--------------|",
      "A|--------------|",
      "E|--------------|",
    ]);
    const s = play(tab, [note(1, 60), note(1.2, 62, true), note(1.4, 63, true), note(1.5, 64, true), note(1.6, 65, true)]);
    expect(s.status).toEqual(["hit", "hit", "hit"]);
    expect(s.stats.every((st) => st.wrong === 0)).toBe(true);
  });

  it("scores a bend once it holds at the target", () => {
    // G string 7 (62) bent to 9 (64)
    const tab = staff([
      "e|------------|",
      "B|------------|",
      "G|---7b9------|",
      "D|------------|",
      "A|------------|",
      "E|------------|",
    ]);
    let s = play(tab, [note(1, 62), note(1.1, 63, true), frame(1.2, 64)]);
    expect(s.finished).toBe(false);
    expect(s.stats[0].wrong).toBe(0);
    s = matchReducer(s, frame(1.3, 64), tab.steps, OPTIONS);
    expect(s.finished).toBe(true);
    expect(s.status[0]).toBe("hit");
  });

  it("passes ghost and dead notes automatically", () => {
    const tab = staff([
      "e|--------------|",
      "B|--------------|",
      "G|--------------|",
      "D|--------------|",
      "A|--------------|",
      "E|--0--x--(3)--5-|",
    ]);
    const s = play(tab, [note(1, 40)]);
    expect(s.index).toBe(3);
    expect(s.status.slice(0, 3)).toEqual(["hit", "passed", "passed"]);
  });

  it("skips, goes back, and jumps", () => {
    let s = play(riff, [{ type: "skip" }]);
    expect(s.status[0]).toBe("skipped");
    expect(s.index).toBe(1);
    s = matchReducer(s, { type: "back" }, riff.steps, OPTIONS);
    expect(s.index).toBe(0);
    expect(s.status[0]).toBe("pending");
    s = matchReducer(s, { type: "jump", index: 2 }, riff.steps, OPTIONS);
    expect(s.index).toBe(2);
  });

  it("loops a range and keeps counting passes", () => {
    let s = play(riff, [{ type: "loop", loop: { start: 1, end: 2 } }]);
    expect(s.index).toBe(1);
    // Two notes, loop back, first note again, then a wrong note on the second.
    for (const [t, m] of [[1, 43], [2, 45], [3, 43], [4, 44]]) {
      s = matchReducer(s, note(t, m), riff.steps, OPTIONS);
    }
    expect(s.finished).toBe(false);
    expect(s.loopPasses).toBe(1);
    expect(s.index).toBe(2);
    expect(s.stats[1]).toMatchObject({ passes: 2, firstTry: 2 });
    expect(s.stats[2]).toMatchObject({ passes: 1, firstTry: 1, wrong: 1 });
  });

  it("times the gap between notes to find hesitations", () => {
    const s = play(riff, [note(1, 40), note(3.5, 43), note(4, 45)]);
    const sum = summarize(s, riff.steps, riff.sections);
    expect(sum.slowest).toEqual([{ step: 1, bar: 1, label: "String 6, fret 3 (G2)", avgMs: 2500 }]);
  });
});
