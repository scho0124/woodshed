import { describe, expect, it } from "vitest";
import { UKULELE_CHORD_SHAPES } from "./chordShapes";
import { chordKeys } from "./pianoTheory";
import ukuleleSkillsSql from "../../src-tauri/migrations/0009_ukulele_skills.sql?raw";

const GCEA = [67, 60, 64, 69];

const pitchClasses = (notes: number[]) => [...new Set(notes.map((n) => n % 12))].sort((a, b) => a - b);

describe("ukulele chord shapes", () => {
  it.each(Object.entries(UKULELE_CHORD_SHAPES))("%s sounds the right notes", (name, shape) => {
    expect(shape.frets).toHaveLength(4);
    const played = shape.frets.map((fret, i) => GCEA[i] + fret);
    // Four strings can't hold every note of a 7th chord plus a doubled root, so
    // check the shape plays only chord tones and includes the root and 3rd.
    const spelled = chordKeys(name)!.keys;
    const chordTones = pitchClasses(spelled);
    for (const pc of pitchClasses(played)) expect(chordTones).toContain(pc);
    expect(pitchClasses(played)).toContain(spelled[0] % 12);
    expect(pitchClasses(played)).toContain(spelled[1] % 12);
  });

  it("covers every chord the ukulele skills can cue", () => {
    const pools = [...ukuleleSkillsSql.matchAll(/"instrument": "ukulele", "pool": (\[[^\]]*\])/g)].flatMap(
      (m) => JSON.parse(m[1]) as string[],
    );
    expect(pools.length).toBeGreaterThan(0);
    for (const chord of pools) expect(UKULELE_CHORD_SHAPES).toHaveProperty([chord]);
  });
});
