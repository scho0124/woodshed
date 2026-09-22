import { describe, expect, it } from "vitest";
import { cuePicker } from "./cuePicker";

describe("cuePicker", () => {
  it("uses the item's own cue when there is one", () => {
    const config = { pool: ["SSS", "HA"], cues: { SSS: "Slow hiss", HA: "Staccato pulses" } };
    for (let i = 0; i < 20; i++) {
      const p = cuePicker({ config });
      expect(p.detail).toBe(config.cues[p.label as "SSS" | "HA"]);
    }
  });

  it("draws the detail from patterns otherwise", () => {
    const config = { pool: ["EE", "AH"], patterns: ["Short burst", "Hold 4 beats"] };
    for (let i = 0; i < 20; i++) {
      expect(config.patterns).toContain(cuePicker({ config }).detail);
    }
  });

  it("sticks to the selected items and avoids an immediate repeat", () => {
    const config = { pool: ["EE", "AH", "OO"], patterns: ["x"] };
    for (let i = 0; i < 20; i++) {
      expect(cuePicker({ config, selectedPool: ["EE", "AH"] }, "EE").label).toBe("AH");
    }
  });

  it("copes with an empty pool", () => {
    expect(cuePicker({ config: {} }).label).toBe("?");
  });
});
