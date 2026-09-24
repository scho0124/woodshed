import { describe, expect, it } from "vitest";
import { CHORD_SHAPES, UKULELE_CHORD_SHAPES } from "./chordShapes";
import { chordKeys, pitchClass } from "./pianoTheory";
import ukuleleSkillsSql from "../../src-tauri/migrations/0009_ukulele_skills.sql?raw";

const GCEA = [67, 60, 64, 69];
const EADGBE = [40, 45, 50, 55, 59, 64];

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

const migrations = import.meta.glob<string>("../../src-tauri/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("guitar chord shapes", () => {
  const sounded = (name: string) =>
    CHORD_SHAPES[name].frets.flatMap((fret, i) => (fret < 0 ? [] : [EADGBE[i] + fret]));

  it("Gmaj7 sounds the right notes", () => {
    expect(pitchClasses(sounded("Gmaj7"))).toEqual(pitchClasses(chordKeys("Gmaj7")!.keys));
  });

  it.each(["C9", "D9", "E9", "G9", "A9"])("%s sounds a full dominant 9th", (name) => {
    const root = pitchClass(name.slice(0, -1))!;
    expect(pitchClasses(sounded(name))).toEqual(pitchClasses([0, 4, 7, 10, 14].map((i) => root + i)));
  });

  it("covers every chord the guitar skills can cue", () => {
    const configs = Object.values(migrations).flatMap((sql) =>
      [...sql.matchAll(/'random_chord_picker',\s*'(\{[\s\S]*?\})'::jsonb/g)].map(
        (m) => JSON.parse(m[1].replace(/''/g, "'")) as { instrument?: string; pool: string[] },
      ),
    );
    const chords = configs.filter((c) => c.instrument !== "ukulele").flatMap((c) => c.pool);
    expect(chords.length).toBeGreaterThan(0);
    for (const chord of chords) expect(CHORD_SHAPES).toHaveProperty([chord]);
  });
});
