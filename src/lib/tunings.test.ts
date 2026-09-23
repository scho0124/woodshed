import { describe, expect, it } from "vitest";
import { normalizeTuningName, resolveTuning, tuningFromNoteNames } from "./tunings";
import { detectCapo } from "./tabMetadata";

describe("tunings", () => {
  it("names tuning text found in tabs", () => {
    expect(normalizeTuningName("Standard (EADGBE)")).toBe("Standard");
    expect(normalizeTuningName("E standard")).toBe("Standard");
    expect(normalizeTuningName("Eb standard")).toBe("Half step down");
    expect(normalizeTuningName("half-step down")).toBe("Half step down");
    expect(normalizeTuningName("D A D G B E")).toBe("Drop D");
    expect(normalizeTuningName("Eb Ab Db Gb Bb Eb")).toBe("Half step down");
    expect(normalizeTuningName("drop c")).toBe("Drop C");
    expect(normalizeTuningName("drop c#")).toBe("Drop C#");
    expect(normalizeTuningName("DADGAD")).toBe("DADGAD");
    expect(normalizeTuningName("C G C F A D")).toBe("Drop C");
    // Open C isn't in the list, so it's kept as written.
    expect(normalizeTuningName("C G C G C E")).toBe("C G C G C E");
  });

  it("puts note names in the nearest octave for the string count", () => {
    expect(tuningFromNoteNames(["E", "A", "D", "G", "B", "e"])).toEqual([40, 45, 50, 55, 59, 64]);
    expect(tuningFromNoteNames(["B", "E", "A", "D", "G"])).toEqual([23, 28, 33, 38, 43]);
    expect(resolveTuning("Drop D")).toEqual([38, 45, 50, 55, 59, 64]);
    expect(resolveTuning("not a tuning")).toBeNull();
  });

  it("finds the capo", () => {
    expect(detectCapo("Capo 2")).toBe(2);
    expect(detectCapo("Capo: 3rd fret")).toBe(3);
    expect(detectCapo("capo on fret 5")).toBe(5);
    expect(detectCapo("Capo III")).toBe(3);
    expect(detectCapo("No capo")).toBe(0);
    expect(detectCapo("e|---0---|")).toBe(0);
  });
});
