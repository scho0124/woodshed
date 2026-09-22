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
