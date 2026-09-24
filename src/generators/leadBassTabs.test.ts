import { describe, expect, it } from "vitest";
import { GENERATORS } from ".";
import { lineTab, type Line } from "./linePicker";
import { parseTab } from "@/lib/tabParser";

const migrations = import.meta.glob<string>("../../src-tauri/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

interface Skill {
  path: string;
  generator: string;
  config: Record<string, unknown>;
}

const unquote = (s: string) => s.replace(/''/g, "'");

/** Skills as the migrations leave them: seeded by INSERTs, then changed by UPDATEs. */
function skillsFromMigrations(): Map<string, Skill> {
  const skills = new Map<string, Skill>();
  for (const file of Object.keys(migrations).sort()) {
    const sql = migrations[file];
    const rows = sql.matchAll(
      /\('([\w.]+)', '(\w+)', '(?:[^']|'')*', '(?:[^']|'')*',\s*'(?:[^']|'')*',\s*'(\w+)',\s*'((?:[^']|'')*)'::jsonb/g,
    );
    for (const [, id, path, generator, config] of rows) {
      skills.set(id, { path, generator, config: JSON.parse(unquote(config)) });
    }
    for (const [, set, id] of sql.matchAll(/UPDATE skills SET ([\s\S]*?)\nWHERE id = '([\w.]+)';/g)) {
      const skill = skills.get(id)!;
      skill.generator = /generator_type = '(\w+)'/.exec(set)?.[1] ?? skill.generator;
      for (const [, key] of set.matchAll(/config - '(\w+)'/g)) delete skill.config[key];
      const merge = /\|\| '((?:[^']|'')*)'::jsonb/.exec(set);
      if (merge) Object.assign(skill.config, JSON.parse(unquote(merge[1])));
    }
  }
  return skills;
}

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
