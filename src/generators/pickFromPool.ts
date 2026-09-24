import type { GeneratorInput } from "./types";

/** Random item from the user's selected pool (or the skill's full pool), avoiding `avoid`. */
export function pickFromPool(input: GeneratorInput, avoid?: string): string | null {
  const pool =
    input.selectedPool && input.selectedPool.length > 0
      ? input.selectedPool
      : ((input.config.pool as string[] | undefined) ?? []);
  if (pool.length === 0) return null;

  let choice = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && choice === avoid) {
    choice = pool[(pool.indexOf(choice) + 1) % pool.length];
  }
  return choice;
}

/**
 * The instruction under a cue: the item's own line from `config.cues` if it has
 * one, otherwise a random pick from `config.patterns`.
 */
export function pickDetail(config: Record<string, unknown>, label: string): string | undefined {
  const cues = config.cues as Record<string, string> | undefined;
  const patterns = config.patterns as string[] | undefined;
  return (
    cues?.[label] ??
    (patterns?.length ? patterns[Math.floor(Math.random() * patterns.length)] : undefined)
  );
}
