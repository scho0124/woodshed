import { describe, expect, it } from "vitest";
import { scoreCheck, type MicCheckConfig, type VoiceFrame } from "./voiceCheck";
import { skillsFromMigrations } from "@/test/skillsFromMigrations";

const KINDS = ["breath", "hold", "vibrato", "notes", "belt", "fry", "scream"];
const vocal = [...skillsFromMigrations()].filter(([, s]) => s.path === "vocals" || s.path === "clean_vocals");

/** Two seconds of a steady A3, then a second of silence. */
const frames: VoiceFrame[] = Array.from({ length: 141 }, (_, i) => ({
  t: i / 47,
  hz: i < 94 ? 220 : null,
  level_db: i < 94 ? -25 : -70,
  clipping: false,
}));

describe("vocal mic checks", () => {
  it("finds the vocal skills", () => {
    expect(vocal.length).toBeGreaterThanOrEqual(24);
  });

  it.each(vocal)("%s has a mic check that scores", (_, skill) => {
    const check = skill.config.mic_check as MicCheckConfig;
    expect(check).toBeDefined();
    expect(KINDS).toContain(check.kind);
    expect(check.prompt.length).toBeGreaterThan(10);
    if (check.target_from_pool) expect((skill.config.pool as string[]).length).toBeGreaterThan(0);
    const result = scoreCheck(check, frames, { threshold: -50, speaking: -25, targetMidi: 57 });
    expect(result.heard).toBe(true);
    expect(result.readings.length).toBeGreaterThan(0);
  });
});
