import { describe, expect, it } from "vitest";
import { vocalDrillPicker } from "./vocalDrillPicker";

describe("vocalDrillPicker", () => {
  it("uses the item's own cue when there is one", () => {
    const config = { pool: ["SSS", "HA"], cues: { SSS: "Slow hiss", HA: "Staccato pulses" } };
    for (let i = 0; i < 20; i++) {
      const p = vocalDrillPicker({ config });
      expect(p.detail).toBe(config.cues[p.label as "SSS" | "HA"]);
    }
  });

  it("draws the detail from patterns otherwise", () => {
    const config = { pool: ["EE", "AH"], patterns: ["Short burst", "Hold 4 beats"] };
    for (let i = 0; i < 20; i++) {
      expect(config.patterns).toContain(vocalDrillPicker({ config }).detail);
    }
  });

  it("sticks to the selected items and avoids an immediate repeat", () => {
    const config = { pool: ["EE", "AH", "OO"], patterns: ["x"] };
    for (let i = 0; i < 20; i++) {
      expect(vocalDrillPicker({ config, selectedPool: ["EE", "AH"] }, "EE").label).toBe("AH");
    }
  });

  it("copes with an empty pool", () => {
    expect(vocalDrillPicker({ config: {} }).label).toBe("?");
  });
});
