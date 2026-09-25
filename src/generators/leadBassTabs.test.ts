import { describe, expect, it } from "vitest";
import { GENERATORS } from ".";
import { lineTab, type Line } from "./linePicker";
import { parseTab } from "@/lib/tabParser";
import { skillsFromMigrations } from "@/test/skillsFromMigrations";

const leadAndBass = [...skillsFromMigrations()].filter(([, s]) => s.path === "lead" || s.path === "bass");

describe("lead and bass drills", () => {
  it("finds the skills", () => {
    expect(leadAndBass.length).toBeGreaterThanOrEqual(27);
  });

  it.each(leadAndBass)("%s shows a tab for every item", (_, skill) => {
    const generate = GENERATORS[skill.generator];
    expect(generate).toBeDefined();
    const config = skill.config;
    const strings = skill.path === "lead" ? 6 : 4;
    const check = (tab: string[] | null | undefined, what: string) => {
      expect(tab, what).toBeTruthy();
      const parsed = parseTab(tab!.join("\n"));
      expect(parsed.stringCount, what).toBe(strings);
      expect(parsed.unreadableLines, what).toEqual([]);
      expect(parsed.steps.some((s) => s.notes.some((n) => n.fret !== null)), what).toBe(true);
    };

    for (const item of config.pool as string[]) {
      if (skill.generator === "line_picker") {
        const instrument = config.instrument === "guitar" ? "guitar" : "bass";
        for (const line of config.lines as Line[]) {
          check(lineTab(instrument, item, line, config.open_strings !== false), `${item}: ${line.text}`);
        }
      } else if (skill.generator === "scale_pattern_picker") {
        for (const position of (config.positions as number[] | undefined) ?? [1]) {
          const prompt = generate({ config: { ...config, positions: [position] }, selectedPool: [item] });
          check(prompt.tab, `${item}, position ${position}`);
        }
      } else {
        check(generate({ config, selectedPool: [item] }).tab, item);
      }
    }
  });
});
