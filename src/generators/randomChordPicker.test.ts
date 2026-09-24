import { describe, expect, it } from "vitest";
import { randomChordPicker } from "./randomChordPicker";

describe("randomChordPicker", () => {
  it("adds an instruction from patterns under the chord", () => {
    const config = { pool: ["Am", "Dm"], patterns: ["Chop on 2 and 4", "Double chop"] };
    for (let i = 0; i < 20; i++) {
      const p = randomChordPicker({ config });
      expect(p.chordShapeName).toBe(p.label);
      expect(config.patterns).toContain(p.detail);
    }
  });

  it("shows just the chord when there are no patterns", () => {
    expect(randomChordPicker({ config: { pool: ["E"] } }).detail).toBeUndefined();
  });
});
