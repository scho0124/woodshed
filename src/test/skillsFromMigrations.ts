/** Skills as the migrations leave them, for tests that check skill data. */

const migrations = import.meta.glob<string>("../../src-tauri/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

export interface Skill {
  path: string;
  generator: string;
  config: Record<string, unknown>;
}

const unquote = (s: string) => s.replace(/''/g, "'");

/** Skills as the migrations leave them: seeded by INSERTs, then changed by UPDATEs. */
export function skillsFromMigrations(): Map<string, Skill> {
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
